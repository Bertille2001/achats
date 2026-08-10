# biasa/app/api/v1/endpoints/admin.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import (
    Utilisateur, DemandeAchat, StatutDA, RoleUtilisateur
)
from app.schemas.schemas import DemandeAchatOut, ServiceOut, ServiceUpdate
from app.services import da_service

router = APIRouter(prefix="/admin", tags=["Administration"])


def admin_only(current_user=Depends(get_current_user)):
    if current_user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user


def vision_globale(current_user=Depends(get_current_user)):
    """DAF, Responsable et Admin ont une visibilité complète sur toutes les
    demandes (pas seulement celles de leur service ou en attente de leur
    validation) — décision client du 2026-06."""
    if current_user.role not in (RoleUtilisateur.DAF, RoleUtilisateur.RESPONSABLE, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return current_user


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    """Statistiques globales pour le tableau de bord admin."""
    total_users = await db.execute(select(func.count(Utilisateur.id)).where(Utilisateur.actif == True))
    total_da = await db.execute(select(func.count(DemandeAchat.id)))
    da_attente = await db.execute(select(func.count(DemandeAchat.id)).where(
        DemandeAchat.statut.in_([StatutDA.ATT_RESPONSABLE, StatutDA.ATT_DAF])
    ))
    da_approuvees = await db.execute(select(func.count(DemandeAchat.id)).where(
        DemandeAchat.statut == StatutDA.APPROUVEE
    ))
    da_rejetees = await db.execute(select(func.count(DemandeAchat.id)).where(
        DemandeAchat.statut == StatutDA.REJETEE
    ))
    da_recues = await db.execute(select(func.count(DemandeAchat.id)).where(
        DemandeAchat.statut == StatutDA.RECUE
    ))
    return {
        "total_users": total_users.scalar_one(),
        "total_da": total_da.scalar_one(),
        "da_attente": da_attente.scalar_one(),
        "da_approuvees": da_approuvees.scalar_one(),
        "da_rejetees": da_rejetees.scalar_one(),
        "da_recues": da_recues.scalar_one(),
    }


@router.get("/toutes-les-da", response_model=list[DemandeAchatOut])
async def toutes_les_da(db: AsyncSession = Depends(get_db), _=Depends(vision_globale)):
    """Toutes les DA de tous les utilisateurs."""
    result = await db.execute(
        select(DemandeAchat)
        .options(*da_service._load_options())
        .order_by(DemandeAchat.date_demande.desc())
    )
    return list(result.scalars().all())


@router.get("/dashboard-stats")
async def dashboard_stats(db: AsyncSession = Depends(get_db), _=Depends(vision_globale)):
    """Statistiques agrégées pour le tableau de bord général : nombre de
    demandes par mois et par service, avec la répartition par statut (dont
    "recue" = terminée et "rejetee" = refusée), et le montant réellement
    dépensé — basé sur les lignes de commande (prix saisis par les Achats à
    la commande passée), pas sur les lignes demandées au départ."""
    result = await db.execute(select(DemandeAchat).options(*da_service._load_options()))
    demandes = list(result.scalars().all())

    par_mois: dict[str, dict] = {}
    par_service: dict[str, dict] = {}

    def _bucket(store: dict, cle: str) -> dict:
        if cle not in store:
            store[cle] = {"total": 0, "montant": 0.0}
        return store[cle]

    for da in demandes:
        mois_cle = da.date_demande.strftime("%Y-%m")
        montant = da.montant_total_commande
        for store, cle in ((par_mois, mois_cle), (par_service, da.service_demandeur)):
            b = _bucket(store, cle)
            b["total"] += 1
            b["montant"] += montant
            b[da.statut.value] = b.get(da.statut.value, 0) + 1

    return {
        "par_mois": [{"cle": k, **v} for k, v in sorted(par_mois.items())],
        "par_service": [{"cle": k, **v} for k, v in sorted(par_service.items(), key=lambda kv: -kv[1]["total"])],
        "montant_total": sum(da.montant_total_commande for da in demandes),
    }


@router.get("/mdp-oublies-en-attente")
async def mdp_oublies_en_attente(db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    """Utilisateurs ayant une demande de réinitialisation de mot de passe en
    cours (jeton valide, pas encore utilisé) — vue directement dans l'appli,
    utile quand tout le monde n'a pas d'email et qu'on ne peut donc pas
    compter uniquement sur la notification par email pour prévenir l'admin."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.jeton_reinitialisation.isnot(None),
            Utilisateur.jeton_expire_le.isnot(None),
            Utilisateur.jeton_expire_le > now,
        ).order_by(Utilisateur.jeton_expire_le.asc())
    )
    users = list(result.scalars().all())
    return [
        {
            "id": u.id,
            "nom": u.nom,
            "prenom": u.prenom,
            "username": u.username,
            "service": u.service,
            "demande_le": (u.jeton_expire_le - timedelta(hours=2)).isoformat(),
        }
        for u in users
    ]


@router.post("/users/{user_id}/deverrouiller")
async def deverrouiller(user_id: int, db: AsyncSession = Depends(get_db), admin_user=Depends(admin_only)):
    from app.services.user_service import deverrouiller_compte
    user = await deverrouiller_compte(db, user_id, admin_user)
    await db.commit()
    return {"message": f"Le compte {user.username} a été déverrouillé."}


@router.get("/journal-audit")
async def journal_audit(limite: int = 200, db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    """Journal 'qui a fait quoi' — fusionne deux sources dans une même
    timeline : les événements de sécurité (connexions, verrouillages...) et
    les actions métier sur les demandes d'achat (création, validation, rejet,
    BC créé, commande passée, réception...). Avant, seuls les événements de
    sécurité étaient visibles ici ; les actions métier n'apparaissaient qu'une
    DA à la fois, dans l'onglet Historique de chaque fiche."""
    from app.models.models import JournalAudit, HistoriqueValidation
    from sqlalchemy.orm import selectinload

    result_securite = await db.execute(
        select(JournalAudit)
        .options(selectinload(JournalAudit.utilisateur))
        .order_by(JournalAudit.date_evenement.desc())
        .limit(limite)
    )
    evenements = [
        {
            "id": f"sec-{j.id}",
            "type": "securite",
            "username_saisi": j.username_saisi,
            "evenement": j.evenement,
            "details": j.details,
            "date_evenement": j.date_evenement,
            "utilisateur_nom": f"{j.utilisateur.prenom} {j.utilisateur.nom}".strip() if j.utilisateur else None,
            "demande_numero": None,
        }
        for j in result_securite.scalars().all()
    ]

    result_actions = await db.execute(
        select(HistoriqueValidation)
        .options(selectinload(HistoriqueValidation.utilisateur), selectinload(HistoriqueValidation.demande))
        .order_by(HistoriqueValidation.date_action.desc())
        .limit(limite)
    )
    evenements += [
        {
            "id": f"act-{h.id}",
            "type": "action",
            "username_saisi": None,
            "evenement": h.action.value,
            "details": h.commentaire,
            "date_evenement": h.date_action,
            "utilisateur_nom": f"{h.utilisateur.prenom} {h.utilisateur.nom}".strip(),
            "demande_numero": h.demande.numero if h.demande else None,
        }
        for h in result_actions.scalars().all()
    ]

    evenements.sort(key=lambda e: e["date_evenement"], reverse=True)
    return evenements[:limite]


@router.get("/usage-stats")
async def usage_stats(jours: int = 30, db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    """Fréquence d'utilisation de l'appli : nombre de connexions réussies par
    jour sur les N derniers jours, et par utilisateur, à partir du journal de
    sécurité déjà tenu (événement 'connexion_reussie')."""
    from app.models.models import JournalAudit
    from sqlalchemy.orm import selectinload
    from datetime import datetime, timedelta

    depuis = datetime.utcnow() - timedelta(days=jours)
    result = await db.execute(
        select(JournalAudit)
        .options(selectinload(JournalAudit.utilisateur))
        .where(JournalAudit.evenement == "connexion_reussie", JournalAudit.date_evenement >= depuis)
        .order_by(JournalAudit.date_evenement.asc())
    )
    connexions = list(result.scalars().all())

    par_jour: dict[str, int] = {}
    par_utilisateur: dict[str, int] = {}
    for c in connexions:
        jour = c.date_evenement.strftime("%Y-%m-%d")
        par_jour[jour] = par_jour.get(jour, 0) + 1
        nom = f"{c.utilisateur.prenom} {c.utilisateur.nom}".strip() if c.utilisateur else (c.username_saisi or "?")
        par_utilisateur[nom] = par_utilisateur.get(nom, 0) + 1

    return {
        "total_connexions": len(connexions),
        "par_jour": [{"jour": k, "connexions": v} for k, v in sorted(par_jour.items())],
        "par_utilisateur": sorted(
            [{"utilisateur": k, "connexions": v} for k, v in par_utilisateur.items()],
            key=lambda x: -x["connexions"],
        ),
    }

from pydantic import BaseModel

class EmailConfig(BaseModel):
    MAIL_SERVER: str
    MAIL_PORT: str
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_STARTTLS: str
    MAIL_SSL_TLS: str

class TestEmail(BaseModel):
    email: str
    MAIL_SERVER: str
    MAIL_PORT: str
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_STARTTLS: str
    MAIL_SSL_TLS: str

@router.post("/config-email")
async def sauvegarder_config_email(
    data: EmailConfig,
    _=Depends(admin_only)
):
    """Sauvegarde la config email dans le fichier .env (utile en local ;
    sur la plupart des hébergeurs le système de fichiers est éphémère ou en
    lecture seule — configurez alors plutôt les variables d'environnement
    MAIL_* directement dans les réglages de la plateforme d'hébergement)."""
    import os
    env_path = os.path.join(os.path.dirname(__file__), '../../../../.env')

    try:
        with open(env_path, 'r') as f:
            lines = f.readlines()
    except OSError as e:
        raise HTTPException(
            status_code=503,
            detail=(
                "Impossible d'écrire la configuration email sur ce serveur "
                "(système de fichiers en lecture seule ou éphémère). "
                "Configurez les variables MAIL_* dans les paramètres de "
                f"l'hébergeur à la place. ({e})"
            ),
        )

    updates = {
        'MAIL_SERVER': data.MAIL_SERVER,
        'MAIL_PORT': data.MAIL_PORT,
        'MAIL_USERNAME': data.MAIL_USERNAME,
        'MAIL_PASSWORD': data.MAIL_PASSWORD,
        'MAIL_FROM': data.MAIL_FROM,
        'MAIL_STARTTLS': data.MAIL_STARTTLS,
        'MAIL_SSL_TLS': data.MAIL_SSL_TLS,
    }

    new_lines = []
    updated_keys = set()
    for line in lines:
        key = line.split('=')[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}\n")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    # Ajouter les clés manquantes
    for key, val in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}\n")

    try:
        with open(env_path, 'w') as f:
            f.writelines(new_lines)
    except OSError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Impossible d'écrire le fichier de configuration sur ce serveur. ({e})",
        )

    return {"message": "Configuration sauvegardée. Redémarrez le serveur pour appliquer."}


@router.post("/test-email")
async def tester_email(data: TestEmail, _=Depends(admin_only)):
    """Envoie un email de test avec la config fournie."""
    try:
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
        conf = ConnectionConfig(
            MAIL_USERNAME=data.MAIL_USERNAME,
            MAIL_PASSWORD=data.MAIL_PASSWORD,
            MAIL_FROM=data.MAIL_FROM,
            MAIL_PORT=int(data.MAIL_PORT),
            MAIL_SERVER=data.MAIL_SERVER,
            MAIL_STARTTLS=data.MAIL_STARTTLS == 'True',
            MAIL_SSL_TLS=data.MAIL_SSL_TLS == 'True',
            USE_CREDENTIALS=True,
        )
        message = MessageSchema(
            subject="[BIASA] Test de configuration email",
            recipients=[data.email],
            body="<p>Ceci est un email de test du système BIASA. La configuration email fonctionne correctement.</p>",
            subtype="html",
        )
        await FastMail(conf).send_message(message)
        return {"message": f"Email envoyé à {data.email}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur : {str(e)}")


# ---------- Services (réglage "peut traiter ses propres commandes") ----------

@router.get("/services", response_model=list[ServiceOut])
async def lister_services(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Liste tous les services connus : ceux déjà configurés en base, plus tous
    les noms de service déjà utilisés par des utilisateurs ou des demandes
    (pour ne rien laisser de côté même si l'admin n'a encore rien réglé)."""
    from app.models.models import Service as ServiceModel

    result = await db.execute(select(ServiceModel).order_by(ServiceModel.nom))
    existants = {s.nom: s for s in result.scalars().all()}

    r1 = await db.execute(select(Utilisateur.service).where(Utilisateur.service.isnot(None)).distinct())
    r2 = await db.execute(select(DemandeAchat.service_demandeur).distinct())
    tous_les_noms = {v for v in r1.scalars().all() if v} | {v for v in r2.scalars().all() if v} | set(existants.keys())

    services = []
    for nom in sorted(tous_les_noms):
        if nom in existants:
            services.append(existants[nom])
        else:
            services.append(ServiceModel(id=0, nom=nom, peut_traiter_soi_meme=False))
    return services


@router.put("/services/{nom}", response_model=ServiceOut)
async def modifier_service(nom: str, data: ServiceUpdate, db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    from app.models.models import Service as ServiceModel

    result = await db.execute(select(ServiceModel).where(ServiceModel.nom == nom))
    service = result.scalar_one_or_none()
    if not service:
        service = ServiceModel(nom=nom, peut_traiter_soi_meme=data.peut_traiter_soi_meme)
        db.add(service)
    else:
        service.peut_traiter_soi_meme = data.peut_traiter_soi_meme
    await db.flush()
    await db.refresh(service)
    return service
