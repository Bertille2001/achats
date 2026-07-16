# biasa/app/api/v1/endpoints/autocomplete.py
# Retourne les valeurs déjà saisies pour l'autocomplétion
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import DemandeAchat, Utilisateur

router = APIRouter(prefix="/autocomplete", tags=["Autocomplétion"])


@router.get("/services")
async def services(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Tous les services déjà utilisés dans les demandes et les utilisateurs."""
    r1 = await db.execute(select(distinct(DemandeAchat.service_demandeur)).where(DemandeAchat.service_demandeur != None))
    r2 = await db.execute(select(distinct(Utilisateur.service)).where(Utilisateur.service != None))
    vals = set(r1.scalars().all()) | set(r2.scalars().all())
    return sorted([v for v in vals if v])


@router.get("/postes")
async def postes(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Tous les postes déjà utilisés."""
    r1 = await db.execute(select(distinct(DemandeAchat.poste_fonction)).where(DemandeAchat.poste_fonction != None))
    r2 = await db.execute(select(distinct(Utilisateur.poste)).where(Utilisateur.poste != None))
    vals = set(r1.scalars().all()) | set(r2.scalars().all())
    return sorted([v for v in vals if v])


@router.get("/fournisseurs")
async def fournisseurs(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(distinct(DemandeAchat.fournisseur_suggere)).where(DemandeAchat.fournisseur_suggere != None))
    return sorted([v for v in r.scalars().all() if v])


@router.get("/normes")
async def normes(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(distinct(DemandeAchat.normes_certifications)).where(DemandeAchat.normes_certifications != None))
    return sorted([v for v in r.scalars().all() if v])


@router.get("/lieux")
async def lieux(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(distinct(DemandeAchat.lieu_utilisation)).where(DemandeAchat.lieu_utilisation != None))
    return sorted([v for v in r.scalars().all() if v])


@router.get("/designations")
async def designations(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.models.models import LigneDA
    r = await db.execute(select(distinct(LigneDA.designation)).where(LigneDA.designation != None))
    return sorted([v for v in r.scalars().all() if v])


@router.get("/unites")
async def unites(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.models.models import LigneDA
    r = await db.execute(select(distinct(LigneDA.unite)).where(LigneDA.unite != None))
    return sorted([v for v in r.scalars().all() if v])
