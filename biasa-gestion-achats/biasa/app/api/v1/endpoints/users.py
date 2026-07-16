# biasa/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import Utilisateur, RoleUtilisateur
from app.schemas.schemas import UtilisateurCreate, UtilisateurOut
from app.services.user_service import create_user, get_user_by_username
from app.core.security import hash_password
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter(prefix="/users", tags=["Utilisateurs"])


def admin_only(current_user=Depends(get_current_user)):
    if current_user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user


class UtilisateurUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    poste: Optional[str] = None
    service: Optional[str] = None
    role: Optional[RoleUtilisateur] = None
    actif: Optional[bool] = None
    mot_de_passe: Optional[str] = None


@router.get("/", response_model=list[UtilisateurOut])
async def liste_users(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_only),
):
    result = await db.execute(select(Utilisateur).order_by(Utilisateur.nom))
    return list(result.scalars().all())


@router.post("/", response_model=UtilisateurOut, status_code=201)
async def creer_user(
    data: UtilisateurCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_only),
):
    if await get_user_by_username(db, data.username):
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà utilisé")
    return await create_user(db, data)


@router.patch("/{user_id}", response_model=UtilisateurOut)
async def modifier_user(
    user_id: int,
    data: UtilisateurUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_only),
):
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    for field, value in data.model_dump(exclude_none=True).items():
        if field == 'mot_de_passe':
            setattr(user, field, hash_password(value))
        else:
            setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}")
async def desactiver_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_only),
):
    result = await db.execute(select(Utilisateur).where(Utilisateur.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous désactiver vous-même")
    user.actif = False
    await db.flush()
    return {"message": f"Utilisateur {user.username} désactivé"}
