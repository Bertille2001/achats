import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.schemas import (
    LoginRequest, TokenOut, UtilisateurCreate, UtilisateurOut,
    ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services.user_service import (
    authenticate_user, create_user, get_user_by_username, get_admins,
    changer_mot_de_passe, demander_reinitialisation, reinitialiser_mot_de_passe,
)
from app.services.mail_service import notifier_reinitialisation, notifier_admin_reinitialisation
from app.services.push_service import notifier_admin_mdp_oublie
from app.core.security import create_access_token, get_current_user
from app.models.models import RoleUtilisateur

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
    # Sécurité : l'auto-inscription publique ne doit jamais pouvoir créer un
    # compte avec un rôle privilégié (admin, DAF, responsable, acheteur) —
    # on ignore systématiquement le rôle envoyé par le client. Les rôles
    # privilégiés ne sont attribués que par un administrateur (POST /users/).
    data.role = RoleUtilisateur.DEMANDEUR
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
        a_recu_lien = bool(user.email)
        if user.email:
            lien = f"/reinitialiser-mot-de-passe?jeton={jeton}"

            async def envoyer():
                try:
                    await notifier_reinitialisation(user.email, user.username, lien)
                except Exception:
                    pass
            asyncio.create_task(envoyer())

        # Dans tous les cas, on prévient les administrateurs (email + notification
        # push) : l'appli est interne et beaucoup d'agents n'ont pas d'email
        # configuré, donc l'admin doit pouvoir réinitialiser manuellement.
        nom_complet = f"{user.prenom} {user.nom}".strip() or user.username
        admins = await get_admins(db)
        for admin in admins:
            if admin.email:
                async def envoyer_admin(email=admin.email):
                    try:
                        await notifier_admin_reinitialisation(email, user.username, nom_complet, a_recu_lien)
                    except Exception:
                        pass
                asyncio.create_task(envoyer_admin())
        try:
            await notifier_admin_mdp_oublie(db, [a.id for a in admins], nom_complet, user.username)
            await db.commit()
        except Exception:
            pass
    return {"message": "Si ce compte existe, un administrateur a été prévenu et pourra vous aider à réinitialiser votre mot de passe. Un lien vous a aussi été envoyé par email si un email est enregistré sur votre compte."}


@router.post("/reset-password", response_model=UtilisateurOut)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await reinitialiser_mot_de_passe(db, data.jeton, data.nouveau_mot_de_passe)
    await db.commit()
    return UtilisateurOut.model_validate(user)
