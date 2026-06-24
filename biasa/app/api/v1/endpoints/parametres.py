from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import get_db, Base
from app.core.security import get_current_user
from app.models.models import RoleUtilisateur
from app.models.models import ValeurPredéfinie
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/parametres", tags=["Paramètres"])




class ValeurCreate(BaseModel):
    categorie: str
    valeur: str


def admin_only(current_user=Depends(get_current_user)):
    if current_user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user


@router.get("/{categorie}")
async def liste(categorie: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(ValeurPredéfinie)
        .where(ValeurPredéfinie.categorie == categorie)
        .order_by(ValeurPredéfinie.valeur)
    )
    return [{"id": v.id, "valeur": v.valeur} for v in result.scalars().all()]


@router.post("/", status_code=201)
async def creer(data: ValeurCreate, db: AsyncSession = Depends(get_db), current_user=Depends(admin_only)):
    result = await db.execute(
        select(ValeurPredéfinie).where(
            ValeurPredéfinie.categorie == data.categorie,
            ValeurPredéfinie.valeur == data.valeur.strip()
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cette valeur existe déjà")
    v = ValeurPredéfinie(categorie=data.categorie, valeur=data.valeur.strip())
    db.add(v)
    await db.flush()
    return {"id": v.id, "valeur": v.valeur}


@router.delete("/{valeur_id}")
async def supprimer(valeur_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(admin_only)):
    result = await db.execute(select(ValeurPredéfinie).where(ValeurPredéfinie.id == valeur_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Valeur introuvable")
    await db.delete(v)
    return {"message": "Supprimé"}
