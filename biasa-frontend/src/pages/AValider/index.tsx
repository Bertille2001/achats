import { useEffect, useState } from 'react'
import BadgeMessages from '../../components/BadgeMessages'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { demandesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, STATUT_COLORS, URGENCE_COLORS } from '../../types'

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const tdS: React.CSSProperties = {
  fontSize: 13.5, padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap' as const,
}

function dotColor(s: string) {
  return STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'
}

// Aperçu compact des étapes de traitement (BC créé -> commande passée ->
// livraison reçue) directement sur la ligne, pour ne pas avoir à ouvrir
// chaque fiche pour savoir où en est une demande approuvée.
function EtapesTraitement({ da }: { da: DemandeAchat }) {
  if (!['approuvee', 'recue'].includes(da.statut)) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>-</span>
  }
  const etapes: [string, string | null][] = [
    ['BC', da.bc_cree_le],
    ['Commande', da.commande_le],
    ['Livraison', da.livre_le],
    // Tant que le demandeur n'a pas confirmé la réception, la chaîne n'est
    // pas terminée — même si BC/commande/livraison sont déjà tous verts.
    // Ça évite de croire qu'une DA est "finie" alors qu'il reste cette
    // dernière étape.
    ['Confirmée', da.confirmation_demandeur_le],
  ]
  return (
    <div
      style={{ display: 'flex', alignItems: 'center' }}
      title={etapes.map(([l, v]) => `${l} : ${v ? 'fait' : 'à faire'}`).join(' · ')}
    >
      {etapes.map(([label, fait], i) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
            background: fait ? '#1e8f5f' : '#eef0f3',
            color: fait ? '#fff' : '#9aa4b2',
            border: fait ? 'none' : '1px solid #d8dee6',
            whiteSpace: 'nowrap' as const,
          }}>{label}</span>
          {i < etapes.length - 1 && (
            <span style={{ width: 8, height: 1, background: fait ? '#1e8f5f' : '#d8dee6', margin: '0 2px' }} />
          )}
        </span>
      ))}
    </div>
  )
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
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [validationEnCours, setValidationEnCours] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filtreStatut = searchParams.get('statut') // ex: 'approuvee' pour le lien "Réceptions"

  const estAcheteur = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'
  const accesAutorise = utilisateur && utilisateur.role !== 'demandeur'

  // Validation groupée : uniquement pertinente pour responsable/DAF, sur les
  // DA qui attendent justement leur décision (pas de bulk pour l'acheteur,
  // dont le traitement est un vrai suivi étape par étape, pas une simple
  // validation).
  const statutCible = utilisateur?.role === 'responsable' ? 'att_responsable'
    : utilisateur?.role === 'daf' ? 'att_daf'
    : null

  useEffect(() => {
    if (!accesAutorise) { setLoading(false); return }
    const chargerDemandes = demandesApi.toutesDemandesAcheteur()
    chargerDemandes
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

  // "Réceptions" doit montrer tout le suivi de réception : aussi bien ce qui
  // attend encore une confirmation (approuvee) que ce qui a déjà été reçu et
  // confirmé des deux côtés (recue) — avant, "recue" disparaissait de cette
  // vue dès que le cycle était terminé, ce qui cachait justement ce qui avait
  // été reçu par les demandeurs.
  const demandesFiltrees = demandes
    .filter(d => dansLaPeriode(d.date_demande, periode))
    .filter(d => {
      if (!filtreStatut) return true
      if (filtreStatut === 'receptions') return d.statut === 'approuvee' || d.statut === 'recue'
      return d.statut === filtreStatut
    })
  // Compté sur la liste réellement affichée (pas sur toutes les DA), pour que
  // le nombre corresponde à ce qu'on voit vraiment à l'écran.
  const nonVues = demandesFiltrees.filter(d => !vues.has(d.id)).length

  const idsSelectionnables = statutCible
    ? demandesFiltrees.filter(d => d.statut === statutCible).map(d => d.id)
    : []
  const toutSelectionne = idsSelectionnables.length > 0 && idsSelectionnables.every(id => selection.has(id))

  const toggleSelection = (id: number) => {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleToutSelectionner = () => {
    setSelection(prev => {
      if (toutSelectionne) return new Set()
      return new Set(idsSelectionnables)
    })
  }

  const validerSelection = async () => {
    if (selection.size === 0 || !statutCible) return
    if (!window.confirm(`Valider ${selection.size} demande(s) sélectionnée(s) ?`)) return
    setValidationEnCours(true)
    const ids = [...selection]
    const resultats = await Promise.allSettled(
      ids.map(id => statutCible === 'att_responsable'
        ? demandesApi.validerResponsable(id)
        : demandesApi.validerDaf(id))
    )
    const echecs = resultats.filter(r => r.status === 'rejected').length
    setValidationEnCours(false)
    setSelection(new Set())
    const d = await demandesApi.toutesDemandesAcheteur()
    setDemandes(d)
    if (echecs > 0) {
      alert(`${ids.length - echecs} validée(s), ${echecs} en échec (statut déjà changé entre-temps ?).`)
    }
  }

  const titre = filtreStatut === 'receptions'
    ? 'Réceptions'
    : filtreStatut === 'rejetee'
    ? 'Rejetées'
    : 'Toutes les demandes d\'achat'
  const sousTitre = filtreStatut === 'receptions'
    ? 'Demandes approuvées en attente de réception, et déjà reçues'
    : filtreStatut === 'rejetee'
    ? 'Demandes rejetées, tous services confondus'
    : estAcheteur
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selection.size > 0 && (
            <button
              onClick={validerSelection}
              disabled={validationEnCours}
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: '#1e8f5f', color: '#fff', cursor: validationEnCours ? 'default' : 'pointer', opacity: validationEnCours ? 0.7 : 1 }}
            >
              {validationEnCours ? 'Validation…' : `Valider la sélection (${selection.size})`}
            </button>
          )}
          {nonVues > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span style={{ background: '#c0392b', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginRight: 6 }}>{nonVues}</span>
              {filtreStatut === 'rejetee'
                ? 'nouvelle(s) rejetée(s)'
                : estAcheteur ? 'nouvelle(s) DA à traiter' : 'nouvelle(s) à valider'}
            </div>
          )}
        </div>
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
                background: periode === v ? '#0B3C7A' : '#dde5ef',
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
          ) : demandesFiltrees.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>
              {'Aucune demande trouvée.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {statutCible && (
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', width: 20 }}>
                      {idsSelectionnables.length > 0 && (
                        <input type="checkbox" checked={toutSelectionne} onChange={toggleToutSelectionner} style={{ cursor: 'pointer' }} />
                      )}
                    </th>
                  )}
                  {(estAcheteur
                    ? ['', 'N° DA', 'Date', 'Demandeur', 'Service', 'Type', 'Urgence', 'Statut', 'Traitement', '']
                    : ['', 'N° DA', 'Date', 'Demandeur', 'Service', 'Type', 'Urgence', 'Statut', '']
                  ).map((h, i) => (
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
                      {statutCible && (
                        <td style={{ ...tdS, padding: '9px 6px' }} onClick={e => e.stopPropagation()}>
                          {da.statut === statutCible && (
                            <input type="checkbox" checked={selection.has(da.id)} onChange={() => toggleSelection(da.id)} style={{ cursor: 'pointer' }} />
                          )}
                        </td>
                      )}
                      {/* Indicateur non lu */}
                      <td style={{ ...tdS, width: 8, padding: '9px 6px' }}>
                        {nonVue && (
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0B3C7A' }} />
                        )}
                      </td>
                      <td style={{ ...tdS, fontWeight: nonVue ? 600 : 500 }}>{da.numero}<BadgeMessages da={da} /></td>
                      <td style={tdS}>{fmtD(da.date_demande)}</td>
                      <td style={{ ...tdS, fontWeight: nonVue ? 500 : 400 }}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                      <td style={tdS}>{da.service_demandeur}</td>
                      <td style={tdS}>{da.type_da === 'medical' ? 'Médical' : 'Bien/Service'}</td>
                      <td style={tdS}><span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span></td>
                      <td style={tdS}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(da.statut) }} />
                          {STATUT_LABELS[da.statut]}
                        </span>
                      </td>
                      {estAcheteur && (
                        <td style={tdS}><EtapesTraitement da={da} /></td>
                      )}
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
