import enum
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class RoleUtilisateur(str, enum.Enum):
    DEMANDEUR = "demandeur"
    RESPONSABLE = "responsable"
    DAF = "daf"
    ACHETEUR = "acheteur"
    ADMIN = "admin"


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

    demandes: Mapped[list["DemandeAchat"]] = relationship(back_populates="demandeur", foreign_keys="DemandeAchat.demandeur_id")
    historiques: Mapped[list["HistoriqueValidation"]] = relationship(back_populates="utilisateur")


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

    demandeur: Mapped["Utilisateur"] = relationship(back_populates="demandes", foreign_keys=[demandeur_id])
    lignes: Mapped[list["LigneDA"]] = relationship(back_populates="demande", cascade="all, delete-orphan", order_by="LigneDA.numero_ligne")
    fichiers: Mapped[list["FichierDA"]] = relationship(back_populates="demande", cascade="all, delete-orphan")
    historique: Mapped[list["HistoriqueValidation"]] = relationship(back_populates="demande", cascade="all, delete-orphan", order_by="HistoriqueValidation.date_action")


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
