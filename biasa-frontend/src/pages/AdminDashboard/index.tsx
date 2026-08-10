import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, STATUT_COLORS, URGENCE_COLORS } from '../../types'

interface Stats {
  total_users: number
  total_da: number
  da_attente: number
  da_approuvees: number
  da_rejetees: number
  da_recues: number
}

interface BucketStats {
  cle: string
  total: number
  montant: number
  [statut: string]: string | number
}

interface DashboardStats {
  par_mois: BucketStats[]
  par_service: BucketStats[]
  montant_total: number
}

interface UsageStats {
  total_connexions: number
  par_jour: { jour: string; connexions: number }[]
  par_utilisateur: { utilisateur: string; connexions: number }[]
}

const fmtMontant = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
const fmtMois = (cle: string) => {
  const [annee, mois] = cle.split('-')
  const noms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${noms[Number(mois) - 1]} ${annee}`
}

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'

const tdS: React.CSSProperties = { fontSize: 13.5, padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const card: React.CSSProperties = { background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }
const cardHead: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get<Stats>('/admin/stats'),
      client.get<DemandeAchat[]>('/admin/toutes-les-da'),
      client.get<DashboardStats>('/admin/dashboard-stats'),
      client.get<UsageStats>('/admin/usage-stats'),
    ]).then(([s, d, ds, us]) => {
      setStats(s.data)
      setDemandes(d.data.slice(0, 8))
      setDashStats(ds.data)
      setUsageStats(us.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Chargement…</div>

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Tableau de bord</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Vue d'ensemble du {new Date().toLocaleDateString('fr-FR')}</div>
      </div>

      <div style={{ padding: '16px 18px', overflow: 'auto' }}>

        {/* Stats */}
        <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Utilisateurs actifs', value: stats?.total_users ?? 0, sub: '' },
            { label: 'Total DA', value: stats?.total_da ?? 0, sub: 'toutes périodes' },
            { label: 'En attente', value: stats?.da_attente ?? 0, sub: 'validation requise' },
            { label: 'Approuvées', value: stats?.da_approuvees ?? 0, sub: '' },
            { label: 'Reçues', value: stats?.da_recues ?? 0, sub: '' },
            { label: 'Rejetées', value: stats?.da_rejetees ?? 0, sub: '' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 23.5, fontWeight: 500 }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

          {/* Toutes les DA */}
          <div style={card}>
            <div style={cardHead}>
              <span>Demandes récentes (toutes)</span>
              <button onClick={() => navigate('/admin/toutes-da')} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Voir tout</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['N° DA','Demandeur','Service','Date','Statut'].map(h => (
                    <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '7px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandes.map(da => (
                  <tr key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...tdS, fontWeight: 500 }}>{da.numero}</td>
                    <td style={tdS}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                    <td style={tdS}>{da.service_demandeur}</td>
                    <td style={tdS}>{fmtD(da.date_demande)}</td>
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut) }} />
                        {STATUT_LABELS[da.statut]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Raccourcis admin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={card}>
              <div style={cardHead}>
                <span>Gestion utilisateurs</span>
                <button onClick={() => navigate('/gestion-users')} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Ouvrir</button>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Utilisateurs actifs</div>
                <div style={{ fontSize: 19.5, fontWeight: 500 }}>{stats?.total_users}</div>
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}>
                <span>Paramètres</span>
                <button onClick={() => navigate('/parametres')} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Ouvrir</button>
              </div>
              <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Valeurs prédéfinies pour l'autocomplétion des formulaires (services, postes, désignations, normes, fournisseurs).
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}>
                <span>Configuration email</span>
                <button onClick={() => navigate('/config-email')} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Ouvrir</button>
              </div>
              <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Serveur SMTP pour les notifications automatiques aux validateurs et demandeurs.
              </div>
            </div>

          </div>
        </div>

        {/* Tableau de bord général : nb demandes par mois/service, fait/rejeté, dépenses */}
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          <div style={card}>
            <div style={cardHead}>
              <span>Par mois</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 400 }}>
                Dépensé au total : <b style={{ color: 'var(--text-primary)' }}>{fmtMontant(dashStats?.montant_total ?? 0)}</b>
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Mois', 'Total', 'Reçues', 'Rejetées', 'En cours', 'Dépensé'].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '7px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dashStats?.par_mois ?? []).slice(-12).reverse().map(m => (
                    <tr key={m.cle}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{fmtMois(m.cle)}</td>
                      <td style={tdS}>{m.total}</td>
                      <td style={{ ...tdS, color: '#1e8f5f' }}>{(m.recue as number) || 0}</td>
                      <td style={{ ...tdS, color: '#c0392b' }}>{(m.rejetee as number) || 0}</td>
                      <td style={tdS}>{m.total - ((m.recue as number) || 0) - ((m.rejetee as number) || 0)}</td>
                      <td style={tdS}>{fmtMontant(m.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={card}>
            <div style={cardHead}>
              <span>Par service</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Service', 'Total', 'Reçues', 'Rejetées', 'En cours', 'Dépensé'].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '7px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dashStats?.par_service ?? []).map(s => (
                    <tr key={s.cle}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{s.cle}</td>
                      <td style={tdS}>{s.total}</td>
                      <td style={{ ...tdS, color: '#1e8f5f' }}>{(s.recue as number) || 0}</td>
                      <td style={{ ...tdS, color: '#c0392b' }}>{(s.rejetee as number) || 0}</td>
                      <td style={tdS}>{s.total - ((s.recue as number) || 0) - ((s.rejetee as number) || 0)}</td>
                      <td style={tdS}>{fmtMontant(s.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Fréquence d'utilisation de l'appli */}
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={card}>
            <div style={cardHead}>
              <span>Fréquence d'utilisation</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 400 }}>{usageStats?.total_connexions ?? 0} connexions / 30 jours</span>
            </div>
            <div style={{ padding: '10px 14px' }}>
              {(usageStats?.par_jour ?? []).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Aucune connexion enregistrée récemment.</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
                  {(() => {
                    const max = Math.max(...(usageStats?.par_jour ?? []).map(j => j.connexions), 1)
                    return (usageStats?.par_jour ?? []).map(j => (
                      <div key={j.jour} title={`${j.jour} : ${j.connexions} connexion(s)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                        <div style={{ background: '#0B3C7A', borderRadius: '3px 3px 0 0', height: `${(j.connexions / max) * 100}%`, minHeight: j.connexions > 0 ? 3 : 0 }} />
                      </div>
                    ))
                  })()}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Connexions réussies par jour, 30 derniers jours.</div>
            </div>
          </div>

          <div style={card}>
            <div style={cardHead}><span>Utilisateurs les plus actifs</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Utilisateur', 'Connexions (30j)'].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '7px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(usageStats?.par_utilisateur ?? []).slice(0, 8).map(u => (
                    <tr key={u.utilisateur}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{u.utilisateur}</td>
                      <td style={tdS}>{u.connexions}</td>
                    </tr>
                  ))}
                  {(usageStats?.par_utilisateur ?? []).length === 0 && (
                    <tr><td style={{ ...tdS, color: 'var(--text-secondary)' }} colSpan={2}>Aucune donnée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Référence des droits par rôle — modifiable en changeant le rôle
            d'un utilisateur dans Gestion Utilisateurs, pas ici (pas de
            permissions par utilisateur individuel dans cette version). */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={cardHead}>
            <span>Rôles &amp; droits d'accès</span>
            <button onClick={() => navigate('/gestion-users')} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Gérer les utilisateurs</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Rôle', 'Peut voir', 'Peut faire'].map(h => (
                    <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '7px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { role: 'Demandeur', voir: 'Ses propres demandes uniquement', faire: 'Créer/soumettre une demande, confirmer la réception de sa commande, écrire des messages sur ses demandes' },
                  { role: 'Responsable', voir: 'Toutes les demandes (vision globale)', faire: 'Valider/rejeter les demandes en attente de son étape, sauf les siennes' },
                  { role: 'DAF', voir: 'Toutes les demandes (vision globale)', faire: 'Valider/rejeter après le responsable, sauf les siennes' },
                  { role: 'Achats (acheteur)', voir: 'Toutes les demandes + le registre équipements', faire: 'Traiter les demandes approuvées (BC, commande + prix, livraison), confirmer réception, gérer le registre équipements' },
                  { role: 'Admin', voir: 'Tout, y compris journal d\'audit et statistiques', faire: 'Tout ce que font les autres rôles, plus gestion des utilisateurs, services, config email et déverrouillage de comptes' },
                ].map(r => (
                  <tr key={r.role}>
                    <td style={{ ...tdS, fontWeight: 500, whiteSpace: 'normal' as const }}>{r.role}</td>
                    <td style={{ ...tdS, whiteSpace: 'normal' as const, color: 'var(--text-secondary)' }}>{r.voir}</td>
                    <td style={{ ...tdS, whiteSpace: 'normal' as const, color: 'var(--text-secondary)' }}>{r.faire}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
            Pour changer les droits d'une personne, change son rôle depuis Gestion Utilisateurs : les droits ci-dessus s'appliquent alors automatiquement.
          </div>
        </div>
      </div>
    </>
  )
}
