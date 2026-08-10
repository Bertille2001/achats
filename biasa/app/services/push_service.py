"""Envoi de notifications push navigateur (Web Push / VAPID) quand un nouveau
message arrive sur une demande d'achat. Fonctionnalité entièrement optionnelle
et silencieuse : tant que les clés VAPID ne sont pas générées côté serveur
(voir generate_vapid_keys.py à la racine de biasa/), rien n'est envoyé et
aucune erreur n'est levée — l'envoi du message lui-même n'est jamais
bloqué par un souci de notification."""
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import AbonnementNotification

logger = logging.getLogger(__name__)


async def envoyer_notification_push(db: AsyncSession, destinataires_ids: list[int], titre: str, corps: str, url: str) -> None:
    if not settings.VAPID_PUBLIC_KEY or not destinataires_ids:
        return
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush n'est pas installé : notifications push ignorées.")
        return

    result = await db.execute(
        select(AbonnementNotification).where(AbonnementNotification.utilisateur_id.in_(destinataires_ids))
    )
    abonnements = list(result.scalars().all())
    if not abonnements:
        return

    payload = json.dumps({"title": titre, "body": corps, "url": url})

    for abo in abonnements:
        try:
            webpush(
                subscription_info={
                    "endpoint": abo.endpoint,
                    "keys": {"p256dh": abo.p256dh, "auth": abo.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY_PATH,
                vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            # Abonnement expiré/révoqué côté navigateur (l'utilisateur a
            # désinstallé, changé de navigateur...) : on le retire plutôt que
            # de réessayer indéfiniment contre un endpoint mort.
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                await db.delete(abo)
            else:
                logger.warning("Echec envoi notification push (%s) : %s", status, e)
        except Exception:
            logger.exception("Erreur inattendue lors de l'envoi d'une notification push")

    await db.flush()


async def notifier_nouveau_message(db: AsyncSession, destinataires_ids: list[int], titre: str, corps: str, url: str) -> None:
    await envoyer_notification_push(db, destinataires_ids, titre, corps, url)


async def notifier_admin_mdp_oublie(db: AsyncSession, admin_ids: list[int], nom_complet: str, username: str) -> None:
    await envoyer_notification_push(
        db, admin_ids,
        "Mot de passe oublié",
        f"{nom_complet} ({username}) a demandé une réinitialisation de mot de passe.",
        "/gestion-users",
    )
