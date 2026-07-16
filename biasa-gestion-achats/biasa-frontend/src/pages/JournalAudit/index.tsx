import { useEffect, useState } from 'react'
import client from '../../api/client'

interface EntreeAudit {
  id: number
  username_saisi: string | null
  evenement: string
  details: string | null
  date_evenement: string
  utilisateur_nom: string | null
}

const EVENEMENT_LABELS: Record<string, string> = {
  connexion_reussie: 'Connexion réussie',
  connexion_echouee: 'Connexion échouée',
  compte_verrouille: 'Compte verrouillé',
  deverrouillage: 'Compte déverrouillé',
  changement_mdp: 'Mot de passe changé',
  demande_reinitialisation_mdp: 'Demande de réinitialisation',
  reinitialisation_mdp: 'Mot de passe réinitialisé',
}

const couleur = (e: string) => {
  if (e === 'connexion_reussie' || e === 'deverrouillage') return '#1B9DE0'
  if (e === 'connexion_echouee' || e === 'compte_verrouille') return '#a32d2d'
  return '#5e6f85'
}

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR')
const tdS: React.CSSProperties = { fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }

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

export default function JournalAuditPage() {
  const [entrees, setEntrees] = useState<EntreeAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('tout')

  useEffect(() => {
    client.get<EntreeAudit[]>('/admin/journal-audit').then(r => setEntrees(r.data)).finally(() => setLoading(false))
  }, [])

  const entreesFiltrees = entrees.filter(e => dansLaPeriode(e.date_evenement, periode))

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Journal d'audit</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Connexions, échecs, verrouillages et changements de mot de passe</div>
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
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

      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
          ) : entreesFiltrees.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Aucun événement pour cette période.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Date', 'Compte', 'Événement', 'Détails'].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entreesFiltrees.map(e => (
                    <tr key={e.id}>
                      <td style={tdS}>{fmt(e.date_evenement)}</td>
                      <td style={tdS}>{e.utilisateur_nom || e.username_saisi || '—'}</td>
                      <td style={tdS}>
                        <span style={{ color: couleur(e.evenement), fontWeight: 500 }}>{EVENEMENT_LABELS[e.evenement] || e.evenement}</span>
                      </td>
                      <td style={{ ...tdS, whiteSpace: 'normal' as const, color: 'var(--text-secondary)' }}>{e.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
