"""
Crée des demandes d'achat de démonstration à différents stades du circuit,
pour voir tout de suite à quoi ressemble l'application sans tout ressaisir
à la main. À lancer après seed.py (qui crée les comptes).

Usage :
    python seed_demo.py
"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.models import Utilisateur, DemandeAchat, LigneDA, HistoriqueValidation, TypeDA, NatureDA, MotifDA, UrgenceDA, StatutDA, ActionHistorique
from sqlalchemy import select
from datetime import datetime, timedelta


async def get_user(db, username):
    r = await db.execute(select(Utilisateur).where(Utilisateur.username == username))
    return r.scalar_one()


async def creer_da(db, numero, demandeur, lignes_data, **kwargs):
    da = DemandeAchat(
        numero=numero,
        demandeur_id=demandeur.id,
        service_demandeur=demandeur.service or "Urgences",
        poste_fonction=demandeur.poste,
        type_da=kwargs.get("type_da", TypeDA.MEDICAL),
        nature=kwargs.get("nature", NatureDA.ACHAT),
        motif=kwargs.get("motif", MotifDA.REAPPRO),
        urgence=kwargs.get("urgence", UrgenceDA.MOYENNE),
        statut=kwargs.get("statut", StatutDA.BROUILLON),
        justification=kwargs.get("justification", ""),
        lieu_utilisation=kwargs.get("lieu_utilisation"),
        soumise_le=kwargs.get("soumise_le"),
    )
    db.add(da)
    await db.flush()
    for i, l in enumerate(lignes_data, start=1):
        db.add(LigneDA(demande_id=da.id, numero_ligne=i, **l))
    return da


def hist(db, da_id, user_id, action, jours_avant=0, commentaire=None):
    db.add(HistoriqueValidation(
        demande_id=da_id, utilisateur_id=user_id, action=action,
        commentaire=commentaire, date_action=datetime.utcnow() - timedelta(days=jours_avant),
    ))


async def main():
    async with AsyncSessionLocal() as db:
        bertille = await get_user(db, "bertille")
        komi = await get_user(db, "komi")
        theophile = await get_user(db, "theophile")
        moise = await get_user(db, "moise")

        # Nettoyage des anciennes DA de démo pour pouvoir rejouer le script
        anciennes = await db.execute(select(DemandeAchat).where(DemandeAchat.numero.like("DA-DEMO-%")))
        for da in anciennes.scalars().all():
            await db.delete(da)
        await db.flush()

        # 1) Brouillon jamais soumis
        await creer_da(db, "DA-DEMO-001", bertille,
            [{"designation": "Gants latex taille M", "quantite": 20, "unite": "boîte"}],
            statut=StatutDA.BROUILLON, justification="Stock bas en pharmacie",
        )

        # 2) En attente du responsable
        da2 = await creer_da(db, "DA-DEMO-002", bertille,
            [{"designation": "Compresses stériles", "quantite": 50, "unite": "boîte", "stock_actuel": "5"}],
            statut=StatutDA.ATT_RESPONSABLE, urgence=UrgenceDA.HAUTE,
            justification="Rupture de stock imminente", soumise_le=datetime.utcnow() - timedelta(days=1),
        )
        hist(db, da2.id, bertille.id, ActionHistorique.CREATION, 1)
        hist(db, da2.id, bertille.id, ActionHistorique.SOUMISSION, 1)

        # 3) Rejetée par le responsable
        da3 = await creer_da(db, "DA-DEMO-003", bertille,
            [{"designation": "Fauteuil de bureau ergonomique", "quantite": 3, "unite": "unité"}],
            statut=StatutDA.REJETEE, type_da=TypeDA.BIEN_SERVICE, nature=NatureDA.ACHAT,
            motif=MotifDA.NOUVEAU_BESOIN, justification="Confort du personnel",
            soumise_le=datetime.utcnow() - timedelta(days=4),
        )
        hist(db, da3.id, bertille.id, ActionHistorique.CREATION, 4)
        hist(db, da3.id, bertille.id, ActionHistorique.SOUMISSION, 4)
        hist(db, da3.id, komi.id, ActionHistorique.REJET_RESPONSABLE, 3, "Budget non prévu ce trimestre, à revoir en 2027.")

        # 4) En attente du DAF (déjà validée par le responsable)
        da4 = await creer_da(db, "DA-DEMO-004", bertille,
            [{"designation": "Seringues 5ml", "quantite": 200, "unite": "unité", "stock_actuel": "30"},
             {"designation": "Alcool désinfectant", "quantite": 10, "unite": "litre"}],
            statut=StatutDA.ATT_DAF, urgence=UrgenceDA.HAUTE,
            justification="Réapprovisionnement mensuel", soumise_le=datetime.utcnow() - timedelta(days=2),
        )
        hist(db, da4.id, bertille.id, ActionHistorique.CREATION, 2)
        hist(db, da4.id, bertille.id, ActionHistorique.SOUMISSION, 2)
        hist(db, da4.id, komi.id, ActionHistorique.VALIDATION_RESPONSABLE, 1)

        # 5) Approuvée, en attente de réception (aucune confirmation encore)
        da5 = await creer_da(db, "DA-DEMO-005", bertille,
            [{"designation": "Masques chirurgicaux", "quantite": 500, "unite": "unité"}],
            statut=StatutDA.APPROUVEE, justification="Stock épuisé",
            soumise_le=datetime.utcnow() - timedelta(days=5),
        )
        hist(db, da5.id, bertille.id, ActionHistorique.CREATION, 5)
        hist(db, da5.id, bertille.id, ActionHistorique.SOUMISSION, 5)
        hist(db, da5.id, komi.id, ActionHistorique.VALIDATION_RESPONSABLE, 4)
        hist(db, da5.id, theophile.id, ActionHistorique.VALIDATION_DAF, 3)

        # 6) Approuvée, réception confirmée seulement par le demandeur
        da6 = await creer_da(db, "DA-DEMO-006", bertille,
            [{"designation": "Thermomètres infrarouges", "quantite": 5, "unite": "unité"}],
            statut=StatutDA.APPROUVEE, justification="Remplacement de matériel défectueux",
            soumise_le=datetime.utcnow() - timedelta(days=6),
        )
        da6.confirmation_demandeur_par_id = bertille.id
        da6.confirmation_demandeur_le = datetime.utcnow() - timedelta(hours=4)
        hist(db, da6.id, bertille.id, ActionHistorique.CREATION, 6)
        hist(db, da6.id, bertille.id, ActionHistorique.SOUMISSION, 6)
        hist(db, da6.id, komi.id, ActionHistorique.VALIDATION_RESPONSABLE, 5)
        hist(db, da6.id, theophile.id, ActionHistorique.VALIDATION_DAF, 4)

        # 7) Cycle complet : reçue (les deux confirmations faites)
        da7 = await creer_da(db, "DA-DEMO-007", bertille,
            [{"designation": "Blouses jetables", "quantite": 100, "unite": "unité"}],
            statut=StatutDA.RECUE, justification="Réapprovisionnement trimestriel",
            soumise_le=datetime.utcnow() - timedelta(days=10),
        )
        da7.confirmation_demandeur_par_id = bertille.id
        da7.confirmation_demandeur_le = datetime.utcnow() - timedelta(days=2)
        da7.confirmation_acheteur_par_id = moise.id
        da7.confirmation_acheteur_le = datetime.utcnow() - timedelta(days=1)
        hist(db, da7.id, bertille.id, ActionHistorique.CREATION, 10)
        hist(db, da7.id, bertille.id, ActionHistorique.SOUMISSION, 10)
        hist(db, da7.id, komi.id, ActionHistorique.VALIDATION_RESPONSABLE, 9)
        hist(db, da7.id, theophile.id, ActionHistorique.VALIDATION_DAF, 8)
        hist(db, da7.id, bertille.id, ActionHistorique.CONFIRMATION_RECEPTION_DEMANDEUR, 2)
        hist(db, da7.id, moise.id, ActionHistorique.CONFIRMATION_RECEPTION_ACHETEUR, 1)

        await db.commit()
        print("7 demandes de démonstration créées (DA-DEMO-001 à 007) :")
        print("  001 brouillon | 002 att. responsable | 003 rejetée (responsable)")
        print("  004 att. DAF | 005 approuvée (aucune confirmation) | 006 approuvée (demandeur confirmé)")
        print("  007 reçue (cycle complet)")


if __name__ == "__main__":
    asyncio.run(main())
