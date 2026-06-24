import { useEffect, useState } from 'react'
import BadgeMessages from '../../components/BadgeMessages'
import { Navigate, useNavigate } from 'react-router-dom'
import { demandesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS } from '../../types'

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const tdS: React.CSSProperties = {
  fontSize: 13.5, padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap' as const,
}

function dotColor(s: string) {
  return s === 'approuvee' ? '#1B9DE0' : s === 'rejetee' ? '#a32d2d'
    : ['att_responsable','att_daf'].includes(s) ? '#1B9DE0' : '#888'
}

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

export default function AValiderPage() {
  const { utilisateur } = useAuthStore()
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [vues, setVues] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('tout')
  const navigate = useNavigate()

  const estAcheteur = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'
  const accesAutorise = utilisateur && utilisateur.role !== 'demandeur'

  useEffect(() => {
    if (!accesAutorise) { setLoading(false); return }
    demandesApi.aValider()
      .then(d => setDemandes(d))
      .finally(() => setLoading(false))

    // Charger les DA déjà vues depuis localStorage
    const stored = localStorage.getItem('da_vues')
    if (stored) setVues(new Set(JSON.parse(stored)))
  }, [])

  const marquerVue = (id: number) => {
    const nouvelles = new Set(vues)
    nouvelles.add(id)
    setVues(nouvelles)
    localStorage.setItem('da_vues', JSON.stringify([...nouvelles]))
  }

  const nonVues = demandes.filter(d => !vues.has(d.id)).length
  const demandesFiltrees = demandes.filter(d => dansLaPeriode(d.date_demande, periode))

  const titre = estAcheteur ? 'DA approuvées' : 'Demandes à valider'
  const sousTitre = estAcheteur
    ? 'Demandes approuvées prêtes pour traitement'
    : 'En attente de votre décision'

  if (!accesAutorise) return <Navigate to="/" replace />

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>{titre}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>{sousTitre}</div>
        </div>
        {nonVues > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span style={{ background: '#c0392b', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginRight: 6 }}>{nonVues}</span>
            {estAcheteur ? 'nouvelle(s) DA à traiter' : 'nouvelle(s) à valider'}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
        {FILTRES_PERIODE.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setPeriode(v)}
            style={{
              padding: '6px 11px', fontSize: 12.5, borderRadius: 20, cursor: 'pointer',
              border: periode === v ? '1.5px solid #0B3C7A' : '1px solid var(--border)',
              background: periode === v ? '#1B9DE0' : 'var(--bg-primary)',
              color: periode === v ? '#fff' : 'var(--text-secondary)',
              fontWeight: periode === v ? 600 : 400,
            }}
          >{l}</button>
        ))}
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
          ) : demandesFiltrees.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>
              {estAcheteur ? 'Aucune DA approuvée pour le moment.' : 'Aucune demande en attente.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['', 'N° DA', 'Date', 'Demandeur', 'Service', 'Type', 'Urgence', 'Statut', ''].map((h, i) => (
                    <th key={i} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandesFiltrees.map(da => {
                  const nonVue = !vues.has(da.id)
                  return (
                    <tr
                      key={da.id}
                      onClick={() => { marquerVue(da.id); navigate(`/demandes/${da.id}`) }}
                      style={{ cursor: 'pointer', background: nonVue ? 'var(--bg-secondary)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {/* Indicateur non lu */}
                      <td style={{ ...tdS, width: 8, padding: '9px 6px' }}>
                        {nonVue && (
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#1B9DE0' }} />
                        )}
                      </td>
                      <td style={{ ...tdS, fontWeight: nonVue ? 600 : 500 }}>{da.numero}<BadgeMessages da={da} /></td>
                      <td style={tdS}>{fmtD(da.date_demande)}</td>
                      <td style={{ ...tdS, fontWeight: nonVue ? 500 : 400 }}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                      <td style={tdS}>{da.service_demandeur}</td>
                      <td style={tdS}>{da.type_da === 'medical' ? 'Médical' : 'Bien/Service'}</td>
                      <td style={tdS}>{URGENCE_LABELS[da.urgence]}</td>
                      <td style={tdS}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(da.statut) }} />
                          {STATUT_LABELS[da.statut]}
                        </span>
                      </td>
                      <td style={tdS}>
                        <button
                          onClick={e => { e.stopPropagation(); marquerVue(da.id); navigate(`/demandes/${da.id}`) }}
                          style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          {estAcheteur ? 'Traiter' : 'Valider'}
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
