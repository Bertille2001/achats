# biasa/app/api/v1/endpoints/notifications.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.models import AbonnementNotification
from app.schemas.schemas import AbonnementNotificationCreate

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/cle-publique")
async def cle_publique():
    """Clé publique VAPID nécessaire au navigateur pour s'abonner aux
    notifications push. Vide tant que les clés n'ont pas été générées côté
    serveur — dans ce cas le frontend désactive simplement la fonctionnalité."""
    return {"cle_publique": settings.VAPID_PUBLIC_KEY}


@router.post("/abonnement", status_code=201)
async def s_abonner(data: AbonnementNotificationCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(AbonnementNotification).where(AbonnementNotification.endpoint == data.endpoint))
    abo = result.scalar_one_or_none()
    if abo:
        abo.utilisateur_id = current_user.id
        abo.p256dh = data.p256dh
        abo.auth = data.auth
    else:
        db.add(AbonnementNotification(
            utilisateur_id=current_user.id, endpoint=data.endpoint, p256dh=data.p256dh, auth=data.auth,
        ))
    await db.flush()
    return {"message": "Abonnement enregistré"}


@router.delete("/abonnement")
async def se_desabonner(endpoint: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(AbonnementNotification).where(
            AbonnementNotification.endpoint == endpoint,
            AbonnementNotification.utilisateur_id == current_user.id,
        )
    )
    abo = result.scalar_one_or_none()
    if abo:
        await db.delete(abo)
        await db.flush()
    return {"message": "Désabonné"}
