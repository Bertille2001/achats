export type RoleUtilisateur = 'demandeur' | 'responsable' | 'daf' | 'acheteur' | 'admin'
export type TypeDA = 'medical' | 'bien_service'
export type NatureDA = 'achat' | 'service'
export type MotifDA = 'reappro' | 'nouveau_besoin' | 'commande_specifique' | 'remplacement' | 'activite_urgente'
export type UrgenceDA = 'haute' | 'moyenne' | 'faible'
export type StatutDA = 'brouillon' | 'soumise' | 'att_responsable' | 'att_daf' | 'approuvee' | 'rejetee' | 'recue'
export type ActionHistorique = 'creation' | 'soumission' | 'validation_responsable' | 'rejet_responsable' | 'validation_daf' | 'rejet_daf' | 'traitement_acheteur' | 'confirmation_reception_demandeur' | 'confirmation_reception_acheteur' | 'bc_cree' | 'commande_passee' | 'livraison_recue'

export interface Utilisateur { id: number; nom: string; prenom: string; username: string; email: string | null; poste: string | null; service: string | null; role: RoleUtilisateur; actif: boolean; doit_changer_mdp: boolean; verrouille_jusqua: string | null }
export interface TokenOut { access_token: string; token_type: string; utilisateur: Utilisateur }
export interface LigneDA { id: number; numero_ligne: number; designation: string; quantite: number; unite: string | null; observation: string | null; stock_actuel: string | null; reference_marque: string | null; description_technique: string | null }
export interface FichierDA { id: number; nom_original: string; taille_octets: number; mime_type: string; uploade_le: string }
export interface HistoriqueItem { id: number; action: ActionHistorique; commentaire: string | null; date_action: string; utilisateur: Utilisateur }
export interface MessageDA { id: number; texte: string; date_envoi: string; auteur: Utilisateur }
export interface ServiceConfig { id: number; nom: string; peut_traiter_soi_meme: boolean }
export interface LigneCommande { id: number; designation: string; quantite: number; prix_unitaire: number }
export type EtatEquipement = 'en_service' | 'en_panne' | 'hors_service'
export interface Equipement { id: number; demande_id: number | null; designation: string; reference: string | null; lieu_deploiement: string | null; responsable: string | null; etat: EtatEquipement; garantie_fin: string | null; prix_unitaire: number | null; cree_le: string; ajoute_par: Utilisateur }
export const ETAT_EQUIPEMENT_LABELS: Record<EtatEquipement, string> = { en_service: 'En service', en_panne: 'En panne', hors_service: 'Hors service' }
export const ETAT_EQUIPEMENT_COLORS: Record<EtatEquipement, string> = { en_service: '#1e8f5f', en_panne: '#d68910', hors_service: '#c0392b' }
export interface DemandeAchat { id: number; numero: string; date_demande: string; service_demandeur: string; poste_fonction: string | null; type_da: TypeDA; nature: NatureDA; motif: MotifDA; urgence: UrgenceDA; statut: StatutDA; justification: string | null; normes_certifications: string | null; date_peremption_min: string | null; fournisseur_suggere: string | null; autres_specs: string | null; lieu_utilisation: string | null; soumise_le: string | null; mise_a_jour_le: string; confirmation_demandeur_le: string | null; confirmation_acheteur_le: string | null; bc_cree_le: string | null; commande_le: string | null; livre_le: string | null; deja_renvoye: boolean; demandeur: Utilisateur; lignes: LigneDA[]; fichiers: FichierDA[]; historique: HistoriqueItem[]; messages: MessageDA[]; lignes_commande: LigneCommande[]; montant_total_commande: number }
export interface LigneDAForm { numero_ligne: number; designation: string; quantite: number; unite: string; observation: string; stock_actuel: string; reference_marque: string; description_technique: string }
export interface DemandeAchatForm { service_demandeur: string; poste_fonction: string; type_da: TypeDA; nature: NatureDA; motif: MotifDA; urgence: UrgenceDA; justification: string; normes_certifications: string; date_peremption_min: string; fournisseur_suggere: string; autres_specs: string; lieu_utilisation: string; lignes: LigneDAForm[] }

export const MOTIF_LABELS: Record<MotifDA, string> = { reappro: 'Réapprovisionnement régulier', nouveau_besoin: 'Nouveau besoin', commande_specifique: 'Commande spécifique patient', remplacement: 'Remplacement / Panne', activite_urgente: 'Activité urgente' }
export const URGENCE_LABELS: Record<UrgenceDA, string> = { haute: 'Haute (24h)', moyenne: 'Moyenne (48h)', faible: 'Faible (>72h)' }
export const STATUT_LABELS: Record<StatutDA, string> = { brouillon: 'Brouillon', soumise: 'Soumise', att_responsable: 'Att. responsable', att_daf: 'Att. DAF', approuvee: 'Approuvée', rejetee: 'Rejetée', recue: 'Reçue' }
export const STATUT_COLORS: Record<StatutDA, string> = {
  brouillon: '#8a96a3',        // gris — pas encore engagé
  soumise: '#1B9DE0',          // bleu — en circuit
  att_responsable: '#d68910',  // ambre — attend une action
  att_daf: '#8e5cd9',          // violet — distingue de l'étape responsable
  approuvee: '#1e8f5f',        // vert — validé
  rejetee: '#c0392b',          // rouge — refusé
  recue: '#0e7c86',            // sarcelle — cycle terminé
}
export const URGENCE_COLORS: Record<UrgenceDA, string> = {
  haute: '#c0392b',
  moyenne: '#d68910',
  faible: '#1e8f5f',
}
export const ACTION_LABELS: Record<ActionHistorique, string> = { creation: 'Demande créée', soumission: 'Soumise pour validation', validation_responsable: 'Validée par le responsable', rejet_responsable: 'Rejetée par le responsable', validation_daf: 'Validée par le DAF', rejet_daf: 'Rejetée par le DAF', traitement_acheteur: 'Prise en charge achats', confirmation_reception_demandeur: 'Réception confirmée par le demandeur', confirmation_reception_acheteur: 'Réception confirmée par le Service Achats', bc_cree: 'Bon de commande créé', commande_passee: 'Commande passée au fournisseur', livraison_recue: 'Livraison reçue' }
