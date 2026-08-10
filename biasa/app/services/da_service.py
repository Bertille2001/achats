import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, UploadFile
import aiofiles

from app.models.models import (
    DemandeAchat, LigneDA, FichierDA, HistoriqueValidation,
    StatutDA, ActionHistorique, RoleUtilisateur, Utilisateur, Service, MessageDA, LigneCommande
)
from app.schemas.schemas import DemandeAchatCreate
from app.core.config import UPLOAD_PATH
from app.services.mail_service import notifier_validateur, notifier_demandeur


async def _generer_numero(db: AsyncSession) -> str:
    annee = datetime.now().year
    result = await db.execute(
        select(func.count(DemandeAchat.id)).where(DemandeAchat.numero.like(f"DA-{annee}-%"))
    )
    count = result.scalar_one() + 1
    return f"DA-{annee}-{count:03d}"


def _load_options():
    return [
        selectinload(DemandeAchat.demandeur),
        selectinload(DemandeAchat.lignes),
        selectinload(DemandeAchat.fichiers),
        selectinload(DemandeAchat.historique).selectinload(HistoriqueValidation.utilisateur),
        selectinload(DemandeAchat.messages).selectinload(MessageDA.auteur),
        selectinload(DemandeAchat.lignes_commande),
    ]


async def get_da_by_id(db: AsyncSession, da_id: int) -> DemandeAchat | None:
    result = await db.execute(
        select(DemandeAchat).where(DemandeAchat.id == da_id).options(*_load_options())
    )
    return result.scalar_one_or_none()


async def _get_da_or_404(db: AsyncSession, da_id: int) -> DemandeAchat:
    da = await get_da_by_id(db, da_id)
    if not da:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return da


async def mes_demandes(db: AsyncSession, user_id: int) -> list[DemandeAchat]:
    result = await db.execute(
        select(DemandeAchat)
        .where(DemandeAchat.demandeur_id == user_id)
        .options(*_load_options())
        .order_by(DemandeAchat.date_demande.desc())
    )
    return list(result.scalars().all())


async def demandes_a_valider(db: AsyncSession, user: Utilisateur) -> list[DemandeAchat]:
    if user.role == RoleUtilisateur.RESPONSABLE:
        statut_cible = StatutDA.ATT_RESPONSABLE
    elif user.role == RoleUtilisateur.DAF:
        statut_cible = StatutDA.ATT_DAF
    elif user.role in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
      # Le workflow s'arrête une fois la DA "recue" (confirmee par le
      # demandeur ET le service Achats) : une DA recue est terminee, elle ne
      # doit plus apparaitre dans la liste des demandes a traiter.
      result = await db.execute(
        select(DemandeAchat)
        .where(DemandeAchat.statut == StatutDA.APPROUVEE)
        .options(*_load_options())
        .order_by(DemandeAchat.date_demande.desc())
    )
      return list(result.scalars().all())
    else:
        return []
    result = await db.execute(
        select(DemandeAchat).where(
            DemandeAchat.statut == statut_cible,
            # On ne peut pas valider sa propre demande (voir _interdire_auto_validation) :
            # elle est donc exclue de la liste "à valider" plutôt que d'y apparaître
            # sans aucune action possible. Elle reste bien visible dans "Mes demandes".
            DemandeAchat.demandeur_id != user.id,
        )
        .options(*_load_options()).order_by(DemandeAchat.date_demande.desc())
    )
    return list(result.scalars().all())


async def creer_demande(db: AsyncSession, data: DemandeAchatCreate, user: Utilisateur) -> DemandeAchat:
    numero = await _generer_numero(db)
    da = DemandeAchat(
        numero=numero, demandeur_id=user.id,
        service_demandeur=data.service_demandeur,
        poste_fonction=data.poste_fonction or user.poste,
        type_da=data.type_da, nature=data.nature, motif=data.motif,
        urgence=data.urgence, statut=StatutDA.BROUILLON,
        justification=data.justification,
        normes_certifications=data.normes_certifications,
        date_peremption_min=data.date_peremption_min,
        fournisseur_suggere=data.fournisseur_suggere,
        autres_specs=data.autres_specs, lieu_utilisation=data.lieu_utilisation,
    )
    db.add(da)
    await db.flush()
    for ligne_data in data.lignes:
        db.add(LigneDA(demande_id=da.id, **ligne_data.model_dump()))
    _ajouter_historique(db, da.id, user.id, ActionHistorique.CREATION)
    await db.flush()
    return await _get_da_or_404(db, da.id)


async def soumettre_demande(db: AsyncSession, da_id: int, user: Utilisateur) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    if da.demandeur_id != user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if da.statut not in (StatutDA.BROUILLON, StatutDA.REJETEE):
        raise HTTPException(status_code=400, detail="Cette demande ne peut pas être soumise")
    # Une DA rejetée qui est soumise à nouveau → on marque deja_renvoye pour
    # empêcher un 2ème renvoi après un 2ème rejet éventuel.
    if da.statut == StatutDA.BROUILLON and da.deja_renvoye is False:
        pass  # premier envoi ou renvoi déjà géré
    if not da.deja_renvoye and da.statut == StatutDA.REJETEE:
        da.deja_renvoye = True
    da.statut = StatutDA.ATT_RESPONSABLE
    da.soumise_le = datetime.utcnow()
    _ajouter_historique(db, da.id, user.id, ActionHistorique.SOUMISSION)
    await db.flush()
    # Charger les données nécessaires avant la tâche de fond
    responsables = await db.execute(
        select(Utilisateur).where(Utilisateur.role == RoleUtilisateur.RESPONSABLE, Utilisateur.actif == True)
    )
    numero = da.numero
    demandeur_nom = f"{user.prenom} {user.nom}"
    urgence = da.urgence.value
    emails_resp = [resp.email for resp in responsables.scalars() if resp.email]

    # Email en arrière-plan — ne bloque plus la réponse
    async def envoyer_emails():
        for email in emails_resp:
            try:
                await notifier_validateur(email, numero, demandeur_nom, urgence)
            except Exception:
                pass

    asyncio.create_task(envoyer_emails())
    return await _get_da_or_404(db, da_id)


async def valider_responsable(db: AsyncSession, da_id: int, user: Utilisateur, commentaire: str | None) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    _verifier_role(user, RoleUtilisateur.RESPONSABLE)
    _interdire_auto_validation(da, user)
    if da.statut != StatutDA.ATT_RESPONSABLE:
        raise HTTPException(status_code=400, detail="Statut incorrect")
    da.statut = StatutDA.ATT_DAF
    da.responsable_id = user.id
    _ajouter_historique(db, da.id, user.id, ActionHistorique.VALIDATION_RESPONSABLE, commentaire)
    await db.flush()
    dafs = await db.execute(select(Utilisateur).where(Utilisateur.role == RoleUtilisateur.DAF, Utilisateur.actif == True))
    numero = da.numero
    demandeur_nom = f"{da.demandeur.prenom} {da.demandeur.nom}"
    demandeur_email = da.demandeur.email
    urgence = da.urgence.value
    emails_daf = [daf.email for daf in dafs.scalars() if daf.email]
    comm = commentaire or ""

    async def envoyer_emails():
        for email in emails_daf:
            try:
                await notifier_validateur(email, numero, demandeur_nom, urgence)
            except Exception:
                pass
        try:
            await notifier_demandeur(demandeur_email, numero, "validée par votre responsable", comm)
        except Exception:
            pass

    asyncio.create_task(envoyer_emails())
    return await _get_da_or_404(db, da_id)


async def rejeter_responsable(db: AsyncSession, da_id: int, user: Utilisateur, commentaire: str) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    _verifier_role(user, RoleUtilisateur.RESPONSABLE)
    _interdire_auto_validation(da, user)
    if da.statut != StatutDA.ATT_RESPONSABLE:
        raise HTTPException(status_code=400, detail="Statut incorrect")
    da.statut = StatutDA.REJETEE
    da.responsable_id = user.id
    _ajouter_historique(db, da.id, user.id, ActionHistorique.REJET_RESPONSABLE, commentaire)
    await db.flush()
    numero = da.numero
    demandeur_email = da.demandeur.email

    async def envoyer_email():
        try:
            await notifier_demandeur(demandeur_email, numero, "rejetée par votre responsable", commentaire)
        except Exception:
            pass

    asyncio.create_task(envoyer_email())
    return await _get_da_or_404(db, da_id)


async def valider_daf(db: AsyncSession, da_id: int, user: Utilisateur, commentaire: str | None) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    _verifier_role(user, RoleUtilisateur.DAF)
    _interdire_auto_validation(da, user)
    if da.statut != StatutDA.ATT_DAF:
        raise HTTPException(status_code=400, detail="Statut incorrect")
    da.statut = StatutDA.APPROUVEE
    da.daf_id = user.id
    _ajouter_historique(db, da.id, user.id, ActionHistorique.VALIDATION_DAF, commentaire)
    await db.flush()
    numero = da.numero
    demandeur_email = da.demandeur.email
    comm = commentaire or ""

    async def envoyer_email():
        try:
            await notifier_demandeur(demandeur_email, numero, "approuvée par le DAF", comm)
        except Exception:
            pass

    asyncio.create_task(envoyer_email())
    return await _get_da_or_404(db, da_id)


async def rejeter_daf(db: AsyncSession, da_id: int, user: Utilisateur, commentaire: str) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    _verifier_role(user, RoleUtilisateur.DAF)
    _interdire_auto_validation(da, user)
    if da.statut != StatutDA.ATT_DAF:
        raise HTTPException(status_code=400, detail="Statut incorrect")
    da.statut = StatutDA.REJETEE
    da.daf_id = user.id
    _ajouter_historique(db, da.id, user.id, ActionHistorique.REJET_DAF, commentaire)
    await db.flush()
    numero = da.numero
    demandeur_email = da.demandeur.email

    async def envoyer_email():
        try:
            await notifier_demandeur(demandeur_email, numero, "rejetée par le DAF", commentaire)
        except Exception:
            pass

    asyncio.create_task(envoyer_email())
    return await _get_da_or_404(db, da_id)


async def confirmer_reception_demandeur(db: AsyncSession, da_id: int, user: Utilisateur) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    if da.demandeur_id != user.id:
        raise HTTPException(status_code=403, detail="Seul le demandeur d'origine peut confirmer la réception.")
    if da.statut not in (StatutDA.APPROUVEE, StatutDA.RECUE):
        raise HTTPException(status_code=400, detail="La demande doit être approuvée avant de pouvoir confirmer la réception.")
    if da.livre_le is None:
        raise HTTPException(status_code=400, detail="Le Service Achats doit d'abord marquer la livraison comme reçue avant que vous puissiez confirmer.")
    if da.confirmation_demandeur_le is not None:
        raise HTTPException(status_code=400, detail="Vous avez déjà confirmé la réception.")
    da.confirmation_demandeur_par_id = user.id
    da.confirmation_demandeur_le = datetime.utcnow()
    if da.confirmation_acheteur_le is not None:
        da.statut = StatutDA.RECUE
    _ajouter_historique(db, da.id, user.id, ActionHistorique.CONFIRMATION_RECEPTION_DEMANDEUR)
    await db.flush()
    return await _get_da_or_404(db, da_id)


async def confirmer_reception_acheteur(db: AsyncSession, da_id: int, user: Utilisateur) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    if user.role not in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Réservé au gestionnaire achats.")
    if da.statut not in (StatutDA.APPROUVEE, StatutDA.RECUE):
        raise HTTPException(status_code=400, detail="La demande doit être approuvée avant de pouvoir confirmer la réception.")
    if da.livre_le is None:
        raise HTTPException(status_code=400, detail="La livraison doit d'abord être marquée comme reçue avant de confirmer.")
    if da.confirmation_acheteur_le is not None:
        raise HTTPException(status_code=400, detail="La réception a déjà été confirmée par les achats.")
    da.confirmation_acheteur_par_id = user.id
    da.confirmation_acheteur_le = datetime.utcnow()
    if da.confirmation_demandeur_le is not None:
        da.statut = StatutDA.RECUE
    _ajouter_historique(db, da.id, user.id, ActionHistorique.CONFIRMATION_RECEPTION_ACHETEUR)
    await db.flush()
    numero = da.numero
    demandeur_email = da.demandeur.email

    async def envoyer_email():
        try:
            await notifier_demandeur(demandeur_email, numero, "réception confirmée par le Service Achats", "")
        except Exception:
            pass

    asyncio.create_task(envoyer_email())
    return await _get_da_or_404(db, da_id)


EXTENSIONS_OK = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".docx", ".xlsx"}
TAILLE_MAX = 10 * 1024 * 1024


async def upload_fichier(db: AsyncSession, da_id: int, file: UploadFile, user: Utilisateur) -> FichierDA:
    da = await _get_da_or_404(db, da_id)
    if da.demandeur_id != user.id and user.role not in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé")
    ext = Path(file.filename).suffix.lower()
    if ext not in EXTENSIONS_OK:
        raise HTTPException(status_code=400, detail=f"Extension non autorisée : {ext}")
    contenu = await file.read()
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")
    nom_stockage = f"{uuid.uuid4()}{ext}"
    async with aiofiles.open(UPLOAD_PATH / nom_stockage, "wb") as f:
        await f.write(contenu)
    fichier = FichierDA(
        demande_id=da.id, nom_original=file.filename, nom_stockage=nom_stockage,
        taille_octets=len(contenu), mime_type=file.content_type or "application/octet-stream",
        uploade_par_id=user.id,
    )
    db.add(fichier)
    await db.flush()
    await db.refresh(fichier)
    return fichier


async def telecharger_fichier(db: AsyncSession, da_id: int, fichier_id: int, user: Utilisateur) -> tuple[Path, str]:
    # Le téléchargement suit la même règle de visibilité que le reste de la DA
    # (détail, messages, aperçu) : toute personne pouvant voir la demande peut
    # télécharger ses fichiers joints, pas seulement le service Achats.
    da = await _get_da_or_404(db, da_id)
    if not peut_voir_da(user, da):
        raise HTTPException(status_code=403, detail="Accès refusé")
    result = await db.execute(
        select(FichierDA).where(FichierDA.id == fichier_id, FichierDA.demande_id == da_id)
    )
    fichier = result.scalar_one_or_none()
    if not fichier:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin = UPLOAD_PATH / fichier.nom_stockage
    if not chemin.exists():
        raise HTTPException(status_code=404, detail="Fichier manquant sur le serveur")
    return chemin, fichier.nom_original


def _ajouter_historique(db, da_id, user_id, action, commentaire=None):
    db.add(HistoriqueValidation(demande_id=da_id, utilisateur_id=user_id, action=action, commentaire=commentaire))


def _verifier_role(user, role):
    if user.role not in (role, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Rôle insuffisant")


def _interdire_auto_validation(da: DemandeAchat, user: Utilisateur):
    """Un responsable/DAF ne peut pas valider ou rejeter sa propre demande,
    même s'il l'a soumise en tant que simple demandeur (n'importe quel compte
    peut soumettre une DA pour lui-même, quel que soit son rôle). Sans ce
    garde-fou, la même personne pouvait à la fois demander et approuver,
    et sa propre DA se retrouvait mélangée dans sa liste "à valider"."""
    if da.demandeur_id == user.id and user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas valider ou rejeter votre propre demande.")


async def peut_traiter_achats(db: AsyncSession, user: Utilisateur, da: DemandeAchat) -> bool:
    """Le Service Achats (acheteur/admin) peut toujours traiter une DA.
    Un service marqué `peut_traiter_soi_meme` (ex. Pharmacie) peut aussi traiter
    lui-même ses propres commandes — n'importe quel utilisateur de ce service,
    quel que soit son rôle de compte (pas de système multi-rôles nécessaire)."""
    if user.role in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        return True
    if not user.service or user.service != da.service_demandeur:
        return False
    result = await db.execute(select(Service).where(Service.nom == da.service_demandeur))
    service = result.scalar_one_or_none()
    return bool(service and service.peut_traiter_soi_meme)


async def _verifier_traitement(db: AsyncSession, da: DemandeAchat, user: Utilisateur):
    if da.statut != StatutDA.APPROUVEE:
        raise HTTPException(status_code=400, detail="La demande doit être approuvée pour être traitée.")
    if not await peut_traiter_achats(db, user, da):
        raise HTTPException(status_code=403, detail="Réservé au Service Achats (ou au service autorisé à traiter ses propres commandes).")


async def marquer_bc_cree(db: AsyncSession, da_id: int, user: Utilisateur) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    await _verifier_traitement(db, da, user)
    if da.bc_cree_le is not None:
        raise HTTPException(status_code=400, detail="Le bon de commande a déjà été marqué comme créé.")
    da.bc_cree_par_id = user.id
    da.bc_cree_le = datetime.utcnow()
    _ajouter_historique(db, da.id, user.id, ActionHistorique.BC_CREE)
    await db.flush()
    return await _get_da_or_404(db, da_id)


async def marquer_commande(db: AsyncSession, da_id: int, user: Utilisateur, lignes: list) -> DemandeAchat:
    """`lignes` = ce qui est réellement commandé (désignation/quantité/prix
    unitaire), saisi par le service Achats. Peut différer des lignes
    initialement demandées (ex : 1 PC demandé, 2 commandés car il en manquait
    aussi ailleurs) — c'est cette liste qui sert de base au montant dépensé."""
    da = await _get_da_or_404(db, da_id)
    await _verifier_traitement(db, da, user)
    if da.bc_cree_le is None:
        raise HTTPException(status_code=400, detail="Le bon de commande doit être créé avant de marquer la commande comme passée.")
    if da.commande_le is not None:
        raise HTTPException(status_code=400, detail="La commande a déjà été marquée comme passée.")
    if not lignes:
        raise HTTPException(status_code=400, detail="Indiquez au moins une ligne réellement commandée, avec son prix.")
    for l in lignes:
        db.add(LigneCommande(demande_id=da.id, designation=l.designation, quantite=l.quantite, prix_unitaire=l.prix_unitaire))
    da.commande_par_id = user.id
    da.commande_le = datetime.utcnow()
    _ajouter_historique(
        db, da.id, user.id, ActionHistorique.COMMANDE_PASSEE,
        f"Montant commandé : {sum(l.quantite * l.prix_unitaire for l in lignes):.2f}",
    )
    await db.flush()
    return await _get_da_or_404(db, da_id)


async def marquer_livre(db: AsyncSession, da_id: int, user: Utilisateur) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    await _verifier_traitement(db, da, user)
    if da.commande_le is None:
        raise HTTPException(status_code=400, detail="La commande doit être passée avant de marquer la livraison comme reçue.")
    if da.livre_le is not None:
        raise HTTPException(status_code=400, detail="La livraison a déjà été marquée comme reçue.")
    da.livre_par_id = user.id
    da.livre_le = datetime.utcnow()
    _ajouter_historique(db, da.id, user.id, ActionHistorique.LIVRAISON_RECUE)
    await db.flush()
    return await _get_da_or_404(db, da_id)


def peut_voir_da(user: Utilisateur, da: DemandeAchat) -> bool:
    """Même règle que pour consulter le détail d'une DA : un demandeur ne voit
    que ses propres demandes, tous les autres rôles ont une vision globale."""
    if user.role == RoleUtilisateur.DEMANDEUR:
        return da.demandeur_id == user.id
    return True


async def lister_messages(db: AsyncSession, da_id: int, user: Utilisateur) -> list[MessageDA]:
    da = await _get_da_or_404(db, da_id)
    if not peut_voir_da(user, da):
        raise HTTPException(status_code=403, detail="Accès refusé")
    return da.messages


async def _destinataires_notification(db: AsyncSession, da: DemandeAchat, exclure_id: int) -> list[int]:
    """Tout le monde pouvant voir cette DA (même règle que peut_voir_da),
    sauf l'auteur du message : le demandeur d'origine, plus responsable/DAF/
    achats/admin qui ont tous une vision globale."""
    result = await db.execute(
        select(Utilisateur.id).where(
            Utilisateur.actif == True,
            Utilisateur.id != exclure_id,
            (Utilisateur.role != RoleUtilisateur.DEMANDEUR) | (Utilisateur.id == da.demandeur_id),
        )
    )
    return [r for r in result.scalars().all()]


async def envoyer_message(db: AsyncSession, da_id: int, user: Utilisateur, texte: str) -> DemandeAchat:
    da = await _get_da_or_404(db, da_id)
    if not peut_voir_da(user, da):
        raise HTTPException(status_code=403, detail="Accès refusé")
    texte = texte.strip()
    db.add(MessageDA(demande_id=da.id, auteur_id=user.id, texte=texte))
    await db.flush()

    # Notification push (best-effort, ne doit jamais faire échouer l'envoi
    # du message si les clés VAPID ne sont pas configurées ou si un envoi
    # échoue pour un abonnement en particulier).
    try:
        from app.services.push_service import notifier_nouveau_message
        destinataires = await _destinataires_notification(db, da, user.id)
        await notifier_nouveau_message(
            db, destinataires,
            titre=f"Nouveau message : {da.numero}",
            corps=f"{user.prenom} {user.nom} : {texte[:100]}",
            url=f"/demandes/{da.id}?discussion=1",
        )
    except Exception:
        pass

    return await _get_da_or_404(db, da_id)


async def toutes_les_demandes_acheteur(db: AsyncSession) -> list[DemandeAchat]:
    """Toutes les DA — pour le Service Achats, Responsable, DAF et Admin,
    pour voir l'ensemble du circuit et où ça bloque."""
    result = await db.execute(
        select(DemandeAchat)
        .options(*_load_options())
        .order_by(DemandeAchat.date_demande.desc())
    )
    return list(result.scalars().all())


async def modifier_demande(
    db: AsyncSession, da_id: int, data: "DemandeAchatUpdate", user: Utilisateur
) -> DemandeAchat:
    """Modification permise uniquement si la DA est en brouillon ou rejetée,
    et uniquement par le demandeur d'origine ou l'admin. Une DA rejetée qui est
    modifiée repasse en brouillon pour être soumise de nouveau — le demandeur
    ne peut renvoyer qu'une seule fois après un rejet (champ deja_renvoye)."""
    from app.schemas.schemas import DemandeAchatUpdate
    da = await _get_da_or_404(db, da_id)
    if da.demandeur_id != user.id and user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Seul le demandeur peut modifier sa demande.")
    if da.statut not in (StatutDA.BROUILLON, StatutDA.REJETEE):
        raise HTTPException(
            status_code=400,
            detail="Cette demande ne peut plus être modifiée (elle est déjà en cours de validation ou traitée)."
        )
    if da.statut == StatutDA.REJETEE and da.deja_renvoye:
        raise HTTPException(
            status_code=400,
            detail="Une demande rejetée ne peut être renvoyée qu'une seule fois."
        )

    if data.service_demandeur is not None: da.service_demandeur = data.service_demandeur
    if data.poste_fonction is not None: da.poste_fonction = data.poste_fonction
    if data.motif is not None: da.motif = data.motif
    if data.urgence is not None: da.urgence = data.urgence
    if data.justification is not None: da.justification = data.justification
    if data.normes_certifications is not None: da.normes_certifications = data.normes_certifications
    if data.date_peremption_min is not None: da.date_peremption_min = data.date_peremption_min
    if data.fournisseur_suggere is not None: da.fournisseur_suggere = data.fournisseur_suggere
    if data.autres_specs is not None: da.autres_specs = data.autres_specs
    if data.lieu_utilisation is not None: da.lieu_utilisation = data.lieu_utilisation

    if data.lignes is not None:
        # Remplacer les lignes existantes
        for ligne in da.lignes:
            await db.delete(ligne)
        await db.flush()
        for i, l in enumerate(data.lignes, start=1):
            db.add(LigneDA(
                demande_id=da.id, numero_ligne=i,
                designation=l.designation, quantite=l.quantite,
                unite=l.unite or 'unité',
                observation=getattr(l, 'observation', None),
                stock_actuel=getattr(l, 'stock_actuel', None),
                reference_marque=getattr(l, 'reference_marque', None),
                description_technique=getattr(l, 'description_technique', None),
            ))

    # Si la DA était rejetée, elle repasse en brouillon pour être soumise à nouveau
    if da.statut == StatutDA.REJETEE:
        da.statut = StatutDA.BROUILLON
        _ajouter_historique(db, da.id, user.id, ActionHistorique.CREATION, "Demande modifiée après rejet")

    await db.flush()
    return await _get_da_or_404(db, da_id)
