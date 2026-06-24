import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import Layout from '../Layout'
export default function ProtectedRoute() {
  const { isAuthenticated, utilisateur } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (utilisateur?.doit_changer_mdp && location.pathname !== '/changer-mot-de-passe') {
    return <Navigate to="/changer-mot-de-passe" replace />
  }
  return <Layout><Outlet /></Layout>
}
