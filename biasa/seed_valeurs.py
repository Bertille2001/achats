"""Insère les listes de services et de postes prédéfinis dans la table
valeurs_predefinies, pour qu'ils apparaissent tout de suite dans les
suggestions (autocomplétion) du formulaire de demande d'achat et dans la
page Paramètres — sans attendre qu'ils soient saisis manuellement une
première fois.

À exécuter UNE FOIS sur le serveur, depuis le dossier biasa/ :

    source venv/bin/activate   # ou l'environnement utilisé
    python seed_valeurs.py

Peut être relancé sans risque : les valeurs déjà présentes sont ignorées.
"""
import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import ValeurPredéfinie

SERVICES = [
    "Bloc opératoire et salle d'Endoscopie",
    "Centre de Fertilité",
    "Comptabilité",
    "Contrôle de gestion",
    "Gynecologie-obstétrique et Maternité",
    "Hospitalisation Adultes et Soins à Domicile",
    "Imagerie Médicale",
    "Laboratoire de Biologie Médicales",
    "Moyens Généraux",
    "Pédiatrie et Néonatologie",
    "Pharmacie",
    "Bilan de santé et Services Interentreprises",
    "Service des ressources humaines",
    "Service informatique",
    "Service Portes Consultations et soins externes",
    "Urgences et Soins Intensifs",
]

POSTES = [
    "Agent de propreté",
    "Agent de sécurité",
    "Aide-comptable",
    "Aide-soignant",
    "Archiviste",
    "Auxilliaire de Pharmacie",
    "Blanchisseur",
    "Cadre administratif",
    "Caissière principale",
    "Chauffeur",
    "Chef Comptable",
    "Chef division facturation",
    "Chef division recouvrement",
    "Comptable",
    "Contrôleur de gestion",
    "Chargé de communication",
    "Cuisinier",
    "Directeur Administratif et Financier",
    "Directeur Financier et Comptable",
    "Agent de facturation",
    "Gestionnaire des ressources humaines",
    "IDE",
    "Infirmier Auxilliaire",
    "Infirmier-Assistant en Santé Sécurité au Travail",
    "ARM UF bilan de santé et services inter entreprises",
    "Informaticien",
    "ITAMB",
    "Kinésithérapeute",
    "Médecin spécialiste",
    "Médecin généraliste",
    "Nutritionniste diététicienne",
    "Pharmacienne",
    "Responsable du Magasin",
    "Responsable Hygiène et Assainissement",
    "Sage-femme d'Etat",
    "Secrétaire",
    "Secrétaire-Hôtesse",
    "Standardiste",
    "Technicien Biomedical",
    "Technicien Polyvalent",
    "TSAMB",
    "TSAR",
    "TSRIM",
]


async def inserer(db, categorie: str, valeurs: list[str]) -> tuple[int, int]:
    ajoutes, ignores = 0, 0
    for v in valeurs:
        v = v.strip()
        if not v:
            continue
        existe = await db.execute(
            select(ValeurPredéfinie).where(
                ValeurPredéfinie.categorie == categorie,
                ValeurPredéfinie.valeur == v,
            )
        )
        if existe.scalar_one_or_none():
            ignores += 1
            continue
        db.add(ValeurPredéfinie(categorie=categorie, valeur=v))
        ajoutes += 1
    return ajoutes, ignores


async def main():
    async with AsyncSessionLocal() as db:
        a1, i1 = await inserer(db, 'service', SERVICES)
        a2, i2 = await inserer(db, 'poste', POSTES)
        await db.commit()
        print(f"Services : {a1} ajoutés, {i1} déjà présents.")
        print(f"Postes   : {a2} ajoutés, {i2} déjà présents.")


if __name__ == '__main__':
    asyncio.run(main())
