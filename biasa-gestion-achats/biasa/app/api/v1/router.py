# biasa/app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1.endpoints import auth, demandes, users, autocomplete, parametres, admin

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(demandes.router)
api_router.include_router(users.router)
api_router.include_router(autocomplete.router)
api_router.include_router(parametres.router)
api_router.include_router(admin.router)
