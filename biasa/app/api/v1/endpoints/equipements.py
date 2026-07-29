# biasa/app/api/v1/endpoints/equipements.py
"""Registre des équipements achetés et déployés : caractéristiques
(référence/n° de série), lieu d'utilisation, responsable et état. Permet de
répertorier tout ce que la clinique a payé et où c'est utilisé, indépendamment
du circuit de validation de la demande d'achat d'origine."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import Equipement, RoleUtilisateur
from app.schemas.schemas import EquipementCreate, EquipementUpdate, EquipementOut

router = APIRouter(prefix="/equipements", tags=["Équipements"])


def _lecture_autorisee(user):
    """Même vision globale que le reste du circuit achats : demandeur exclu
    (il n'a pas besoin de voir le parc entier), tous les autres rôles oui."""
    if user.role == RoleUtilisateur.DEMANDEUR:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return user


def _ecriture_autorisee(user):
    if user.role not in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Réservé au service Achats")
    return user


def _options():
    return [selectinload(Equipement.ajoute_par)]


@router.get("/", response_model=list[EquipementOut])
async def lister(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    _lecture_autorisee(current_user)
    result = await db.execute(
        select(Equipement).options(*_options()).order_by(Equipement.cree_le.desc())
    )
    return list(result.scalars().all())


@router.post("/", response_model=EquipementOut, status_code=201)
async def creer(data: EquipementCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    _ecriture_autorisee(current_user)
    equip = Equipement(**data.model_dump(), ajoute_par_id=current_user.id)
    db.add(equip)
    await db.flush()
    result = await db.execute(select(Equipement).where(Equipement.id == equip.id).options(*_options()))
    return result.scalar_one()


@router.patch("/{equipement_id}", response_model=EquipementOut)
async def modifier(equipement_id: int, data: EquipementUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    _ecriture_autorisee(current_user)
    result = await db.execute(select(Equipement).where(Equipement.id == equipement_id).options(*_options()))
    equip = result.scalar_one_or_none()
    if not equip:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(equip, field, value)
    await db.flush()
    result = await db.execute(select(Equipement).where(Equipement.id == equipement_id).options(*_options()))
    return result.scalar_one()


@router.delete("/{equipement_id}")
async def supprimer(equipement_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    _ecriture_autorisee(current_user)
    result = await db.execute(select(Equipement).where(Equipement.id == equipement_id))
    equip = result.scalar_one_or_none()
    if not equip:
        raise HTTPException(status_code=404, detail="Équipement introuvable")
    await db.delete(equip)
    await db.flush()
    return {"message": "Équipement supprimé"}
