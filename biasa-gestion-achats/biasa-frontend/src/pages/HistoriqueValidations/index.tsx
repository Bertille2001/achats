import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, ACTION_LABELS, STATUT_COLORS, URGENCE_COLORS } from '../../types'
import { useAuthStore } from '../../store/auth'

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const fmt = (d: string) => new Date(d).toLocaleString('fr-FR')
const tdS: React.CSSProperties = { fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'

function dansLaPeriode(dateStr: string, periode: string): boolean {
  if (periode === 'tout') return true
  const d = new Date(dateStr)
  const maintenant = new Date()
  if (periode === 'jour') return d.toDateString() === maintenant.toDateString()
  if (periode === 'semaine') {
    const debut = new Date(maintenant)
    debut.setDate(maintenant.getDate() - maintenant.getDay() + (maintenant.getDay() === 0 ? -6 : 1))
    debut.setHours(0, 0, 0, 0)
    return d >= debut
  }
  if (periode === 'mois') return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear()
  if (periode === 'annee') return d.getFullYear() === maintenant.getFullYear()
  return true
}
const FILTRES_PERIODE: [string, string][] = [
  ['tout', 'Tout'], ['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['annee', 'Cette année'],
]
const FILTRES_STATUT: [string, string][] = [
  ['tous', 'Tous'], ['approuvee', 'Approuvées'], ['rejetee', 'Rejetées'], ['recue', 'Reçues'],
]

export default function HistoriqueValidationsPage() {
  const { utilisateur } = useAuthStore()
  const navigate = useNavigate()
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('tout')
  const [statutFiltre, setStatutFiltre] = useState('tous')

  useEffect(() => {
    // Récupère toutes les DA où l'utilisateur a agi dans l'historique
    client.get<DemandeAchat[]>('/demandes/mes-validations')
      .then(r => setDemandes(r.data))
      .catch(() => setDemandes([]))
      .finally(() => setLoading(false))
  }, [])

  const demandesFiltrees = demandes.filter(da => {
    if (statutFiltre !== 'tous' && da.statut !== statutFiltre) return false
    if (!dansLaPeriode(da.date_demande, periode)) return false
    return true
  })

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Historique</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
          Toutes les demandes sur lesquelles vous avez agi — validées comme rejetées
        </div>
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <select value={statutFiltre} onChange={e => setStatutFiltre(e.target.value)} style={{ fontSize: 13.5, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          {FILTRES_STATUT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
          {FILTRES_PERIODE.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriode(v)}
              style={{
                padding: '6px 11px', fontSize: 12.5, borderRadius: 20, cursor: 'pointer',
                outline: periode === v ? '2px solid #0B3C7A' : 'none',
                outlineOffset: periode === v ? '-2px' : '0',
                background: periode === v ? '#1B9DE0' : '#dde5ef',
                color: periode === v ? '#fff' : '#0B3C7A',
                fontWeight: periode === v ? 700 : 500,
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
          ) : demandesFiltrees.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>
              Aucune demande ne correspond à ces filtres.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['N° DA', 'Date demande', 'Demandeur', 'Service', 'Urgence', 'Statut actuel', 'Votre action', 'Date action', ''].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demandesFiltrees.map(da => {
                    // Trouver l'action de cet utilisateur dans l'historique
                    const monAction = [...da.historique]
                      .reverse()
                      .find(h => h.utilisateur.id === utilisateur?.id)
                    return (
                      <tr key={da.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/demandes/${da.id}`)}>
                        <td style={tdS}><span style={{ fontWeight: 500 }}>{da.numero}</span></td>
                        <td style={tdS}>{fmtD(da.date_demande)}</td>
                        <td style={tdS}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                        <td style={tdS}>{da.service_demandeur}</td>
                        <td style={tdS}><span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span></td>
                        <td style={tdS}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(da.statut) }} />
                            {STATUT_LABELS[da.statut]}
                          </span>
                        </td>
                        <td style={tdS}>
                          {monAction ? (
                            <span style={{ fontSize: 12.5, color: monAction.action.includes('rejet') ? '#a32d2d' : 'var(--text-primary)', fontWeight: monAction.action.includes('rejet') ? 600 : 400 }}>{ACTION_LABELS[monAction.action]}</span>
                          ) : '—'}
                        </td>
                        <td style={tdS}>
                          {monAction ? fmt(monAction.date_action) : '—'}
                        </td>
                        <td style={tdS}>
                          <button onClick={() => navigate(`/demandes/${da.id}`)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            Voir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
