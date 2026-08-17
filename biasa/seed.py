import asyncio
from app.db.session import engine, Base, AsyncSessionLocal
from app.models.models import Utilisateur, RoleUtilisateur
from app.core.security import hash_password

COMPTES_TEST = [
    {"nom": "Bertille", "prenom": "", "username": "bertille", "email": None, "mot_de_passe": "biasa2026", "poste": "Infirmier chef", "service": "Urgences", "role": RoleUtilisateur.DEMANDEUR},
    {"nom": "Komi", "prenom": "", "username": "komi", "email": None, "mot_de_passe": "biasa2026", "poste": "Médecin responsable", "service": "Urgences", "role": RoleUtilisateur.RESPONSABLE},
    {"nom": "Théophile", "prenom": "", "username": "theophile", "email": None, "mot_de_passe": "biasa2026", "poste": "Directeur des Opérations et Services (DOS)", "service": "Direction", "role": RoleUtilisateur.DAF},
    {"nom": "Moïse", "prenom": "", "username": "moise", "email": None, "mot_de_passe": "biasa2026", "poste": "Acheteur", "service": "Achats", "role": RoleUtilisateur.ACHETEUR},
    {"nom": "Mable", "prenom": "", "username": "mable", "email": None, "mot_de_passe": "biasa2026", "poste": "Administrateur", "service": "IT", "role": RoleUtilisateur.ADMIN},
]


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables créées.")
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        for compte in COMPTES_TEST:
            existing = await db.execute(select(Utilisateur).where(Utilisateur.username == compte["username"]))
            if existing.scalar_one_or_none():
                print(f"  Existe déjà : {compte['username']}")
                continue
            user = Utilisateur(
                nom=compte["nom"], prenom=compte["prenom"], username=compte["username"], email=compte["email"],
                mot_de_passe=hash_password(compte["mot_de_passe"]),
                poste=compte["poste"], service=compte["service"], role=compte["role"],
                doit_changer_mdp=False,  # comptes de démo : pas de changement forcé, contrairement aux comptes créés via Administration
            )
            db.add(user)
            print(f"  Créé : {compte['username']} [{compte['role'].value}]")
        await db.commit()
    print("\nComptes de test (mot de passe : biasa2026) :")
    for c in COMPTES_TEST:
        print(f"  {c['username']:15s} → {c['role'].value}")


if __name__ == "__main__":
    asyncio.run(init_db())
