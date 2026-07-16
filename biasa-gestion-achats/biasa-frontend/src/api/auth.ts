import client from './client'
import type { TokenOut, Utilisateur } from '../types'
export const authApi = {
  login: async (username: string, motDePasse: string): Promise<TokenOut> => { const { data } = await client.post<TokenOut>('/auth/login', { username, mot_de_passe: motDePasse }); return data },
  me: async (): Promise<Utilisateur> => { const { data } = await client.get<Utilisateur>('/auth/me'); return data },
  changerMotDePasse: async (ancien: string | null, nouveau: string): Promise<Utilisateur> => {
    const { data } = await client.post<Utilisateur>('/auth/change-password', { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau })
    return data
  },
  motDePasseOublie: async (username: string): Promise<{ message: string }> => {
    const { data } = await client.post('/auth/forgot-password', { username })
    return data
  },
  reinitialiserMotDePasse: async (jeton: string, nouveau: string): Promise<Utilisateur> => {
    const { data } = await client.post<Utilisateur>('/auth/reset-password', { jeton, nouveau_mot_de_passe: nouveau })
    return data
  },
}
