import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { demandesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat, FichierDA } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, MOTIF_LABELS, ACTION_LABELS } from '../../types'
import client from '../../api/client'

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR')
const fmtD = (d: string) => new Date(d).toLocaleDateString('fr-FR')
const mtd: React.CSSProperties = { fontSize: 13.5, padding: '7px 8px', borderBottom: '1px solid var(--border)' }
const dotColor = (s: string) => s === 'approuvee' ? '#1B9DE0' : s === 'recue' ? '#0B3C7A' : s === 'rejetee' ? '#a32d2d' : ['att_responsable','att_daf'].includes(s) ? '#1B9DE0' : '#888'

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11.5, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}</span>
}

function IF({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

function ApercuFichier({ daId, fichierId, nom }: { daId: number; fichierId: number; nom: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const isPdf   = /\.pdf$/i.test(nom)
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(nom)
  const isWord  = /\.(doc|docx)$/i.test(nom)

  useEffect(() => {
    if (isWord) return
    let url: string | null = null
    client.get(`/demandes/${daId}/fichiers/${fichierId}/apercu`, { responseType: 'blob' })
      .then(res => {
        const mimeType = isPdf ? 'application/pdf' : res.data.type
        const blob = new Blob([res.data], { type: mimeType })
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => setSrc(null))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [daId, fichierId])

  // Word : message sans aperçu
  if (isWord) return (
    <div style={{ padding: '14px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{nom}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Aperçu non disponible — téléchargez pour ouvrir</div>
      </div>
    </div>
  )

  // Chargement en cours
  if (!src) return (
    <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-secondary)', fontSize: 12.5, color: 'var(--text-secondary)' }}>
      Chargement…
    </div>
  )

  if (isPdf) return (
    <iframe
      src={src}
      title={nom}
      style={{ width: '100%', height: 300, border: 'none', display: 'block', background: 'var(--bg-secondary)' }}
    />
  )

  return (
    <img
      src={src}
      alt={nom}
      style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: 'var(--bg-secondary)', display: 'block' }}
    />
  )
}

function ouvrirFichier(daId: number, fichierId: number, nom: string) {
  client.get(`/demandes/${daId}/fichiers/${fichierId}/apercu`, { responseType: 'blob' })
    .then(res => {
      const isPdf = /\.pdf$/i.test(nom)
      const mimeType = isPdf ? 'application/pdf' : res.data.type
      const blob = new Blob([res.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    })
    .catch(() => alert('Erreur lors de l\'ouverture du fichier'))
}

function telechargerFichier(daId: number, fichierId: number, nom: string) {
  client.get(`/demandes/${daId}/fichiers/${fichierId}/apercu`, { responseType: 'blob' })
    .then(res => {
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = nom
      a.click()
      URL.revokeObjectURL(url)
    })
    .catch(() => alert('Erreur lors du téléchargement'))
}

function telechargerPDF(daId: number, numero: string) {
  client.get(`/demandes/${daId}/pdf`, { responseType: 'blob' })
    .then(res => {
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    })
    .catch(() => alert('Erreur lors de la génération du PDF'))
}

function imprimerPDF(daId: number) {
  client.get(`/demandes/${daId}/pdf`, { responseType: 'blob' })
    .then(res => {
      const url = URL.createObjectURL(res.data)
      const w = window.open(url)
      if (w) {
        w.addEventListener('load', () => {
          w.print()
          URL.revokeObjectURL(url)
        })
      }
    })
    .catch(() => alert('Erreur lors de la génération du PDF'))
}

export default function DetailDAPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuthStore()
  const [da, setDa] = useState<DemandeAchat | null>(null)
  const [onglet, setOnglet] = useState<'info'|'articles'|'spec'|'historique'|'fichiers'>('info')
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(true)
  const [al, setAl] = useState(false)

  const charger = async () => {
    if (!id) return
    setLoading(true)
    try { setDa(await demandesApi.detail(Number(id))) }
    finally { setLoading(false) }
  }

  useEffect(() => { charger() }, [id])

  const act = async (fn: () => Promise<DemandeAchat>) => {
    setAl(true)
    try { setDa(await fn()); setCommentaire('') }
    catch (e: any) { alert(e.response?.data?.detail || 'Erreur') }
    finally { setAl(false) }
  }

  const rejeter = (fn: () => Promise<DemandeAchat>) => {
    if (commentaire.trim().length < 5) {
      alert('Un commentaire est obligatoire pour rejeter (minimum 5 caractères).')
      return
    }
    act(fn)
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Chargement…</div>
  if (!da) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Demande introuvable.</div>

  const peutValResp = utilisateur?.role === 'responsable'
  const peutValDaf  = utilisateur?.role === 'daf'
  const estAcheteur = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'

  const onglets: { key: typeof onglet; label: string }[] = [
    { key: 'info',       label: 'Informations' },
    { key: 'articles',   label: `Articles (${da.lignes.length})` },
    { key: 'spec',       label: 'Spécifications' },
    { key: 'historique', label: 'Historique' },
    { key: 'fichiers',   label: `Fichiers (${da.fichiers.length})` },
  ]

  const btnStyle: React.CSSProperties = {
    padding: '5px 12px', fontSize: 12.5,
    border: '1px solid var(--border)', borderRadius: 5,
    background: 'transparent', cursor: 'pointer',
    color: 'var(--text-secondary)',
  }

  return (
    <>
      {/* Header */}
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => navigate(-1)} style={btnStyle}>← Retour</button>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Demandes /</span>
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{da.numero}</span>
        <div style={{ flex: 1 }} />
        {estAcheteur && (
          <>
            <button onClick={() => telechargerPDF(da.id, da.numero)} style={btnStyle}>↓ Télécharger PDF</button>
            <button onClick={() => imprimerPDF(da.id)} style={btnStyle}>⎙ Imprimer</button>
          </>
        )}
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Carte récapitulative */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 19.5, fontWeight: 500 }}>{da.numero}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
            {da.demandeur.prenom} {da.demandeur.nom} · {da.service_demandeur} · {fmtD(da.date_demande)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Tag>{da.type_da === 'medical' ? 'Médical' : 'Bien/Service'}</Tag>
            <Tag>{URGENCE_LABELS[da.urgence]}</Tag>
            <Tag>{MOTIF_LABELS[da.motif]}</Tag>
            <Tag>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut) }} />
              {STATUT_LABELS[da.statut]}
            </Tag>
          </div>
        </div>

        {/* Bannière confirmation de réception — bien visible, en haut de page */}
        {(da.statut === 'approuvee' || da.statut === 'recue') && utilisateur?.id === da.demandeur.id && !da.confirmation_demandeur_le && (
          <div style={{ background: '#eaf2fb', border: '1.5px solid #1B9DE0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0B3C7A' }}>Avez-vous reçu votre commande ?</div>
              <div style={{ fontSize: 13.5, color: '#5e6f85', marginTop: 2 }}>Confirmez la réception pour clôturer le suivi de cette demande.</div>
            </div>
            <button
              disabled={al}
              onClick={() => act(() => demandesApi.confirmerReceptionDemandeur(da.id))}
              style={{ padding: '10px 18px', fontSize: 14.5, border: 'none', borderRadius: 7, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 700, whiteSpace: 'nowrap' as const }}
            >
              {al ? 'En cours…' : "J'ai reçu ma commande"}
            </button>
          </div>
        )}

        <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>

          {/* Onglets */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {onglets.map(o => (
                <button key={o.key} onClick={() => setOnglet(o.key)} style={{
                  padding: '9px 14px', fontSize: 13.5, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: onglet === o.key ? '1.5px solid var(--text-primary)' : '1.5px solid transparent',
                  color: onglet === o.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: onglet === o.key ? 500 : 400, marginBottom: -0.5,
                }}>{o.label}</button>
              ))}
            </div>

            <div style={{ padding: 14 }}>

              {onglet === 'info' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <IF label="Type"      value={da.type_da === 'medical' ? 'Médical & Consommables' : 'Bien / Service'} />
                  <IF label="Nature"    value={da.nature} />
                  <IF label="Motif"     value={MOTIF_LABELS[da.motif]} />
                  <IF label="Urgence"   value={URGENCE_LABELS[da.urgence]} />
                  {da.justification && <IF label="Justification" value={da.justification} full />}
                </div>
              )}

              {onglet === 'articles' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr>
                        {['N°','Désignation','Qté','Unité','Stock actuel','Réf. / Marque','Observation'].map(h => (
                          <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {da.lignes.map(l => (
                        <tr key={l.id}>
                          <td style={mtd}>{l.numero_ligne}</td>
                          <td style={mtd}>{l.designation}</td>
                          <td style={mtd}>{l.quantite}</td>
                          <td style={mtd}>{l.unite            || '—'}</td>
                          <td style={mtd}>{l.stock_actuel     || '—'}</td>
                          <td style={mtd}>{l.reference_marque || '—'}</td>
                          <td style={mtd}>{l.observation      || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {onglet === 'spec' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <IF label="Normes"               value={da.normes_certifications || '—'} />
                  <IF label="Date réception souhaitée" value={da.date_peremption_min||'—'} />
                  <IF label="Fournisseur suggéré"   value={da.fournisseur_suggere  || '—'} />
                  <IF label="Autres spécifications" value={da.autres_specs         || '—'} />
                  {da.lieu_utilisation && <IF label="Lieu d'utilisation" value={da.lieu_utilisation} full />}
                </div>
              )}

              {onglet === 'historique' && (
                <div>
                  {da.historique.length === 0 && (
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Aucune action enregistrée.</div>
                  )}
                  {da.historique.map(h => (
                    <div key={h.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.action.includes('rejet') ? '#a32d2d' : '#1B9DE0', marginTop: 3, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{h.utilisateur.prenom} {h.utilisateur.nom}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{fmt(h.date_action)} · {ACTION_LABELS[h.action]}</div>
                        {h.commentaire && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{h.commentaire}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {onglet === 'fichiers' && (
                <div>
                  {da.fichiers.length === 0 && (
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Aucun fichier joint.</div>
                  )}
                  {da.fichiers.map(f => {
                    const hasApercu = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i.test(f.nom_original)
                    return (
                      <div key={f.id} style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        {hasApercu && (
                          <ApercuFichier daId={da.id} fichierId={f.id} nom={f.nom_original} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{f.nom_original}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{Math.round(f.taille_octets / 1024)} Ko · {fmtD(f.uploade_le)}</div>
                          </div>
                          {estAcheteur ? (
                            <button
                              onClick={() => telechargerFichier(da.id, f.id, f.nom_original)}
                              style={btnStyle}
                            >
                              Télécharger
                            </button>
                          ) : (
                            <button
                              onClick={() => ouvrirFichier(da.id, f.id, f.nom_original)}
                              style={btnStyle}
                            >
                              Voir
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Aperçu visible par tous · Téléchargement réservé au service Achats.
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Panneau validation */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500 }}>Validation</div>
            <div style={{ padding: 14 }}>
              {[
                { label: 'Soumission',  done: !!da.soumise_le },
                { label: 'Responsable', done: ['att_daf','approuvee','rejetee','recue'].includes(da.statut) && da.statut !== 'att_responsable' },
                { label: 'DAF',         done: da.statut === 'approuvee' || da.statut === 'recue' },
                { label: 'Réception',  done: da.statut === 'recue' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 7 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.done ? '#eaf3de' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: s.done ? '#27500a' : 'var(--text-secondary)' }}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 13.5 }}>{s.label}</div>
                </div>
              ))}

              {peutValResp && da.statut === 'att_responsable' && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7, fontWeight: 500 }}>Votre décision</div>
                  <textarea
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    placeholder="Commentaire (obligatoire pour rejeter, min. 5 caractères)"
                    style={{ width: '100%', fontSize: 13.5, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none', minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      disabled={al}
                      onClick={() => rejeter(() => demandesApi.rejeterResponsable(da.id, commentaire))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: al ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                    >
                      {al ? 'En cours…' : 'Rejeter'}
                    </button>
                    <button
                      disabled={al}
                      onClick={() => act(() => demandesApi.validerResponsable(da.id, commentaire || undefined))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#1B9DE0', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                    >
                      {al ? 'En cours…' : 'Valider'}
                    </button>
                  </div>
                </div>
              )}

              {peutValDaf && da.statut === 'att_daf' && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7, fontWeight: 500 }}>Votre décision</div>
                  <textarea
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    placeholder="Commentaire (obligatoire pour rejeter, min. 5 caractères)"
                    style={{ width: '100%', fontSize: 13.5, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none', minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      disabled={al}
                      onClick={() => rejeter(() => demandesApi.rejeterDaf(da.id, commentaire))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: al ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                    >
                      {al ? 'En cours…' : 'Rejeter'}
                    </button>
                    <button
                      disabled={al}
                      onClick={() => act(() => demandesApi.validerDaf(da.id, commentaire || undefined))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#1B9DE0', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                    >
                      {al ? 'En cours…' : 'Valider'}
                    </button>
                  </div>
                </div>
              )}

              {(da.statut === 'approuvee' || da.statut === 'recue') && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 9, fontWeight: 500 }}>Confirmation de réception</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    La demande passe au statut « Reçue » une fois que <b>le demandeur</b> et <b>le Service Achats</b> ont chacun confirmé avoir bien reçu la commande.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 7 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: da.confirmation_demandeur_le ? '#dbeefc' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: da.confirmation_demandeur_le ? '#0B3C7A' : 'var(--text-secondary)', flexShrink: 0 }}>
                      {da.confirmation_demandeur_le ? '✓' : '1'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}>Confirmé par le demandeur</div>
                      {da.confirmation_demandeur_le && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(da.confirmation_demandeur_le)}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: da.confirmation_acheteur_le ? '#dbeefc' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: da.confirmation_acheteur_le ? '#0B3C7A' : 'var(--text-secondary)', flexShrink: 0 }}>
                      {da.confirmation_acheteur_le ? '✓' : '2'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}>Confirmé par le Service Achats</div>
                      {da.confirmation_acheteur_le && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(da.confirmation_acheteur_le)}</div>}
                    </div>
                  </div>

                  {utilisateur?.id === da.demandeur.id && !da.confirmation_demandeur_le && (
                    <button
                      disabled={al}
                      onClick={() => act(() => demandesApi.confirmerReceptionDemandeur(da.id))}
                      style={{ width: '100%', padding: '8px', fontSize: 13.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500, marginBottom: 6 }}
                    >
                      {al ? 'En cours…' : "J'ai reçu ma commande"}
                    </button>
                  )}

                  {estAcheteur && !da.confirmation_acheteur_le && (
                    <button
                      disabled={al}
                      onClick={() => act(() => demandesApi.confirmerReceptionAcheteur(da.id))}
                      style={{ width: '100%', padding: '8px', fontSize: 13.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                    >
                      {al ? 'En cours…' : 'Confirmer la livraison au demandeur'}
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
