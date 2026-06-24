import { create } from 'zustand'
import type { Utilisateur } from '../types'
interface AuthState { utilisateur: Utilisateur | null; token: string | null; isAuthenticated: boolean; setAuth: (u: Utilisateur, t: string) => void; logout: () => void }
export const useAuthStore = create<AuthState>((set) => ({
  utilisateur: null,
  token: localStorage.getItem('biasa_token'),
  isAuthenticated: !!localStorage.getItem('biasa_token'),
  setAuth: (utilisateur, token) => { localStorage.setItem('biasa_token', token); set({ utilisateur, token, isAuthenticated: true }) },
  logout: () => { localStorage.removeItem('biasa_token'); set({ utilisateur: null, token: null, isAuthenticated: false }) },
}))
