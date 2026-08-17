# biasa/app/api/v1/endpoints/autocomplete.py
# Retourne les valeurs déjà saisies pour l'autocomplétion
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import DemandeAchat, Utilisateur, ValeurPredéfinie

router = APIRouter(prefix="/autocomplete", tags=["Autocomplétion"])


async def _valeurs_predefinies(db: AsyncSession, categorie: str, service: str | None = None) -> set[str]:
    query = select(ValeurPredéfinie.valeur).where(ValeurPredéfinie.categorie == categorie)
    if service:
        query = query.where((ValeurPredéfinie.service == service) | (ValeurPredéfinie.service.is_(None)))
    r = await db.execute(query)
    return set(r.scalars().all())


@router.get("/services")
async def services(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Liste des services : celle prédéfinie par l'admin (Paramètres) en
    priorité, complétée par tout service déjà utilisé dans les demandes ou
    les comptes utilisateurs (au cas où un service ait été saisi librement
    avant d'être ajouté aux valeurs prédéfinies)."""
    r1 = await db.execute(select(distinct(DemandeAchat.service_demandeur)).where(DemandeAchat.service_demandeur != None))
    r2 = await db.execute(select(distinct(Utilisateur.service)).where(Utilisateur.service != None))
    predefinis = await _valeurs_predefinies(db, 'service')
    vals = set(r1.scalars().all()) | set(r2.scalars().all()) | predefinis
    return sorted([v for v in vals if v])


@router.get("/postes")
async def postes(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Tous les postes : valeurs prédéfinies par l'admin + déjà utilisés."""
    r1 = await db.execute(select(distinct(DemandeAchat.poste_fonction)).where(DemandeAchat.poste_fonction != None))
    r2 = await db.execute(select(distinct(Utilisateur.poste)).where(Utilisateur.poste != None))
    predefinis = await _valeurs_predefinies(db, 'poste')
    vals = set(r1.scalars().all()) | set(r2.scalars().all()) | predefinis
    return sorted([v for v in vals if v])


@router.get("/fournisseurs")
async def fournisseurs(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(distinct(DemandeAchat.fournisseur_suggere)).where(DemandeAchat.fournisseur_suggere != None))
    predefinis = await _valeurs_predefinies(db, 'fournisseur')
    vals = set(r.scalars().all()) | predefinis
    return sorted([v for v in vals if v])


@router.get("/normes")
async def normes(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(distinct(DemandeAchat.normes_certifications)).where(DemandeAchat.normes_certifications != None))
    predefinis = await _valeurs_predefinies(db, 'norme')
    vals = set(r.scalars().all()) | predefinis
    return sorted([v for v in vals if v])


@router.get("/lieux")
async def lieux(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Le lieu d'utilisation réutilise directement la liste des services
    (bloc opératoire, urgences, etc. sont déjà des services) — pas besoin
    d'entretenir une deuxième liste séparée."""
    return await services(db=db)


@router.get("/designations")
async def designations(service: str | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Sans `service` (rôles à vision globale : DOS, responsable, achats,
    admin...) : toutes les désignations, tous services confondus. Avec
    `service` (typiquement un demandeur) : catalogue de ce service, plus les
    désignations déjà utilisées dans les demandes de ce service, plus les
    valeurs globales (sans service précis)."""
    from app.models.models import LigneDA, DemandeAchat
    predefinis = await _valeurs_predefinies(db, 'designation', service)
    if service:
        r = await db.execute(
            select(distinct(LigneDA.designation))
            .join(DemandeAchat, LigneDA.demande_id == DemandeAchat.id)
            .where(LigneDA.designation != None, DemandeAchat.service_demandeur == service)
        )
    else:
        r = await db.execute(select(distinct(LigneDA.designation)).where(LigneDA.designation != None))
    vals = set(r.scalars().all()) | predefinis
    return sorted([v for v in vals if v])


@router.get("/unites")
async def unites(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.models.models import LigneDA
    r = await db.execute(select(distinct(LigneDA.unite)).where(LigneDA.unite != None))
    predefinis = await _valeurs_predefinies(db, 'unite')
    vals = set(r.scalars().all()) | predefinis
    return sorted([v for v in vals if v])
