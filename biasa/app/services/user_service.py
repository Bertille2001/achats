import secrets
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.models import Utilisateur, JournalAudit, RoleUtilisateur
from app.schemas.schemas import UtilisateurCreate
from app.core.security import hash_password, verify_password

MAX_TENTATIVES = 5
DUREE_VERROUILLAGE_MIN = 15


async def get_user_by_id(db: AsyncSession, user_id: int) -> Utilisateur | None:
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Utilisateur | None:
    result = await db.execute(select(Utilisateur).where(Utilisateur.username == username))
    return result.scalar_one_or_none()


async def get_admins(db: AsyncSession) -> list[Utilisateur]:
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.role == RoleUtilisateur.ADMIN, Utilisateur.actif == True)  # noqa: E712
    )
    return list(result.scalars().all())


def _log(db: AsyncSession, evenement: str, *, user: Utilisateur | None = None, username_saisi: str | None = None, details: str | None = None):
    db.add(JournalAudit(
        utilisateur_id=user.id if user else None,
        username_saisi=username_saisi or (user.username if user else None),
        evenement=evenement,
        details=details,
    ))


async def create_user(db: AsyncSession, data: UtilisateurCreate) -> Utilisateur:
    user = Utilisateur(
        nom=data.nom, prenom=data.prenom, username=data.username, email=data.email,
        mot_de_passe=hash_password(data.mot_de_passe),
        poste=data.poste, service=data.service, role=data.role,
        doit_changer_mdp=True,  # mot de passe fixé par l'admin = provisoire, à changer à la 1ère connexion
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Utilisateur:
    """Lève une HTTPException avec un message adapté (compte verrouillé, inactif,
    identifiants invalides) plutôt que de renvoyer None, pour distinguer les cas
    côté frontend et journaliser précisément l'événement."""
    user = await get_user_by_username(db, username)

    if not user:
        _log(db, "connexion_echouee", username_saisi=username, details="utilisateur inconnu")
        await db.commit()
        raise HTTPException(status_code=401, detail="Nom d'utilisateur ou mot de passe incorrect")

    if not user.actif:
        _log(db, "connexion_echouee", user=user, details="compte désactivé")
        await db.commit()
        raise HTTPException(status_code=403, detail="Ce compte a été désactivé.")

    if user.verrouille_jusqua and user.verrouille_jusqua > datetime.utcnow():
        minutes = max(1, int((user.verrouille_jusqua - datetime.utcnow()).total_seconds() // 60) + 1)
        _log(db, "connexion_echouee", user=user, details="compte verrouillé")
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Compte temporairement verrouillé. Réessayez dans {minutes} min, ou contactez un administrateur.")

    if not verify_password(password, user.mot_de_passe):
        user.tentatives_echouees += 1
        if user.tentatives_echouees >= MAX_TENTATIVES:
            user.verrouille_jusqua = datetime.utcnow() + timedelta(minutes=DUREE_VERROUILLAGE_MIN)
            _log(db, "compte_verrouille", user=user, details=f"après {user.tentatives_echouees} échecs")
        else:
            _log(db, "connexion_echouee", user=user, details=f"mot de passe incorrect ({user.tentatives_echouees}/{MAX_TENTATIVES})")
        await db.commit()
        raise HTTPException(status_code=401, detail="Nom d'utilisateur ou mot de passe incorrect")

    # Succès : on réinitialise le compteur
    user.tentatives_echouees = 0
    user.verrouille_jusqua = None
    _log(db, "connexion_reussie", user=user)
    await db.flush()
    return user


async def deverrouiller_compte(db: AsyncSession, user_id: int, admin: Utilisateur) -> Utilisateur:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.tentatives_echouees = 0
    user.verrouille_jusqua = None
    _log(db, "deverrouillage", user=user, details=f"par {admin.username}")
    await db.flush()
    return user


async def changer_mot_de_passe(db: AsyncSession, user: Utilisateur, ancien: str | None, nouveau: str) -> None:
    if not user.doit_changer_mdp:
        if not ancien or not verify_password(ancien, user.mot_de_passe):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
    user.mot_de_passe = hash_password(nouveau)
    user.doit_changer_mdp = False
    _log(db, "changement_mdp", user=user)
    await db.flush()


async def definir_code_signature(db: AsyncSession, user: Utilisateur, mot_de_passe: str, nouveau_code: str) -> None:
    # Le mot de passe de connexion est redemandé une fois ici pour confirmer
    # l'identité avant de créer/changer le code — ensuite, c'est ce code
    # (et lui seul) qui sera redemandé à chaque validation/rejet.
    if not verify_password(mot_de_passe, user.mot_de_passe):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect.")
    user.code_signature = hash_password(nouveau_code)
    _log(db, "definition_code_signature", user=user)
    await db.flush()


async def demander_reinitialisation(db: AsyncSession, username: str) -> tuple[Utilisateur, str] | None:
    user = await get_user_by_username(db, username)
    if not user or not user.actif:
        return None
    jeton = secrets.token_urlsafe(32)
    user.jeton_reinitialisation = jeton
    user.jeton_expire_le = datetime.utcnow() + timedelta(hours=2)
    _log(db, "demande_reinitialisation_mdp", user=user)
    await db.flush()
    return user, jeton


async def reinitialiser_mot_de_passe(db: AsyncSession, jeton: str, nouveau: str) -> Utilisateur:
    result = await db.execute(select(Utilisateur).where(Utilisateur.jeton_reinitialisation == jeton))
    user = result.scalar_one_or_none()
    if not user or not user.jeton_expire_le or user.jeton_expire_le < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")
    user.mot_de_passe = hash_password(nouveau)
    user.doit_changer_mdp = False
    user.jeton_reinitialisation = None
    user.jeton_expire_le = None
    user.tentatives_echouees = 0
    user.verrouille_jusqua = None
    _log(db, "reinitialisation_mdp", user=user)
    await db.flush()
    return user
