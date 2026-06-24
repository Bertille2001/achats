import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.schemas import (
    LoginRequest, TokenOut, UtilisateurCreate, UtilisateurOut,
    ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services.user_service import (
    authenticate_user, create_user, get_user_by_username,
    changer_mot_de_passe, demander_reinitialisation, reinitialiser_mot_de_passe,
)
from app.services.mail_service import notifier_reinitialisation
from app.core.security import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/login", response_model=TokenOut)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.username, data.mot_de_passe)
    await db.commit()
    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token, utilisateur=UtilisateurOut.model_validate(user))


@router.post("/register", response_model=UtilisateurOut, status_code=201)
async def register(data: UtilisateurCreate, db: AsyncSession = Depends(get_db)):
    if await get_user_by_username(db, data.username):
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà utilisé")
    user = await create_user(db, data)
    return UtilisateurOut.model_validate(user)


@router.get("/me", response_model=UtilisateurOut)
async def me(current_user=Depends(get_current_user)):
    return UtilisateurOut.model_validate(current_user)


@router.post("/change-password", response_model=UtilisateurOut)
async def change_password(data: ChangePasswordRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    await changer_mot_de_passe(db, current_user, data.ancien_mot_de_passe, data.nouveau_mot_de_passe)
    await db.commit()
    return UtilisateurOut.model_validate(current_user)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    resultat = await demander_reinitialisation(db, data.username)
    await db.commit()
    # Réponse volontairement identique que le compte existe ou non, et qu'il ait
    # un email ou pas — on ne révèle jamais quels comptes existent.
    if resultat:
        user, jeton = resultat
        if user.email:
            lien = f"/reinitialiser-mot-de-passe?jeton={jeton}"

            async def envoyer():
                try:
                    await notifier_reinitialisation(user.email, user.username, lien)
                except Exception:
                    pass
            asyncio.create_task(envoyer())
    return {"message": "Si ce compte existe et possède un email enregistré, un lien de réinitialisation vient d'y être envoyé. Sinon, contactez un administrateur."}


@router.post("/reset-password", response_model=UtilisateurOut)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await reinitialiser_mot_de_passe(db, data.jeton, data.nouveau_mot_de_passe)
    await db.commit()
    return UtilisateurOut.model_validate(user)
