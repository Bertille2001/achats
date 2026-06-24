import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useEffect, useState, type ReactNode } from 'react'
import { demandesApi } from '../../api/demandes'

export default function Layout({ children }: { children: ReactNode }) {
  const { utilisateur, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [nbNonVus, setNbNonVus] = useState(0)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [largeurFenetre, setLargeurFenetre] = useState(window.innerWidth)
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)
  const estMobile = largeurFenetre < 860

  useEffect(() => {
    const onResize = () => setLargeurFenetre(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { setMenuMobileOuvert(false) }, [location.pathname])

  // Déconnexion automatique après 30 min sans interaction (sécurité)
  const DUREE_INACTIVITE_MS = 30 * 60 * 1000
  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout>
    const reinitialiser = () => {
      clearTimeout(minuteur)
      minuteur = setTimeout(() => {
        logout()
        navigate('/login')
      }, DUREE_INACTIVITE_MS)
    }
    const evenements = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    evenements.forEach(ev => window.addEventListener(ev, reinitialiser))
    reinitialiser()
    return () => {
      clearTimeout(minuteur)
      evenements.forEach(ev => window.removeEventListener(ev, reinitialiser))
    }
  }, [])

  const estValidateur = utilisateur && ['responsable', 'daf'].includes(utilisateur.role)
  const estAcheteur = utilisateur && ['acheteur', 'admin'].includes(utilisateur.role)
  const estAdmin = utilisateur?.role === 'admin'
  const peutVoirBadge = estValidateur || estAcheteur

  const initiales = utilisateur
    ? `${utilisateur.prenom?.[0] ?? ''}${utilisateur.nom?.[0] ?? ''}`.toUpperCase()
    : '?'

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const charger = () => {
    if (!peutVoirBadge) return
    demandesApi.aValider().then(d => {
      if (estAcheteur && !estAdmin) {
        const stored = localStorage.getItem('da_vues')
        const vues: number[] = stored ? JSON.parse(stored) : []
        setNbNonVus(d.filter(da => !vues.includes(da.id)).length)
      } else if (estValidateur) {
        setNbNonVus(d.length)
      }
    }).catch(() => setNbNonVus(0))
  }

  useEffect(() => {
    charger()
    const interval = setInterval(charger, 10000)
    return () => clearInterval(interval)
  }, [peutVoirBadge])

  useEffect(() => {
    if (!location.pathname.includes('a-valider')) charger()
  }, [location.pathname])

  const dot = (active: boolean) => ({
    width: 5, height: 5, borderRadius: '50%',
    background: active ? '#1B9DE0' : '#d4d4d0',
    flexShrink: 0,
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eaf2fb', position: 'relative' }}>

      {confirmLogout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', border: '1px solid #e3e9f1', borderRadius: 12, padding: '24px 28px', width: 320, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15.5, fontWeight: 500, color: '#0B3C7A', marginBottom: 6 }}>Se déconnecter</div>
            <div style={{ fontSize: 13.5, color: '#5e6f85', marginBottom: 20 }}>Voulez-vous vraiment vous déconnecter ?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmLogout(false)} style={{ padding: '6px 14px', fontSize: 13.5, border: '1px solid #e3e9f1', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#5e6f85' }}>Annuler</button>
              <button onClick={() => { logout(); navigate('/login') }} style={{ padding: '6px 14px', fontSize: 13.5, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {/* Voile sombre derrière le menu mobile ouvert */}
      {estMobile && menuMobileOuvert && (
        <div onClick={() => setMenuMobileOuvert(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }} />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: 200, minWidth: 200, background: '#fff', borderRight: '1px solid #e3e9f1',
        display: 'flex', flexDirection: 'column',
        ...(estMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 95,
          transform: menuMobileOuvert ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        } : {}),
      }}>

        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #eef2f7' }}>
          <img
            src="/logo_biasa.png"
            alt="Clinique BIASA"
            style={{ height: 28, objectFit: 'contain', display: 'block', marginBottom: 4 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0B3C7A' }}>Clinique BIASA</div>
          <div style={{ fontSize: 11.5, color: '#8a96a3', marginTop: 1 }}>Gestion des achats</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1 }}>
          <NavItem to="/" label="Tableau de bord" dot={dot} exact />
          <NavItem to="/mes-demandes" label="Mes demandes" dot={dot} />

          {(estValidateur || (estAcheteur && !estAdmin)) && (
            <NavItem
              to="/a-valider"
              label={estAcheteur && !estAdmin ? 'DA approuvées' : 'À valider'}
              dot={dot}
              badge={nbNonVus}
              badgeCouleur="#e24b4a"
            />
          )}
          {estValidateur && <NavItem to="/historique-validations" label="Historique" dot={dot} />}
          {estValidateur && <NavItem to="/admin/toutes-da" label="Toutes les DA" dot={dot} />}

          {estAdmin && (
            <>
              <div style={{ fontSize: 10.5, color: '#c4c4be', padding: '12px 10px 4px', letterSpacing: '0.8px', textTransform: 'uppercase' as const }}>Administration</div>
              <NavItem to="/admin" label="Tableau de bord" dot={dot} />
              <NavItem to="/admin/toutes-da" label="Toutes les DA" dot={dot} />
              <NavItem to="/gestion-users" label="Utilisateurs" dot={dot} />
              <NavItem to="/parametres" label="Paramètres" dot={dot} />
              <NavItem to="/config-email" label="Config. email" dot={dot} />
              <NavItem to="/journal-audit" label="Journal d'audit" dot={dot} />
              <NavItem to="/services" label="Services" dot={dot} />
            </>
          )}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #eef2f7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, color: '#0B3C7A', flexShrink: 0 }}>{initiales}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0B3C7A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{utilisateur?.prenom} {utilisateur?.nom}</div>
              <div style={{ fontSize: 11.5, color: '#8a96a3', textTransform: 'capitalize' }}>{utilisateur?.role}</div>
            </div>
          </div>
          <button onClick={() => setConfirmLogout(true)} style={{ width: '100%', padding: '5px 8px', fontSize: 12.5, border: '1px solid #e3e9f1', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#8a96a3' }}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: estMobile ? '100%' : undefined }}>

        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e3e9f1', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {estMobile && (
              <button onClick={() => setMenuMobileOuvert(true)} aria-label="Ouvrir le menu" style={{ border: '1px solid #e3e9f1', borderRadius: 6, background: 'transparent', cursor: 'pointer', padding: '5px 9px', fontSize: 14.5, color: '#0B3C7A', flexShrink: 0 }}>
                Menu
              </button>
            )}
            <div className="hide-mobile" style={{ fontSize: 12.5, color: '#8a96a3', textTransform: 'capitalize' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{today}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {nbNonVus > 0 && (
              <span style={{ fontSize: 12.5, color: '#a32d2d', background: '#fcebeb', border: '1px solid #f09595', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const }}>
                {nbNonVus} en attente
              </span>
            )}
            <span className="hide-mobile" style={{ fontSize: 13.5, color: '#0B3C7A', fontWeight: 500, whiteSpace: 'nowrap' as const }}>{utilisateur?.prenom} {utilisateur?.nom}</span>
          </div>
        </div>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, label, dot, badge, badgeCouleur = '#e24b4a', exact }: {
  to: string; label: string; dot: (active: boolean) => React.CSSProperties; badge?: number; badgeCouleur?: string; exact?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', fontSize: 13.5, borderRadius: 6,
        color: isActive ? '#0B3C7A' : '#5e6f85',
        fontWeight: isActive ? 500 : 400,
        background: isActive ? '#f3f3f1' : 'transparent',
        textDecoration: 'none', margin: '1px 0', gap: 8,
      })}
    >
      {({ isActive }) => (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={dot(isActive)} />
            <span>{label}</span>
          </div>
          {badge != null && badge > 0 && (
            <span style={{ background: badgeCouleur, color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center' as const }}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  ) 
}
