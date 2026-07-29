import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> None:
    try:
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
        conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_STARTTLS=settings.MAIL_STARTTLS,
            MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
            USE_CREDENTIALS=True,
        )
        message = MessageSchema(subject=subject, recipients=[to], body=body, subtype="html")
        await FastMail(conf).send_message(message)
    except Exception as e:
        logger.warning("Email non envoyé vers %s : %s", to, e)


async def notifier_validateur(email: str, numero_da: str, demandeur: str, urgence: str) -> None:
    subject = f"[BIASA] Demande à valider : {numero_da}"
    body = f"<p>Bonjour,</p><p>La demande <strong>{numero_da}</strong> de {demandeur} (urgence : {urgence}) requiert votre validation.</p>"
    await send_email(email, subject, body)


async def notifier_demandeur(email: str, numero_da: str, action: str, commentaire: str = "") -> None:
    subject = f"[BIASA] Mise à jour : {numero_da}"
    body = f"<p>Bonjour,</p><p>Votre demande <strong>{numero_da}</strong> a été <strong>{action}</strong>.</p>{'<p>Commentaire : ' + commentaire + '</p>' if commentaire else ''}"
    await send_email(email, subject, body)


async def notifier_reinitialisation(email: str, username: str, lien: str) -> None:
    subject = "[BIASA] Réinitialisation de votre mot de passe"
    body = (
        f"<p>Bonjour {username},</p>"
        f"<p>Une demande de réinitialisation de mot de passe a été faite pour votre compte.</p>"
        f"<p><a href=\"{lien}\">Cliquez ici pour choisir un nouveau mot de passe</a> (valable 2 heures).</p>"
        f"<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>"
    )
    await send_email(email, subject, body)
