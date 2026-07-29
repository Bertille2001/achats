from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./uploads"
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_PORT: int = 587
    MAIL_SERVER: str = ""
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # Notifications push navigateur (Web Push / VAPID). Vides par défaut :
    # tant qu'elles ne sont pas configurées, les notifications sont
    # simplement désactivées (aucune erreur), voir generate_vapid_keys.py.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY_PATH: str = "./vapid_private_key.pem"
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@biasa.local"

    class Config:
        env_file = ".env"


settings = Settings()
UPLOAD_PATH = Path(settings.UPLOAD_DIR)
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
