from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.models import TypeDA, NatureDA, MotifDA, UrgenceDA, StatutDA, RoleUtilisateur, ActionHistorique


def _email_vide_vers_none(v):
    # Beaucoup d'employés n'ont pas d'adresse email dans la clinique : le
    # champ arrive du formulaire comme une chaîne vide plutôt qu'absent, or
    # EmailStr rejette explicitement "" (ce n'est pas un email valide) —
    # sans cette conversion, toute création/modification avec un email vide
    # échoue silencieusement avec une erreur 422.
    if v is None or (isinstance(v, str) and v.strip() == ''):
        return None
    return v


class UtilisateurCreate(BaseModel):
    nom: str
    prenom: str
    username: str = Field(min_length=2, max_length=50)
    email: Optional[EmailStr] = None
    mot_de_passe: str = Field(min_length=6)
    poste: Optional[str] = None
    service: Optional[str] = None
    role: RoleUtilisateur = RoleUtilisateur.DEMANDEUR

    _email_vide = field_validator('email', mode='before')(_email_vide_vers_none)


class UtilisateurOut(BaseModel):
    id: int
    nom: str
    prenom: str
    username: str
    email: Optional[str]
    poste: Optional[str]
    service: Optional[str]
    role: RoleUtilisateur
    actif: bool
    doit_changer_mdp: bool = False
    verrouille_jusqua: Optional[datetime] = None
    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    mot_de_passe: str


class ChangePasswordRequest(BaseModel):
    ancien_mot_de_passe: Optional[str] = None  # facultatif si doit_changer_mdp (premier changement)
    nouveau_mot_de_passe: str = Field(min_length=6)


class ForgotPasswordRequest(BaseModel):
    username: str


class ResetPasswordRequest(BaseModel):
    jeton: str
    nouveau_mot_de_passe: str = Field(min_length=6)


class JournalAuditOut(BaseModel):
    id: int
    username_saisi: Optional[str]
    evenement: str
    details: Optional[str]
    date_evenement: datetime
    utilisateur: Optional[UtilisateurOut] = None
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    utilisateur: UtilisateurOut


class LigneDACreate(BaseModel):
    numero_ligne: int
    designation: str
    quantite: int = Field(gt=0)
    unite: Optional[str] = None
    observation: Optional[str] = None
    stock_actuel: Optional[str] = None
    reference_marque: Optional[str] = None
    description_technique: Optional[str] = None


class LigneDAOut(LigneDACreate):
    id: int
    model_config = {"from_attributes": True}


class FichierDAOut(BaseModel):
    id: int
    nom_original: str
    taille_octets: int
    mime_type: str
    uploade_le: datetime
    model_config = {"from_attributes": True}


class HistoriqueOut(BaseModel):
    id: int
    action: ActionHistorique
    commentaire: Optional[str]
    date_action: datetime
    utilisateur: UtilisateurOut
    model_config = {"from_attributes": True}


class ServiceOut(BaseModel):
    id: int
    nom: str
    peut_traiter_soi_meme: bool
    model_config = {"from_attributes": True}


class ServiceUpdate(BaseModel):
    peut_traiter_soi_meme: bool


class MessageDACreate(BaseModel):
    texte: str = Field(min_length=1, max_length=2000)


class MessageDAOut(BaseModel):
    id: int
    texte: str
    date_envoi: datetime
    auteur: UtilisateurOut
    model_config = {"from_attributes": True}


class LigneCommandeIn(BaseModel):
    designation: str = Field(min_length=1, max_length=300)
    quantite: int = Field(gt=0)
    prix_unitaire: float = Field(ge=0)


class LigneCommandeOut(LigneCommandeIn):
    id: int
    model_config = {"from_attributes": True}


class MarquerCommandeRequest(BaseModel):
    """Lignes réellement commandées (peuvent différer des lignes demandées) —
    saisies par le service Achats au moment de passer la commande."""
    lignes: list[LigneCommandeIn] = Field(min_length=1)


class AbonnementNotificationCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class DemandeAchatCreate(BaseModel):
    service_demandeur: str
    poste_fonction: Optional[str] = None
    type_da: TypeDA
    nature: NatureDA = NatureDA.ACHAT
    motif: MotifDA
    urgence: UrgenceDA
    justification: Optional[str] = None
    normes_certifications: Optional[str] = None
    date_peremption_min: Optional[str] = None
    fournisseur_suggere: Optional[str] = None
    autres_specs: Optional[str] = None
    lieu_utilisation: Optional[str] = None
    lignes: list[LigneDACreate] = Field(min_length=1)


class DemandeAchatUpdate(BaseModel):
    service_demandeur: Optional[str] = None
    poste_fonction: Optional[str] = None
    motif: Optional[MotifDA] = None
    urgence: Optional[UrgenceDA] = None
    justification: Optional[str] = None
    normes_certifications: Optional[str] = None
    date_peremption_min: Optional[str] = None
    fournisseur_suggere: Optional[str] = None
    autres_specs: Optional[str] = None
    lieu_utilisation: Optional[str] = None
    lignes: Optional[list[LigneDACreate]] = None


class DemandeAchatOut(BaseModel):
    id: int
    numero: str
    date_demande: datetime
    service_demandeur: str
    poste_fonction: Optional[str]
    type_da: TypeDA
    nature: NatureDA
    motif: MotifDA
    urgence: UrgenceDA
    statut: StatutDA
    justification: Optional[str]
    normes_certifications: Optional[str]
    date_peremption_min: Optional[str]
    fournisseur_suggere: Optional[str]
    autres_specs: Optional[str]
    lieu_utilisation: Optional[str]
    soumise_le: Optional[datetime]
    mise_a_jour_le: datetime
    confirmation_demandeur_le: Optional[datetime] = None
    confirmation_acheteur_le: Optional[datetime] = None
    bc_cree_le: Optional[datetime] = None
    commande_le: Optional[datetime] = None
    livre_le: Optional[datetime] = None
    deja_renvoye: bool = False
    demandeur: UtilisateurOut
    lignes: list[LigneDAOut] = []
    fichiers: list[FichierDAOut] = []
    historique: list[HistoriqueOut] = []
    messages: list[MessageDAOut] = []
    lignes_commande: list[LigneCommandeOut] = []
    montant_total_commande: float = 0
    model_config = {"from_attributes": True}


class ValidationRequest(BaseModel):
    commentaire: Optional[str] = None


class RejetRequest(BaseModel):
    commentaire: str = Field(min_length=5)
