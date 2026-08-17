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
    # Seulement pertinent pour categorie='designation' : rattache l'article à
    # un service (catalogue par service). None/absent = visible pour tous.
    service: str | None = None


def admin_only(current_user=Depends(get_current_user)):
    if current_user.role != RoleUtilisateur.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user


@router.get("/{categorie}")
async def liste(
    categorie: str, service: str | None = None,
    db: AsyncSession = Depends(get_db), _=Depends(get_current_user),
):
    """Sans `service` : toutes les valeurs de la catégorie (vue admin). Avec
    `service` : uniquement celles rattachées à ce service, plus celles sans
    service (globales) — utilisé pour filtrer les désignations par service."""
    query = select(ValeurPredéfinie).where(ValeurPredéfinie.categorie == categorie)
    if service:
        query = query.where((ValeurPredéfinie.service == service) | (ValeurPredéfinie.service.is_(None)))
    result = await db.execute(query.order_by(ValeurPredéfinie.valeur))
    return [{"id": v.id, "valeur": v.valeur, "service": v.service} for v in result.scalars().all()]


@router.post("/", status_code=201)
async def creer(data: ValeurCreate, db: AsyncSession = Depends(get_db), current_user=Depends(admin_only)):
    service = (data.service or "").strip() or None
    result = await db.execute(
        select(ValeurPredéfinie).where(
            ValeurPredéfinie.categorie == data.categorie,
            ValeurPredéfinie.valeur == data.valeur.strip(),
            ValeurPredéfinie.service == service,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cette valeur existe déjà")
    v = ValeurPredéfinie(categorie=data.categorie, valeur=data.valeur.strip(), service=service)
    db.add(v)
    await db.flush()
    return {"id": v.id, "valeur": v.valeur, "service": v.service}


@router.delete("/{valeur_id}")
async def supprimer(valeur_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(admin_only)):
    result = await db.execute(select(ValeurPredéfinie).where(ValeurPredéfinie.id == valeur_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Valeur introuvable")
    await db.delete(v)
    return {"message": "Supprimé"}
