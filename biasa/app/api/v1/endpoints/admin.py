# biasa/app/api/v1/endpoints/admin.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import (
    Utilisateur, DemandeAchat, StatutDA, RoleUtilisateur
)
from app.schemas.schemas import DemandeAchatOut
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


@router.post("/users/{user_id}/deverrouiller")
async def deverrouiller(user_id: int, db: AsyncSession = Depends(get_db), admin_user=Depends(admin_only)):
    from app.services.user_service import deverrouiller_compte
    user = await deverrouiller_compte(db, user_id, admin_user)
    await db.commit()
    return {"message": f"Le compte {user.username} a été déverrouillé."}


@router.get("/journal-audit")
async def journal_audit(limite: int = 200, db: AsyncSession = Depends(get_db), _=Depends(admin_only)):
    from app.models.models import JournalAudit
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(JournalAudit)
        .options(selectinload(JournalAudit.utilisateur))
        .order_by(JournalAudit.date_evenement.desc())
        .limit(limite)
    )
    items = result.scalars().all()
    return [
        {
            "id": j.id,
            "username_saisi": j.username_saisi,
            "evenement": j.evenement,
            "details": j.details,
            "date_evenement": j.date_evenement,
            "utilisateur_nom": f"{j.utilisateur.prenom} {j.utilisateur.nom}".strip() if j.utilisateur else None,
        }
        for j in items
    ]
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
    """Sauvegarde la config email dans le fichier .env"""
    import os
    env_path = os.path.join(os.path.dirname(__file__), '../../../../.env')
    
    with open(env_path, 'r') as f:
        lines = f.readlines()
    
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
    
    with open(env_path, 'w') as f:
        f.writelines(new_lines)
    
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
