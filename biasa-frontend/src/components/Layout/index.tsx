import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { demandesApi } from '../../api/demandes'
import client from '../../api/client'
import { etatNotifications, activerNotifications, desactiverNotifications, type EtatNotifications } from '../../notifications'

export default function Layout({ children }: { children: ReactNode }) {
  const { utilisateur, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [nbAValider, setNbAValider] = useState(0)
  const [nbMessages, setNbMessages] = useState(0)
  const [nbMdpOublies, setNbMdpOublies] = useState(0)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [largeurFenetre, setLargeurFenetre] = useState(window.innerWidth)
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)
  const [etatNotifs, setEtatNotifs] = useState<EtatNotifications>('inactives')
  const [chargementNotifs, setChargementNotifs] = useState(false)
  const estMobile = largeurFenetre < 860

  useEffect(() => { etatNotifications().then(setEtatNotifs) }, [])

  const basculerNotifications = async () => {
    setChargementNotifs(true)
    try {
      if (etatNotifs === 'actives') {
        await desactiverNotifications()
        setEtatNotifs('inactives')
      } else {
        const resultat = await activerNotifications()
        setEtatNotifs(resultat)
        if (resultat === 'refusees') alert("Les notifications ont été bloquées dans les réglages du navigateur. Autorise-les pour ce site pour les activer.")
        if (resultat === 'indisponibles') alert("Les notifications ne sont pas disponibles sur ce navigateur (ou le serveur n'a pas encore été configuré pour les envoyer).")
      }
    } catch {
      alert("Erreur lors de l'activation des notifications.")
    } finally {
      setChargementNotifs(false)
    }
  }

  useEffect(() => {
    const onResize = () => setLargeurFenetre(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { setMenuMobileOuvert(false) }, [location.pathname])

  // Déconnexion automatique après 5 min sans interaction (données sensibles)
  useEffect(() => {
    const DUREE = 5 * 60 * 1000
    let t: ReturnType<typeof setTimeout>
    const reset = () => { clearTimeout(t); t = setTimeout(() => { logout(); navigate('/login') }, DUREE) }
    const evts = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    evts.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => { clearTimeout(t); evts.forEach(e => window.removeEventListener(e, reset)) }
  }, [])

  const role = utilisateur?.role
  const estValidateur = role && ['responsable', 'daf'].includes(role)
  const estAcheteur = role && ['acheteur', 'admin'].includes(role)
  const estAdmin = role === 'admin'

  // Compter les messages non lus sur toutes les DA visibles. On exclut
  // toujours les messages envoyés par l'utilisateur connecté lui-même : un
  // message qu'on vient d'écrire ne doit jamais apparaître comme "nouveau"
  // à ses propres yeux, même si le marqueur "vu" n'est pas encore à jour.
  const compterMessagesNonLus = useCallback((das: any[]) => {
    const monId = utilisateur?.id
    let total = 0
    for (const da of das) {
      if (!da.messages) continue
      const vus = Number(localStorage.getItem(`messages_vus_${da.id}`) || 0)
      const nouveaux = da.messages.slice(vus)
      total += nouveaux.filter((m: any) => m.auteur?.id !== monId).length
    }
    return total
  }, [utilisateur?.id])

  const charger = useCallback(async () => {
    try {
      if (role === 'demandeur') {
        // Le demandeur ne voit que ses propres DA : le badge Messagerie ne
        // porte donc que sur celles-ci.
        const mes = await demandesApi.mesDemandes().catch(() => [])
        setNbMessages(compterMessagesNonLus(mes))
        return
      }

      // Acheteur, Admin, Responsable et DAF ont tous une vision complète sur
      // toutes les DA (décision client du 2026-06). Le badge Messagerie doit
      // donc toujours porter sur TOUTES les DA, pour que n'importe quel rôle
      // voie qu'un message est arrivé, même s'il n'a pas encore d'action à
      // faire dessus. Avant, seuls l'acheteur et responsable/DAF avaient un
      // calcul (partiel), et l'admin n'avait jamais aucun badge.
      const all = await demandesApi.toutesDemandesAcheteur().catch(() => [])
      setNbMessages(compterMessagesNonLus(all))

      if (estAcheteur && !estAdmin) {
        // Le badge "à traiter" de l'acheteur reflète les DA APPROUVÉES pas
        // encore entièrement traitées (BC créé -> commande passée ->
        // livraison reçue). Seul le demandeur confirme la réception finale,
        // le rôle de l'acheteur s'arrête à la livraison. Les DA encore en
        // attente du responsable/DAF ne concernent pas encore l'acheteur.
        const aTraiter = all.filter((da: any) =>
          da.statut === 'approuvee' &&
          (!da.bc_cree_le || !da.commande_le || !da.livre_le)
        )
        setNbAValider(aTraiter.length)
      } else if (estValidateur) {
        const val = await demandesApi.aValider().catch(() => [])
        setNbAValider(val.length)
      }

      if (estAdmin) {
        const en_attente = await client.get<any[]>('/admin/mdp-oublies-en-attente').catch(() => ({ data: [] }))
        setNbMdpOublies(en_attente.data.length)
      }
    } catch { /* ignore */ }
  }, [role])

  useEffect(() => {
    charger()
    const interval = setInterval(charger, 15000) // rafraîchit toutes les 15s
    return () => clearInterval(interval)
  }, [charger])

  // Recharger quand on quitte une fiche DA (les messages sont peut-être marqués lus)
  useEffect(() => {
    if (!location.pathname.includes('/demandes/')) charger()
  }, [location.pathname])

  // Recharger immédiatement après une action (valider/rejeter/BC créé/commande
  // passée/livraison reçue/confirmation...), même si on reste sur la fiche DA.
  // Avant, il fallait attendre le sondage de 15s ou changer de page pour voir
  // le badge se mettre à jour.
  useEffect(() => {
    const onRefresh = () => charger()
    window.addEventListener('biasa:refresh-badges', onRefresh)
    return () => window.removeEventListener('biasa:refresh-badges', onRefresh)
  }, [charger])

  const initiales = utilisateur
    ? `${utilisateur.prenom?.[0] ?? ''}${utilisateur.nom?.[0] ?? ''}`.toUpperCase()
    : '?'

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const dot = (active: boolean) => ({
    width: 5, height: 5, borderRadius: '50%',
    background: active ? '#0B3C7A' : '#d4d4d0',
    flexShrink: 0,
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)', position: 'relative' }}>

      {confirmLogout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px', width: 320, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15.5, fontWeight: 500, color: '#0B3C7A', marginBottom: 6 }}>Se déconnecter</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20 }}>Voulez-vous vraiment vous déconnecter ?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmLogout(false)} style={{ padding: '6px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button onClick={() => { logout(); navigate('/login') }} style={{ padding: '6px 14px', fontSize: 13.5, border: 'none', borderRadius: 6, background: '#c0392b', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {estMobile && menuMobileOuvert && (
        <div onClick={() => setMenuMobileOuvert(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }} />
      )}

      {/* SIDEBAR */}
      <aside className="no-print" style={{
        width: 200, minWidth: 200, background: 'var(--bg-primary)', borderRight: '1px solid #e3e9f1',
        display: 'flex', flexDirection: 'column',
        ...(estMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 95,
          transform: menuMobileOuvert ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        } : {
          position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
        }),
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <img src="/logo_biasa.png" alt="Clinique BIASA" style={{ height: 28, objectFit: 'contain', display: 'block', marginBottom: 4 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0B3C7A' }}>Clinique BIASA</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Gestion des achats</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1, overflowY: 'auto' as const, minHeight: 0 }}>
          <NavItem to="/" label="Tableau de bord" dot={dot} exact />
          <NavItem to="/mes-demandes" label="Mes demandes" dot={dot} />

          {/* Rejetées — accès direct pour tous, sauf l'acheteur qui a sa propre
              entrée plus bas (vue "Toutes les DA", données de tout le circuit) */}
          {!(estAcheteur && !estAdmin) && (
            <NavItem to="/mes-demandes?statut=rejetee" label="Rejetées" dot={dot} />
          )}

          {/* Messagerie — toujours visible, badge si non lus */}
          <NavItem to="/mes-demandes?vue=messagerie" label="Messagerie" dot={dot} badge={nbMessages > 0 ? nbMessages : undefined} badgeCouleur="#c0392b" />

          {(estValidateur || (estAcheteur && !estAdmin)) && (
            <NavItem
              to="/a-valider"
              label={estAcheteur && !estAdmin ? 'Toutes les DA' : 'À valider'}
              dot={dot}
              badge={nbAValider}
              badgeCouleur="#e24b4a"
            />
          )}

          {/* Réceptions et Rejetées — accès direct pour acheteur, sur la même
              page "Toutes les DA" (données de tout le circuit, pas juste ses
              propres demandes) */}
          {(estAcheteur && !estAdmin) && (
            <>
              <NavItem to="/a-valider?statut=receptions" label="Réceptions" dot={dot} />
              <NavItem to="/a-valider?statut=rejetee" label="Rejetées" dot={dot} />
            </>
          )}

          {estValidateur && <NavItem to="/historique-validations" label="Historique" dot={dot} />}

          {estAdmin && (
            <>
              <div style={{ fontSize: 10.5, color: '#c4c4be', padding: '12px 10px 4px', letterSpacing: '0.8px', textTransform: 'uppercase' as const }}>Administration</div>
              <NavItem to="/admin" label="Tableau de bord" dot={dot} />
              <NavItem to="/admin/toutes-da" label="Toutes les DA / Rapports" dot={dot} />
              <NavItem to="/gestion-users" label="Utilisateurs" dot={dot} badge={nbMdpOublies > 0 ? nbMdpOublies : undefined} badgeCouleur="#c0392b" />
              <NavItem to="/parametres" label="Paramètres" dot={dot} />
              <NavItem to="/config-email" label="Config. email" dot={dot} />
              <NavItem to="/journal-audit" label="Journal d'audit" dot={dot} />
              <NavItem to="/services" label="Services" dot={dot} />
            </>
          )}
        </nav>

        {/* User + déconnexion — toujours visible grâce au sticky */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #eef2f7' }}>
          {/* Badge messages dans le profil si non lus */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative' as const, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 600, color: '#0B3C7A' }}>{initiales}</div>
              {nbMessages > 0 && (
                <span style={{ position: 'absolute' as const, top: -3, right: -3, background: '#c0392b', color: '#fff', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>{nbMessages > 9 ? '9+' : nbMessages}</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0B3C7A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{utilisateur?.prenom} {utilisateur?.nom}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'capitalize' as const }}>{utilisateur?.role}</div>
            </div>
          </div>
          {etatNotifs !== 'indisponibles' && (
            <button
              onClick={basculerNotifications}
              disabled={chargementNotifs}
              title={etatNotifs === 'actives' ? 'Désactiver les notifications de message sur ce poste' : 'Activer les notifications de message sur ce poste'}
              style={{
                width: '100%', padding: '5px 8px', fontSize: 12, fontWeight: 500, marginBottom: 6,
                border: '1px solid var(--border)', borderRadius: 6,
                background: etatNotifs === 'actives' ? '#eaf6ee' : 'transparent',
                color: etatNotifs === 'actives' ? '#1e8f5f' : 'var(--text-secondary)',
                cursor: chargementNotifs ? 'wait' : 'pointer',
              }}
            >
              {chargementNotifs ? '…' : etatNotifs === 'actives' ? '🔔 Notifications activées' : '🔕 Activer les notifications'}
            </button>
          )}
          <button onClick={() => setConfirmLogout(true)} style={{ width: '100%', padding: '5px 8px', fontSize: 12.5, fontWeight: 600, border: '1px solid #f0b8b3', borderRadius: 6, background: '#fcebeb', cursor: 'pointer', color: '#a32d2d' }}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: estMobile ? '100%' : undefined }}>
        {/* Topbar */}
        <div className="no-print" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {estMobile && (
              <button onClick={() => setMenuMobileOuvert(true)} aria-label="Ouvrir le menu" style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', padding: '5px 9px', fontSize: 14.5, color: '#0B3C7A', flexShrink: 0 }}>Menu</button>
            )}
            <div className="hide-mobile" style={{ fontSize: 12.5, color: 'var(--text-muted)', textTransform: 'capitalize' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{today}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {nbMessages > 0 && (
              <button
                onClick={() => navigate('/mes-demandes?vue=messagerie')}
                style={{ fontSize: 12.5, color: '#fff', background: '#c0392b', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' as const, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {nbMessages} message{nbMessages > 1 ? 's' : ''} non lu{nbMessages > 1 ? 's' : ''}
              </button>
            )}
            {nbAValider > 0 && (
              <button
                onClick={() => navigate('/a-valider')}
                style={{ fontSize: 12.5, color: '#a32d2d', background: '#fcebeb', border: '1px solid #f09595', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const, cursor: 'pointer' }}
              >
                {nbAValider} en attente
              </button>
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
  // React Router's NavLink only compares pathnames, so it ignores the query
  // string entirely — "Mes demandes" (/mes-demandes), "Rejetées"
  // (/mes-demandes?statut=rejetee) and "Messagerie" all share the same
  // pathname and used to light up together no matter which one was clicked.
  // We compare the full pathname + search instead so only the item matching
  // the current URL exactly (including its query string) is marked active.
  const location = useLocation()
  const [toPath, toSearch = ''] = to.split('?')
  const isActive = exact
    ? location.pathname === toPath && !toSearch
    : location.pathname === toPath && location.search.replace(/^\?/, '') === toSearch

  return (
    <NavLink
      to={to}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', fontSize: 13.5, borderRadius: 6,
        color: isActive ? '#0B3C7A' : '#5e6f85',
        fontWeight: isActive ? 500 : 400,
        background: isActive ? '#d6e8f6' : 'transparent',
        textDecoration: 'none', margin: '1px 0', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={dot(isActive)} />
        <span>{label}</span>
      </div>
      {badge != null && badge > 0 && (
        <span style={{ background: badgeCouleur, color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center' as const }}>
          {badge}
        </span>
      )}
    </NavLink>
  )
}
