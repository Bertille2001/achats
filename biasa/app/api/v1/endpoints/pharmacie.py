# biasa/app/api/v1/endpoints/pharmacie.py
# Suivi simple des retraits (sorties) de produits par les services à la
# pharmacie de la clinique. Volontairement léger : pas de circuit de
# validation, pas de gestion du stock disponible — juste un enregistrement
# de "qui a pris quoi, quand" pour pouvoir analyser la consommation par
# service (par jour, par mois...) sur la page Pharmacie du frontend.
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import SortiePharmacie, LigneSortiePharmacie, RoleUtilisateur
from app.schemas.schemas import SortiePharmacieCreate, SortiePharmacieOut

router = APIRouter(prefix="/pharmacie", tags=["Pharmacie"])


def acces_pharmacie(current_user=Depends(get_current_user)):
    # Même équipe que celle qui gère déjà les achats/le circuit d'approvisionnement,
    # plus l'admin — pas de rôle dédié pour rester simple.
    if current_user.role not in (RoleUtilisateur.ACHETEUR, RoleUtilisateur.ADMIN):
        raise HTTPException(status_code=403, detail="Réservé au Service Achats / Pharmacie")
    return current_user


def _options():
    return (selectinload(SortiePharmacie.enregistre_par), selectinload(SortiePharmacie.lignes))


@router.get("/sorties", response_model=list[SortiePharmacieOut])
async def lister_sorties(db: AsyncSession = Depends(get_db), _=Depends(acces_pharmacie)):
    result = await db.execute(
        select(SortiePharmacie).options(*_options()).order_by(SortiePharmacie.date_sortie.desc())
    )
    return list(result.scalars().all())


@router.post("/sorties", response_model=SortiePharmacieOut, status_code=201)
async def creer_sortie(
    data: SortiePharmacieCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(acces_pharmacie),
):
    sortie = SortiePharmacie(
        date_sortie=data.date_sortie or datetime.utcnow(),
        service=data.service.strip(),
        commentaire=data.commentaire,
        enregistre_par_id=current_user.id,
        lignes=[
            LigneSortiePharmacie(produit=l.produit.strip(), quantite=l.quantite, unite=l.unite)
            for l in data.lignes
        ],
    )
    db.add(sortie)
    await db.flush()
    result = await db.execute(
        select(SortiePharmacie).options(*_options()).where(SortiePharmacie.id == sortie.id)
    )
    return result.scalar_one()


@router.delete("/sorties/{sortie_id}")
async def supprimer_sortie(
    sortie_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(acces_pharmacie),
):
    # Corrige une erreur de saisie (mauvais service, doublon...). Pas de
    # restriction supplémentaire au-delà de l'accès pharmacie : c'est un
    # simple journal, pas un document validé qu'il faudrait figer.
    result = await db.execute(select(SortiePharmacie).where(SortiePharmacie.id == sortie_id))
    sortie = result.scalar_one_or_none()
    if not sortie:
        raise HTTPException(status_code=404, detail="Sortie introuvable")
    await db.delete(sortie)
    return {"message": "Sortie supprimée"}
