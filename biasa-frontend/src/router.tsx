import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from './pages/Login'
import MesDemandesPage from './pages/MesDemandes'
import DetailDAPage from './pages/DetailDA'
import AValiderPage from './pages/AValider'
import ProtectedRoute from './components/ProtectedRoute'
import HistoriqueValidationsPage from './pages/HistoriqueValidations'
import GestionUsersPage from './pages/GestionUsers'
import ParametresPage from './pages/Parametres'
import AdminDashboardPage from './pages/AdminDashboard'
import ToutesDaPage from './pages/ToutesDA'
import ConfigEmailPage from './pages/ConfigEmail'
import DashboardPage from './pages/Dashboard'
import ChangerMotDePassePage from './pages/ChangerMotDePasse'
import MotDePasseOubliePage from './pages/MotDePasseOublie'
import ReinitialiserMotDePassePage from './pages/ReinitialiserMotDePasse'
import JournalAuditPage from './pages/JournalAudit'
import ServicesPage from './pages/Services'
import ModifierDAPage from './pages/ModifierDA'
import PharmaciePage from './pages/Pharmacie'
import CodeSignaturePage from './pages/CodeSignature'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/mot-de-passe-oublie', element: <MotDePasseOubliePage /> },
  { path: '/reinitialiser-mot-de-passe', element: <ReinitialiserMotDePassePage /> },
  { path: '/changer-mot-de-passe', element: <ChangerMotDePassePage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/mes-demandes', element: <MesDemandesPage /> },
      { path: '/demandes/:id', element: <DetailDAPage /> },
      { path: '/a-valider', element: <AValiderPage /> },
      { path: '/historique-validations', element: <HistoriqueValidationsPage /> },
      { path: '/gestion-users', element: <GestionUsersPage /> },
      { path: '/parametres', element: <ParametresPage /> },
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '/admin/toutes-da', element: <ToutesDaPage /> },
      { path: '/config-email', element: <ConfigEmailPage /> },
      { path: '/journal-audit', element: <JournalAuditPage /> },
      { path: '/services', element: <ServicesPage /> },
      { path: '/demandes/:id/modifier', element: <ModifierDAPage /> },
      { path: '/pharmacie', element: <PharmaciePage /> },
      { path: '/code-signature', element: <CodeSignaturePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
