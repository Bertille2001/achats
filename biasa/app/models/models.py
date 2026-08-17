import enum
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class RoleUtilisateur(str, enum.Enum):
    DEMANDEUR = "demandeur"
    RESPONSABLE = "responsable"
    DAF = "daf"
    ACHETEUR = "acheteur"
    ADMIN = "admin"
    PHARMACIEN = "pharmacien"  # accès uniquement à l'onglet Pharmacie, pas au circuit d'achats


class TypeDA(str, enum.Enum):
    MEDICAL = "medical"
    BIEN_SERVICE = "bien_service"


class NatureDA(str, enum.Enum):
    ACHAT = "achat"
    SERVICE = "service"


class MotifDA(str, enum.Enum):
    REAPPRO = "reappro"
    NOUVEAU_BESOIN = "nouveau_besoin"
    COMMANDE_SPECIFIQUE = "commande_specifique"
    REMPLACEMENT = "remplacement"
    ACTIVITE_URGENTE = "activite_urgente"


class UrgenceDA(str, enum.Enum):
    HAUTE = "haute"
    MOYENNE = "moyenne"
    FAIBLE = "faible"


class StatutDA(str, enum.Enum):
    BROUILLON = "brouillon"
    SOUMISE = "soumise"
    ATT_RESPONSABLE = "att_responsable"
    ATT_DAF = "att_daf"
    APPROUVEE = "approuvee"
    REJETEE = "rejetee"
    RECUE = "recue"  # les deux confirmations (demandeur + acheteur) sont faites


class ActionHistorique(str, enum.Enum):
    CREATION = "creation"
    SOUMISSION = "soumission"
    VALIDATION_RESPONSABLE = "validation_responsable"
    REJET_RESPONSABLE = "rejet_responsable"
    VALIDATION_DAF = "validation_daf"
    REJET_DAF = "rejet_daf"
    TRAITEMENT_ACHETEUR = "traitement_acheteur"
    CONFIRMATION_RECEPTION_DEMANDEUR = "confirmation_reception_demandeur"
    CONFIRMATION_RECEPTION_ACHETEUR = "confirmation_reception_acheteur"
    BC_CREE = "bc_cree"
    COMMANDE_PASSEE = "commande_passee"
    LIVRAISON_RECUE = "livraison_recue"


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nom: Mapped[str] = mapped_column(String(100))
    prenom: Mapped[str] = mapped_column(String(100))
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, index=True, nullable=True)
    mot_de_passe: Mapped[str] = mapped_column(String(200))
    poste: Mapped[str | None] = mapped_column(String(100))
    service: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[RoleUtilisateur] = mapped_column(SAEnum(RoleUtilisateur), default=RoleUtilisateur.DEMANDEUR)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Sécurité du compte
    doit_changer_mdp: Mapped[bool] = mapped_column(Boolean, default=True)  # mot de passe provisoire à la création
    tentatives_echouees: Mapped[int] = mapped_column(Integer, default=0)
    verrouille_jusqua: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    jeton_reinitialisation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jeton_expire_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Code de signature : secret distinct du mot de passe de connexion,
    # connu uniquement de la personne, utilisé seulement pour signer une
    # validation/rejet (responsable, DAF). Nullable tant qu'il n'a pas
    # encore été défini par l'intéressé.
    code_signature: Mapped[str | None] = mapped_column(String(200), nullable=True)

    demandes: Mapped[list["DemandeAchat"]] = relationship(back_populates="demandeur", foreign_keys="DemandeAchat.demandeur_id")
    historiques: Mapped[list["HistoriqueValidation"]] = relationship(back_populates="utilisateur")

    @property
    def code_signature_defini(self) -> bool:
        return self.code_signature is not None


class DemandeAchat(Base):
    __tablename__ = "demandes_achat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    numero: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    demandeur_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"))
    responsable_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    daf_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    date_demande: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    service_demandeur: Mapped[str] = mapped_column(String(100))
    poste_fonction: Mapped[str | None] = mapped_column(String(100))
    type_da: Mapped[TypeDA] = mapped_column(SAEnum(TypeDA))
    nature: Mapped[NatureDA] = mapped_column(SAEnum(NatureDA), default=NatureDA.ACHAT)
    motif: Mapped[MotifDA] = mapped_column(SAEnum(MotifDA))
    urgence: Mapped[UrgenceDA] = mapped_column(SAEnum(UrgenceDA))
    statut: Mapped[StatutDA] = mapped_column(SAEnum(StatutDA), default=StatutDA.BROUILLON)
    justification: Mapped[str | None] = mapped_column(Text)
    normes_certifications: Mapped[str | None] = mapped_column(String(200))
    date_peremption_min: Mapped[str | None] = mapped_column(String(50))
    fournisseur_suggere: Mapped[str | None] = mapped_column(String(200))
    autres_specs: Mapped[str | None] = mapped_column(Text)
    lieu_utilisation: Mapped[str | None] = mapped_column(String(200))
    soumise_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    mise_a_jour_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Confirmation de réception — le demandeur ET le gestionnaire achats doivent
    # tous les deux confirmer avoir reçu / livré la commande pour que la DA passe
    # au statut "recue".
    confirmation_demandeur_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    confirmation_demandeur_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmation_acheteur_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    confirmation_acheteur_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Sous-étapes de traitement par le Service Achats (ou le service lui-même
    # s'il est autorisé à traiter ses propres commandes — voir Service.peut_traiter_soi_meme).
    # Se déroulent pendant que statut == APPROUVEE, avant les confirmations ci-dessus.
    bc_cree_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    bc_cree_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    commande_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    commande_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    livre_par_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    livre_le: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deja_renvoye: Mapped[bool] = mapped_column(Boolean, default=False)  # True = déjà renvoyé une fois après un rejet
    # Quand une demande rejetée est corrigée, on crée une TOUTE NOUVELLE
    # demande (voir da_service.corriger_et_renvoyer_demande) plutôt que de
    # modifier l'ancienne en place — l'ancienne reste visible telle quelle,
    # comme trace de ce qui a été refusé. Ce champ, sur la NOUVELLE demande,
    # pointe vers l'ancienne. Pas de relationship() ORM ici (auto-référence :
    # on reste sur une simple colonne + requêtes ciblées côté service pour
    # éviter la complexité d'un mapper auto-référentiel).
    corrige_da_id: Mapped[int | None] = mapped_column(ForeignKey("demandes_achat.id"), nullable=True)

    demandeur: Mapped["Utilisateur"] = relationship(back_populates="demandes", foreign_keys=[demandeur_id])
    lignes: Mapped[list["LigneDA"]] = relationship(back_populates="demande", cascade="all, delete-orphan", order_by="LigneDA.numero_ligne")
    fichiers: Mapped[list["FichierDA"]] = relationship(back_populates="demande", cascade="all, delete-orphan")
    historique: Mapped[list["HistoriqueValidation"]] = relationship(back_populates="demande", cascade="all, delete-orphan", order_by="HistoriqueValidation.date_action")
    messages: Mapped[list["MessageDA"]] = relationship(back_populates="demande", cascade="all, delete-orphan", order_by="MessageDA.date_envoi")
    # Lignes réellement commandées (désignation/quantité/prix), saisies par
    # l'acheteur au moment de "commande passée" — peuvent différer de ce qui
    # était initialement demandé (ex : 1 PC demandé, 2 commandés parce qu'il en
    # manquait aussi ailleurs). C'est cette liste qui sert de base au montant
    # dépensé affiché dans les tableaux de bord, pas les lignes demandées.
    lignes_commande: Mapped[list["LigneCommande"]] = relationship(back_populates="demande", cascade="all, delete-orphan")

    @property
    def montant_total_commande(self) -> float:
        return sum((l.quantite * l.prix_unitaire) for l in self.lignes_commande)


class LigneDA(Base):
    __tablename__ = "lignes_da"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes_achat.id", ondelete="CASCADE"))
    numero_ligne: Mapped[int] = mapped_column(Integer)
    designation: Mapped[str] = mapped_column(String(300))
    quantite: Mapped[int] = mapped_column(Integer)
    unite: Mapped[str | None] = mapped_column(String(50))
    observation: Mapped[str | None] = mapped_column(String(300))
    stock_actuel: Mapped[str | None] = mapped_column(String(100))
    reference_marque: Mapped[str | None] = mapped_column(String(200))
    description_technique: Mapped[str | None] = mapped_column(Text)

    demande: Mapped["DemandeAchat"] = relationship(back_populates="lignes")


class FichierDA(Base):
    __tablename__ = "fichiers_da"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes_achat.id", ondelete="CASCADE"))
    nom_original: Mapped[str] = mapped_column(String(255))
    nom_stockage: Mapped[str] = mapped_column(String(255))
    taille_octets: Mapped[int] = mapped_column(Integer)
    mime_type: Mapped[str] = mapped_column(String(100))
    uploade_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    uploade_par_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"))

    demande: Mapped["DemandeAchat"] = relationship(back_populates="fichiers")


class HistoriqueValidation(Base):
    __tablename__ = "historique_validations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes_achat.id", ondelete="CASCADE"))
    utilisateur_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"))
    action: Mapped[ActionHistorique] = mapped_column(SAEnum(ActionHistorique))
    commentaire: Mapped[str | None] = mapped_column(Text)
    date_action: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    demande: Mapped["DemandeAchat"] = relationship(back_populates="historique")
    utilisateur: Mapped["Utilisateur"] = relationship(back_populates="historiques")
class ValeurPredéfinie(Base):
    __tablename__ = "valeurs_predefinies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    categorie: Mapped[str] = mapped_column(String(50), index=True)
    valeur: Mapped[str] = mapped_column(String(300))
    # Utilisé uniquement pour la catégorie 'designation' : rattache un article
    # au service qui l'utilise habituellement (catalogue par service). NULL =
    # visible pour tous les services (comportement des autres catégories,
    # inchangé). Un article tapé qui n'existe pas encore pour ce service est
    # ajouté automatiquement ici lors de la création d'une demande.
    service: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cree_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class JournalAudit(Base):
    """Trace des événements de sécurité : connexions, échecs, verrouillages,
    changements de mot de passe — indépendant de l'historique métier des DA."""
    __tablename__ = "journal_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    utilisateur_id: Mapped[int | None] = mapped_column(ForeignKey("utilisateurs.id"), nullable=True)
    username_saisi: Mapped[str | None] = mapped_column(String(50), nullable=True)
    evenement: Mapped[str] = mapped_column(String(50))  # connexion_reussie|connexion_echouee|compte_verrouille|deverrouillage|changement_mdp|reinitialisation_mdp
    details: Mapped[str | None] = mapped_column(String(300), nullable=True)
    date_evenement: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    utilisateur: Mapped["Utilisateur | None"] = relationship()


class Service(Base):
    """Référentiel des services, géré depuis Administration. Le champ
    peut_traiter_soi_meme permet à un service (ex. Pharmacie) de traiter
    lui-même ses commandes (BC/Commandé/Livré) sans passer par le Service
    Achats — n'importe quel utilisateur de ce service peut alors agir,
    quel que soit son rôle de compte (pas besoin de comptes multi-rôles)."""
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    peut_traiter_soi_meme: Mapped[bool] = mapped_column(Boolean, default=False)


class MessageDA(Base):
    """Message de discussion sur une demande d'achat — visible par toute
    personne pouvant voir la demande (demandeur, responsable, DAF, achats, admin)."""
    __tablename__ = "messages_da"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes_achat.id", ondelete="CASCADE"))
    auteur_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"))
    texte: Mapped[str] = mapped_column(Text)
    date_envoi: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    demande: Mapped["DemandeAchat"] = relationship(back_populates="messages")
    auteur: Mapped["Utilisateur"] = relationship()


class LigneCommande(Base):
    """Ligne réellement commandée par le service Achats (désignation, quantité,
    prix unitaire), saisie à l'étape "commande passée". Distincte des lignes
    demandées (LigneDA) car ce qui est finalement commandé peut différer de ce
    qui a été demandé au départ (quantité ajustée, référence différente...)."""
    __tablename__ = "lignes_commande"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes_achat.id", ondelete="CASCADE"))
    designation: Mapped[str] = mapped_column(String(300))
    quantite: Mapped[int] = mapped_column(Integer)
    prix_unitaire: Mapped[float] = mapped_column(Float)

    demande: Mapped["DemandeAchat"] = relationship(back_populates="lignes_commande")


class AbonnementNotification(Base):
    """Abonnement Web Push d'un navigateur pour un utilisateur — permet
    d'envoyer une vraie notification système (même onglet en arrière-plan,
    ou navigateur fermé selon le navigateur) quand un nouveau message arrive."""
    __tablename__ = "abonnements_notification"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    utilisateur_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id", ondelete="CASCADE"))
    endpoint: Mapped[str] = mapped_column(String(500), unique=True)
    p256dh: Mapped[str] = mapped_column(String(200))
    auth: Mapped[str] = mapped_column(String(100))
    cree_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    utilisateur: Mapped["Utilisateur"] = relationship()


class SortiePharmacie(Base):
    """Un retrait de produits fait par un service à la pharmacie de la
    clinique. Volontairement simple (pas de circuit de validation, pas de
    suivi du stock disponible) : ça sert juste à savoir qui a pris quoi,
    quand, pour analyser la consommation par service — pas à gérer
    l'inventaire de la pharmacie."""
    __tablename__ = "sorties_pharmacie"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date_sortie: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    service: Mapped[str] = mapped_column(String(100))
    commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    enregistre_par_id: Mapped[int] = mapped_column(ForeignKey("utilisateurs.id"))
    cree_le: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    enregistre_par: Mapped["Utilisateur"] = relationship()
    lignes: Mapped[list["LigneSortiePharmacie"]] = relationship(back_populates="sortie", cascade="all, delete-orphan")


class LigneSortiePharmacie(Base):
    __tablename__ = "lignes_sortie_pharmacie"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sortie_id: Mapped[int] = mapped_column(ForeignKey("sorties_pharmacie.id", ondelete="CASCADE"))
    produit: Mapped[str] = mapped_column(String(200))
    quantite: Mapped[int] = mapped_column(Integer)
    unite: Mapped[str | None] = mapped_column(String(50), nullable=True)

    sortie: Mapped["SortiePharmacie"] = relationship(back_populates="lignes")
