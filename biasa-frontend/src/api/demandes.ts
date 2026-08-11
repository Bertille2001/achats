import client from './client'
import type { DemandeAchat, DemandeAchatForm, FichierDA, MessageDA, ServiceConfig, SortiePharmacie, SortiePharmacieForm } from '../types'
export const demandesApi = {
  mesDemandes: async (): Promise<DemandeAchat[]> => { const { data } = await client.get<DemandeAchat[]>('/demandes/mes-demandes'); return data },
  aValider: async (): Promise<DemandeAchat[]> => { const { data } = await client.get<DemandeAchat[]>('/demandes/a-valider'); return data },
  detail: async (id: number): Promise<DemandeAchat> => { const { data } = await client.get<DemandeAchat>(`/demandes/${id}`); return data },
  creer: async (form: DemandeAchatForm): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>('/demandes/', form); return data },
  soumettre: async (id: number): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/soumettre`); return data },
  validerResponsable: async (id: number, commentaire: string | undefined, mot_de_passe: string): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/valider-responsable`, { commentaire, mot_de_passe }); return data },
  rejeterResponsable: async (id: number, commentaire: string, mot_de_passe: string): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/rejeter-responsable`, { commentaire, mot_de_passe }); return data },
  validerDaf: async (id: number, commentaire: string | undefined, mot_de_passe: string): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/valider-daf`, { commentaire, mot_de_passe }); return data },
  rejeterDaf: async (id: number, commentaire: string, mot_de_passe: string): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/rejeter-daf`, { commentaire, mot_de_passe }); return data },
  confirmerReceptionDemandeur: async (id: number): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/confirmer-reception-demandeur`); return data },
  confirmerReceptionAcheteur: async (id: number): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/confirmer-reception-acheteur`); return data },
  marquerBcCree: async (id: number): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/marquer-bc-cree`); return data },
  marquerCommande: async (id: number, lignes: { designation: string; quantite: number; prix_unitaire: number }[]): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/marquer-commande`, { lignes }); return data },
  marquerLivre: async (id: number): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/marquer-livre`); return data },
  listerMessages: async (id: number): Promise<MessageDA[]> => { const { data } = await client.get<MessageDA[]>(`/demandes/${id}/messages`); return data },
  envoyerMessage: async (id: number, texte: string): Promise<DemandeAchat> => { const { data } = await client.post<DemandeAchat>(`/demandes/${id}/messages`, { texte }); return data },
  uploadFichier: async (id: number, file: File): Promise<FichierDA> => { const form = new FormData(); form.append('file', file); const { data } = await client.post<FichierDA>(`/demandes/${id}/fichiers`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); return data },
  modifier: async (id: number, data: Partial<DemandeAchatForm>): Promise<DemandeAchat> => { const { data: d } = await client.put<DemandeAchat>(`/demandes/${id}`, data); return d },
  toutesDemandesAcheteur: async (): Promise<DemandeAchat[]> => { const { data } = await client.get<DemandeAchat[]>('/demandes/toutes'); return data },
  urlTelechargement: (daId: number, fichierId: number): string => `/api/v1/demandes/${daId}/fichiers/${fichierId}/telecharger`,
  urlApercu: (daId: number, fichierId: number): string => `/api/v1/demandes/${daId}/fichiers/${fichierId}/apercu`,
}

export const servicesApi = {
  lister: async (): Promise<ServiceConfig[]> => { const { data } = await client.get<ServiceConfig[]>('/admin/services'); return data },
  modifier: async (nom: string, peut_traiter_soi_meme: boolean): Promise<ServiceConfig> => { const { data } = await client.put<ServiceConfig>(`/admin/services/${encodeURIComponent(nom)}`, { peut_traiter_soi_meme }); return data },
}

export const pharmacieApi = {
  lister: async (): Promise<SortiePharmacie[]> => { const { data } = await client.get<SortiePharmacie[]>('/pharmacie/sorties'); return data },
  creer: async (form: SortiePharmacieForm): Promise<SortiePharmacie> => { const { data } = await client.post<SortiePharmacie>('/pharmacie/sorties', form); return data },
  supprimer: async (id: number): Promise<void> => { await client.delete(`/pharmacie/sorties/${id}`) },
}
