import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS } from '../../types'

interface Stats {
  total_users: number
  total_da: number
  da_attente: number
  da_approuvees: number
  da_rejetees: number
  da_recues: number
}

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const dotColor = (s: string) => s === 'approuvee' ? '#1B9DE0' : s === 'rejetee' ? '#a32d2d' : ['att_responsable','att_daf'].includes(s) ? '#1B9DE0' : '#888'

const tdS: React.CSSProperties = { fontSize: 13.5, padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const card: React.CSSProperties = { background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }
const cardHead: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get<Stats>('/admin/stats'),
      client.get<DemandeAchat[]>('/admin/toutes-les-da'),
    ]).then(([s, d]) => {
      setStats(s.data)
      setDemandes(d.data.slice(0, 8))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Chargement…</div>

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Tableau de bord</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Vue d'ensemble — {new Date().toLocaleDateString('fr-FR')}</div>
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
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
      </div>
    </>
  )
}
