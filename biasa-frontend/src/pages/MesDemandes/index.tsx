import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BadgeMessages from '../../components/BadgeMessages'
import { demandesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, MOTIF_LABELS, STATUT_COLORS, URGENCE_COLORS, LABEL_TYPE_DA } from '../../types'
import FormDA from '../../components/FormDA'

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const tdS: React.CSSProperties = { fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'

const PAGE_SIZE = 10

function dansLaPeriode(dateStr: string, periode: string): boolean {
  if (periode === 'tout') return true
  const d = new Date(dateStr)
  const maintenant = new Date()
  if (periode === 'jour') {
    return d.toDateString() === maintenant.toDateString()
  }
  if (periode === 'semaine') {
    const debut = new Date(maintenant)
    debut.setDate(maintenant.getDate() - maintenant.getDay() + (maintenant.getDay() === 0 ? -6 : 1)) // lundi
    debut.setHours(0, 0, 0, 0)
    return d >= debut
  }
  if (periode === 'mois') {
    return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear()
  }
  if (periode === 'annee') {
    return d.getFullYear() === maintenant.getFullYear()
  }
  return true
}

export default function MesDemandesPage() {
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [searchParams] = useSearchParams()
  const [filtreStatut, setFiltreStatut] = useState<string>(searchParams.get('statut') || 'tous')
  const vueMessagerie = searchParams.get('vue') === 'messagerie'

  // Mettre à jour le filtre si l'URL change (ex : clic sur "Rejetées" dans le menu)
  useEffect(() => {
    const s = searchParams.get('statut') || 'tous'
    setFiltreStatut(s)
    setPage(1)
  }, [searchParams.get('statut')])
  const [filtrePeriode, setFiltrePeriode] = useState<string>('tout')
  const navigate = useNavigate()
  const { utilisateur } = useAuthStore()

  // "Mes demandes" doit toujours signifier "les demandes que j'ai moi-même
  // soumises", pour tout le monde — y compris responsable/DAF/achats/admin.
  // Avant, ces rôles chargeaient ici TOUTES les demandes du circuit (comme sur
  // "À valider"/"Toutes les DA"), ce qui mélangeait "ce que j'ai demandé" et
  // "ce que je dois valider" dans la même liste, sous le même intitulé — d'où
  // la confusion. Seule la vue Messagerie garde une vision large (il faut
  // pouvoir repérer un message sur n'importe quelle demande qu'on peut voir,
  // pas seulement les siennes).
  const charger = async () => {
    setLoading(true)
    try {
      const role = utilisateur?.role
      if (vueMessagerie && role && ['acheteur', 'admin', 'responsable', 'daf'].includes(role)) {
        setDemandes(await demandesApi.toutesDemandesAcheteur().catch(() => demandesApi.mesDemandes()))
      } else {
        setDemandes(await demandesApi.mesDemandes())
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { charger() }, [vueMessagerie])

  const dernierMessage = (da: DemandeAchat) =>
    da.messages.length > 0 ? da.messages[da.messages.length - 1].date_envoi : da.date_demande

  const demandesFiltrees = demandes
    .filter(da => {
      if (vueMessagerie && da.messages.length === 0) return false
      if (filtreStatut !== 'tous' && da.statut !== filtreStatut) return false
      if (!dansLaPeriode(da.date_demande, filtrePeriode)) return false
      return true
    })
    .sort((a, b) => vueMessagerie
      ? new Date(dernierMessage(b)).getTime() - new Date(dernierMessage(a)).getTime()
      : 0
    )

  const totalPages = Math.ceil(demandesFiltrees.length / PAGE_SIZE)
  const demandesPage = demandesFiltrees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const FILTRES_STATUT: [string, string][] = [
    ['tous', 'Tous'], ['approuvee', 'Approuvées'], ['rejetee', 'Rejetées'], ['recue', 'Reçues'],
  ]
  const FILTRES_PERIODE: [string, string][] = [
    ['tout', 'Tout'], ['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['annee', 'Cette année'],
  ]

  const selStyle: React.CSSProperties = { fontSize: 13.5, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>{vueMessagerie ? 'Messagerie' : "Mes demandes d'achat"}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
            {vueMessagerie
              ? `${demandesFiltrees.length} demande(s) avec des messages`
              : demandes.length > 0 ? `${demandesFiltrees.length} / ${demandes.length} demande(s)` : 'Vous voyez uniquement vos demandes'}
          </div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '6px 14px', background: '#0B3C7A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
          + Nouvelle demande
        </button>
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <select value={filtreStatut} onChange={e => { setFiltreStatut(e.target.value); setPage(1) }} style={selStyle}>
          {FILTRES_STATUT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
          {FILTRES_PERIODE.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setFiltrePeriode(v); setPage(1) }}
              style={{
                padding: '6px 11px', fontSize: 13.5, borderRadius: 20, cursor: 'pointer',
                outline: filtrePeriode === v ? '2px solid #0B3C7A' : 'none',
                outlineOffset: filtrePeriode === v ? '-2px' : '0',
                background: filtrePeriode === v ? '#0B3C7A' : '#dde5ef',
                color: filtrePeriode === v ? '#fff' : '#0B3C7A',
                fontWeight: filtrePeriode === v ? 700 : 500,
              }}
            >{l}</button>
          ))}
        </div>
        {(filtreStatut !== 'tous' || filtrePeriode !== 'tout') && (
          <button onClick={() => { setFiltreStatut('tous'); setFiltrePeriode('tout'); setPage(1) }} style={{ fontSize: 12.5, color: '#0B3C7A', background: 'none', border: 'none', cursor: 'pointer' }}>Réinitialiser</button>
        )}
      </div>

      <div style={{ padding: '16px 18px', flex: 1 }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading
            ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
            : demandesFiltrees.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Aucune demande ne correspond à ces filtres.</div>
              : <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          {(vueMessagerie
                            ? ['N° DA','Dernier message','Statut','']
                            : ['N° DA','Date','Type','Motif','Urgence','Statut','Fichiers','']
                          ).map(h => (
                            <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {demandesPage.map(da => (
                          <tr key={da.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/demandes/${da.id}${vueMessagerie ? '?discussion=1' : ''}`)}>
                            <td style={tdS}><span style={{ fontWeight: 500 }}>{da.numero}</span><BadgeMessages da={da} /></td>
                            {vueMessagerie ? (
                              <td style={{ ...tdS, whiteSpace: 'normal' as const, maxWidth: 420 }}>
                                {da.messages.length > 0 && (() => {
                                  const dernier = da.messages[da.messages.length - 1]
                                  const texte = dernier.texte.length > 90 ? dernier.texte.slice(0, 90) + '…' : dernier.texte
                                  return (
                                    <div>
                                      <span style={{ fontWeight: 600, color: '#0B3C7A' }}>{dernier.auteur.prenom} {dernier.auteur.nom} : </span>
                                      <span style={{ color: 'var(--text-secondary)' }}>{texte}</span>
                                    </div>
                                  )
                                })()}
                              </td>
                            ) : (
                              <>
                                <td style={tdS}>{fmt(da.date_demande)}</td>
                                <td style={tdS}>{LABEL_TYPE_DA[da.type_da]}</td>
                                <td style={tdS}>{MOTIF_LABELS[da.motif]}</td>
                                <td style={tdS}><span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span></td>
                              </>
                            )}
                            <td style={tdS}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(da.statut) }} />
                                {STATUT_LABELS[da.statut]}
                              </span>
                            </td>
                            {!vueMessagerie && (
                              <td style={tdS}>{da.fichiers.length > 0 ? `${da.fichiers.length} fichier(s)` : '-'}</td>
                            )}
                            <td style={tdS} onClick={e => e.stopPropagation()}>
                              <button onClick={() => navigate(`/demandes/${da.id}${vueMessagerie ? '?discussion=1' : ''}`)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Voir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, demandesFiltrees.length)} sur {demandesFiltrees.length}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          style={{ padding: '4px 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                        >← Précédent</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: p === page ? '#0B3C7A' : 'transparent', color: p === page ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: p === page ? 600 : 400 }}
                          >{p}</button>
                        ))}
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          style={{ padding: '4px 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                        >Suivant →</button>
                      </div>
                    </div>
                  )}
                </>
          }
        </div>
      </div>

      {showForm && <FormDA onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); charger() }} />}
    </>
  )
}
