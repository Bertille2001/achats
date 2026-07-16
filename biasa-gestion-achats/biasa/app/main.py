import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.db.session import engine, Base

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Clinique BIASA — Gestion des achats",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def creer_tables_si_absentes():
    # Filet de securite : il n'y a pas encore de migration Alembic dans ce
    # projet (dossier alembic/versions vide), donc rien ne cree les tables
    # automatiquement au deploiement. create_all() est sans danger : elle ne
    # touche jamais aux tables deja existantes, elle cree seulement celles
    # qui manquent (utile pour le tout premier demarrage sur une base vide).
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        logger.exception("Impossible de verifier/creer les tables au demarrage")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Clinique BIASA — Achats"}
