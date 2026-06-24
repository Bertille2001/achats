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
    StatutDA, ActionHistorique, RoleUtilisateur, Utilisateur
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
      result = await db.execute(
        select(DemandeAchat)
        .where(DemandeAchat.statut.in_([StatutDA.APPROUVEE, StatutDA.RECUE]))
        .options(*_load_options())
        .order_by(DemandeAchat.date_demande.desc())
    )
      return list(result.scalars().all())
    else:
        return []
    result = await db.execute(
        select(DemandeAchat).where(DemandeAchat.statut == statut_cible)
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
    if user.role not in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Téléchargement réservé au service Achats")
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
