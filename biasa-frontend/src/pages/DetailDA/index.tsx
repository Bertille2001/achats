import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { demandesApi, servicesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat, FichierDA } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, MOTIF_LABELS, ACTION_LABELS, STATUT_COLORS, URGENCE_COLORS } from '../../types'
import client from '../../api/client'
import { afficherAlerte } from '../../store/modal'

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR')
const fmtD = (d: string) => new Date(d).toLocaleDateString('fr-FR')
const mtd: React.CSSProperties = { fontSize: 13.5, padding: '7px 8px', borderBottom: '1px solid var(--border)' }
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'

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
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Aperçu non disponible, téléchargez pour ouvrir</div>
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
    .catch(() => afficherAlerte('Erreur lors de l\'ouverture du fichier'))
}

function telechargerFichier(daId: number, fichierId: number, nom: string) {
  // Utilise la vraie route de téléchargement (pas l'aperçu) : accessible à
  // toute personne pouvant voir la demande, avec le nom de fichier d'origine.
  client.get(`/demandes/${daId}/fichiers/${fichierId}/telecharger`, { responseType: 'blob' })
    .then(res => {
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = nom
      a.click()
      URL.revokeObjectURL(url)
    })
    .catch(() => afficherAlerte('Erreur lors du téléchargement'))
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
    .catch(() => afficherAlerte('Erreur lors de la génération du PDF'))
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
    .catch(() => afficherAlerte('Erreur lors de la génération du PDF'))
}

export default function DetailDAPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuthStore()
  const [da, setDa] = useState<DemandeAchat | null>(null)
  const [onglet, setOnglet] = useState<'info'|'articles'|'spec'|'historique'|'fichiers'>('info')
  const [commentaire, setCommentaire] = useState('')
  const [codeSignature, setCodeSignature] = useState('')
  const [showVerifCode, setShowVerifCode] = useState(false)
  const [codeSaisi, setCodeSaisi] = useState('')
  const [resultatVerif, setResultatVerif] = useState<boolean | null>(null)
  const [verifEnCours, setVerifEnCours] = useState(false)
  const [loading, setLoading] = useState(true)
  const [al, setAl] = useState(false)
  const [serviceAutorise, setServiceAutorise] = useState(false)
  const [messageTexte, setMessageTexte] = useState('')
  const [envoiMessage, setEnvoiMessage] = useState(false)
  const [messagesVusAvant, setMessagesVusAvant] = useState(0)
  const [nbMessagesAffiches, setNbMessagesAffiches] = useState(15)
  const [showCommandeForm, setShowCommandeForm] = useState(false)
  const [lignesCommande, setLignesCommande] = useState<{ designation: string; quantite: number; prix_unitaire: number }[]>([])
  const discussionRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const charger = async () => {
    if (!id) return
    setLoading(true)
    setNbMessagesAffiches(15)
    try {
      const data = await demandesApi.detail(Number(id))
      setMessagesVusAvant(Number(localStorage.getItem(`messages_vus_${data.id}`) || 0))
      setDa(data)
    }
    finally { setLoading(false) }
  }

  useEffect(() => { charger() }, [id])

  // Rafraîchissement automatique et discret (pas de "Chargement…", ne touche
  // pas au nombre de messages affichés ni au brouillon en cours de frappe) —
  // pour que les nouveaux messages arrivés pendant que la fiche est ouverte
  // apparaissent tout seuls, sans devoir recharger la page.
  useEffect(() => {
    if (!id) return
    const interval = setInterval(async () => {
      if (al || envoiMessage) return // n'écrase pas un état en cours d'action/envoi
      try {
        const data = await demandesApi.detail(Number(id))
        setDa(data)
      } catch { /* silencieux : on retentera au prochain tick */ }
    }, 10000)
    return () => clearInterval(interval)
  }, [id, al, envoiMessage])

  useEffect(() => {
    servicesApi.lister().then(services => {
      const s = services.find(s => s.nom === da?.service_demandeur)
      setServiceAutorise(!!s?.peut_traiter_soi_meme)
    }).catch(() => {})
  }, [da?.service_demandeur])

  // Marque les messages comme lus seulement quand la Discussion devient
  // réellement visible à l'écran (et pas dès l'ouverture de la fiche) — le
  // badge "X nouveaux" reste donc affiché tant que l'utilisateur n'a pas
  // vraiment vu les messages, au lieu de disparaître instantanément.
  useEffect(() => {
    if (!da || da.messages.length === 0 || !discussionRef.current) return
    const el = discussionRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && da.messages.length > messagesVusAvant) {
          localStorage.setItem(`messages_vus_${da.id}`, String(da.messages.length))
          setMessagesVusAvant(da.messages.length)
          window.dispatchEvent(new Event('biasa:refresh-badges'))
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [da?.id, da?.messages.length, messagesVusAvant])

  // Arrivée depuis le badge "X messages" d'une liste (?discussion=1) :
  // on va directement à la Discussion et on met le curseur dans le champ.
  useEffect(() => {
    if (!da || searchParams.get('discussion') !== '1') return
    discussionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    messageInputRef.current?.focus()
    // Nettoie le paramètre d'URL pour ne pas re-déclencher le scroll à
    // chaque rafraîchissement de la fiche (ex : après une action).
    const next = new URLSearchParams(searchParams)
    next.delete('discussion')
    setSearchParams(next, { replace: true })
  }, [da?.id])

  const act = async (fn: () => Promise<DemandeAchat>) => {
    setAl(true)
    try {
      setDa(await fn())
      setCommentaire('')
      setCodeSignature('')
      // Prévient la sidebar (badges "À traiter"/"Toutes les DA") de se
      // recalculer tout de suite, sans attendre le sondage de 15s ni un
      // changement de page.
      window.dispatchEvent(new Event('biasa:refresh-badges'))
    }
    catch (e: any) { afficherAlerte(e.response?.data?.detail || 'Erreur') }
    finally { setAl(false) }
  }

  // Pièce jointe rattachée directement à une étape du traitement (bon de
  // commande, facture...), utilisée comme preuve à "Commande passée" et
  // "Livraison reçue". uploadFichier renvoie le fichier seul (pas la DA
  // entière) : on l'ajoute donc à la liste déjà chargée en mémoire plutôt
  // que de renvoyer une requête complète.
  const [uploadEnCours, setUploadEnCours] = useState<string | null>(null)
  const uploaderPreuve = async (etapeCle: string, file: File) => {
    if (!da) return
    setUploadEnCours(etapeCle)
    try {
      const f = await demandesApi.uploadFichier(da.id, file)
      setDa({ ...da, fichiers: [...da.fichiers, f] })
    } catch (e: any) {
      afficherAlerte(e.response?.data?.detail || "Erreur lors de l'envoi du fichier")
    } finally {
      setUploadEnCours(null)
    }
  }

  const rejeter = (fn: () => Promise<DemandeAchat>) => {
    if (commentaire.trim().length < 5) {
      afficherAlerte('Un commentaire est obligatoire pour rejeter (minimum 5 caractères).')
      return
    }
    if (!codeSignature) {
      afficherAlerte('Entrez votre code de signature pour confirmer cette décision.')
      return
    }
    act(fn)
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Chargement…</div>
  if (!da) return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Demande introuvable.</div>

  // On ne peut jamais valider/rejeter sa propre demande, même si son compte a
  // le rôle responsable/DAF (n'importe qui peut soumettre une DA pour
  // lui-même) — le backend bloque déjà ce cas, on masque aussi les boutons
  // côté écran pour ne pas laisser croire que l'action est possible.
  const estSaPropreDemande = utilisateur?.id === da.demandeur.id
  const peutValResp = utilisateur?.role === 'responsable' && !estSaPropreDemande
  const peutValDaf  = utilisateur?.role === 'daf' && !estSaPropreDemande
  const estAcheteur = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'
  const peutTraiter = estAcheteur || (serviceAutorise && utilisateur?.service === da.service_demandeur)

  const verifierCode = async () => {
    if (!codeSaisi.trim()) return
    setVerifEnCours(true)
    setResultatVerif(null)
    try {
      const { data } = await client.get<{ valide: boolean }>(`/demandes/${da.id}/verifier-code`, { params: { code: codeSaisi } })
      setResultatVerif(data.valide)
    } catch {
      setResultatVerif(false)
    } finally {
      setVerifEnCours(false)
    }
  }
  // Le demandeur simple suit la progression (BC créé / commande passée /
  // livraison reçue) mais ne doit pas voir le détail chiffré de la commande
  // (quantités et prix réellement négociés/commandés) — ces informations
  // restent internes au circuit achats/validation.
  const peutVoirDetailCommande = utilisateur?.role !== 'demandeur'
  // Messages "nouveaux" depuis la dernière visite, en excluant toujours ceux
  // qu'on a soi-même envoyés : un message qu'on vient d'écrire ne doit
  // jamais s'afficher comme "nouveau" à ses propres yeux.
  const nbNouveauxMessages = da.messages.slice(messagesVusAvant).filter(m => m.auteur?.id !== utilisateur?.id).length

  const envoyerMessage = async () => {
    if (!messageTexte.trim()) return
    setEnvoiMessage(true)
    try {
      const updated = await demandesApi.envoyerMessage(da.id, messageTexte.trim())
      setDa(updated)
      setMessageTexte('')
      setMessagesVusAvant(updated.messages.length)
      localStorage.setItem(`messages_vus_${updated.id}`, String(updated.messages.length))
      window.dispatchEvent(new Event('biasa:refresh-badges'))
    } catch (e: any) {
      afficherAlerte(e.response?.data?.detail || 'Erreur lors de l\'envoi du message')
    } finally {
      setEnvoiMessage(false)
    }
  }

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
        {/* Bouton modifier — visible si brouillon ou rejeté pour le demandeur */}
        {utilisateur?.id === da.demandeur.id && ['brouillon', 'rejetee'].includes(da.statut) && !da.deja_renvoye && (
          <button
            onClick={() => navigate(`/demandes/${da.id}/modifier`)}
            style={{ ...btnStyle, background: da.statut === 'rejetee' ? '#fcebeb' : undefined, color: da.statut === 'rejetee' ? '#a32d2d' : undefined, fontWeight: da.statut === 'rejetee' ? 600 : 400, border: da.statut === 'rejetee' ? '1px solid #f09595' : undefined }}
          >
            {da.statut === 'rejetee' ? 'Corriger et renvoyer' : 'Modifier'}
          </button>
        )}
        {estAcheteur && (
          <>
            <button onClick={() => telechargerPDF(da.id, da.numero)} style={btnStyle}>↓ Télécharger PDF</button>
            <button onClick={() => imprimerPDF(da.id)} style={btnStyle}>⎙ Imprimer</button>
            <button onClick={() => { setShowVerifCode(v => !v); setResultatVerif(null) }} style={btnStyle}>🔎 Vérifier un code</button>
          </>
        )}
      </div>

      {showVerifCode && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Code imprimé sur le document :</span>
          <input
            value={codeSaisi}
            onChange={e => setCodeSaisi(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            style={{ fontSize: 13, padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', width: 160 }}
          />
          <button
            onClick={verifierCode}
            disabled={verifEnCours || !codeSaisi.trim()}
            style={{ padding: '5px 12px', fontSize: 12.5, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
          >
            {verifEnCours ? 'Vérification…' : 'Vérifier'}
          </button>
          {resultatVerif === true && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1e8f5f' }}>✓ Document authentique, non modifié</span>}
          {resultatVerif === false && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#c0392b' }}>✗ Code invalide — le document ne correspond pas aux données actuelles</span>}
        </div>
      )}

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Carte récapitulative */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 19.5, fontWeight: 500 }}>{da.numero}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
            {da.demandeur.prenom} {da.demandeur.nom} · {da.service_demandeur} · {fmtD(da.date_demande)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Tag>{da.type_da === 'medical' ? 'Médical' : 'Bien/Service'}</Tag>
            <Tag>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: URGENCE_COLORS[da.urgence] }} />
              <span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span>
            </Tag>
            <Tag>{MOTIF_LABELS[da.motif]}</Tag>
            <Tag>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut) }} />
              <span style={{ color: dotColor(da.statut), fontWeight: 600 }}>{STATUT_LABELS[da.statut]}</span>
            </Tag>
            <span
              onClick={() => { discussionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); messageInputRef.current?.focus() }}
              style={{
                fontSize: 11.5, padding: '2px 9px', borderRadius: 5, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                border: '1px solid var(--border)',
                background: nbNouveauxMessages > 0 ? '#fcebeb' : 'transparent',
                color: nbNouveauxMessages > 0 ? '#a32d2d' : 'var(--text-secondary)',
                fontWeight: nbNouveauxMessages > 0 ? 600 : 400,
              }}
            >
              Discussion {da.messages.length > 0 ? `(${da.messages.length})` : ''}
              {nbNouveauxMessages > 0 && ` · ${nbNouveauxMessages} nouveau${nbNouveauxMessages > 1 ? 'x' : ''}`}
            </span>
          </div>
        </div>

        {/* Bannière confirmation de réception — bien visible, en haut de page */}
        {(da.statut === 'approuvee' || da.statut === 'recue') && utilisateur?.id === da.demandeur.id && !da.confirmation_demandeur_le && da.livre_le && (
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid #0B3C7A', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0B3C7A' }}>Avez-vous reçu votre commande ?</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2 }}>Confirmez la réception pour clôturer le suivi de cette demande.</div>
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
                <button
                  key={o.key}
                  onClick={() => setOnglet(o.key)}
                  onMouseEnter={e => { if (onglet !== o.key) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                  onMouseLeave={e => { if (onglet !== o.key) e.currentTarget.style.background = 'transparent' }}
                  style={{
                    padding: '9px 14px', fontSize: 13.5, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: onglet === o.key ? '2px solid #0B3C7A' : '2px solid transparent',
                    color: onglet === o.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: onglet === o.key ? 600 : 400, marginBottom: -1,
                    transition: 'background 0.12s, color 0.12s',
                  }}>{o.label}</button>
              ))}
            </div>

            <div style={{ padding: 14 }}>

              {onglet === 'info' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <IF label="Type"      value={da.type_da === 'medical' ? 'Médical & Consommables' : 'Bien / Service'} />
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
                          <td style={mtd}>{l.unite            || '-'}</td>
                          <td style={mtd}>{l.stock_actuel     || '-'}</td>
                          <td style={mtd}>{l.reference_marque || '-'}</td>
                          <td style={mtd}>{l.observation      || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {onglet === 'spec' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <IF label="Normes"               value={da.normes_certifications || '-'} />
                  <IF label="Date réception souhaitée" value={da.date_peremption_min||'-'} />
                  <IF label="Fournisseur suggéré"   value={da.fournisseur_suggere  || '-'} />
                  <IF label="Autres spécifications" value={da.autres_specs         || '-'} />
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
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.action.includes('rejet') ? '#a32d2d' : '#0B3C7A', marginTop: 3, flexShrink: 0 }} />
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
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {hasApercu && (
                              <button
                                onClick={() => ouvrirFichier(da.id, f.id, f.nom_original)}
                                style={btnStyle}
                              >
                                Voir
                              </button>
                            )}
                            <button
                              onClick={() => telechargerFichier(da.id, f.id, f.nom_original)}
                              style={btnStyle}
                            >
                              Télécharger
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Aperçu et téléchargement visibles par toute personne pouvant voir cette demande.
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Panneau validation */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500 }}>Validation</div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
                {[
                  { label: 'Soumission',  done: !!da.soumise_le },
                  { label: 'Responsable', done: ['att_daf','approuvee','rejetee','recue'].includes(da.statut) && da.statut !== 'att_responsable' },
                  { label: 'DAF',         done: da.statut === 'approuvee' || da.statut === 'recue' },
                  { label: 'Réception',  done: da.statut === 'recue' },
                ].map((s, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: i < arr.length - 1 ? 1 : undefined }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.done ? '#0B3C7A' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: s.done ? '#fff' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {s.done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' as const, lineHeight: 1.2 }}>{s.label}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ height: 1, background: s.done ? '#0B3C7A' : 'var(--border)', flex: 1, marginTop: 10 }} />
                    )}
                  </div>
                ))}
              </div>

              {peutValResp && da.statut === 'att_responsable' && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 7, fontWeight: 500 }}>Votre décision</div>
                  <textarea
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    placeholder="Commentaire (obligatoire pour rejeter, min. 5 caractères)"
                    style={{ width: '100%', fontSize: 13.5, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none', minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
                  />
                  <input
                    type="password"
                    value={codeSignature}
                    onChange={e => setCodeSignature(e.target.value)}
                    placeholder="Votre code de signature"
                    style={{ width: '100%', fontSize: 13.5, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      disabled={al}
                      onClick={() => rejeter(() => demandesApi.rejeterResponsable(da.id, commentaire, codeSignature))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: al ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                    >
                      {al ? 'En cours…' : 'Rejeter'}
                    </button>
                    <button
                      disabled={al || !codeSignature}
                      onClick={() => act(() => demandesApi.validerResponsable(da.id, commentaire || undefined, codeSignature))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: 'none', borderRadius: 5, background: (al || !codeSignature) ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: (al || !codeSignature) ? 'not-allowed' : 'pointer', fontWeight: 500 }}
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
                  <input
                    type="password"
                    value={codeSignature}
                    onChange={e => setCodeSignature(e.target.value)}
                    placeholder="Votre code de signature"
                    style={{ width: '100%', fontSize: 13.5, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      disabled={al}
                      onClick={() => rejeter(() => demandesApi.rejeterDaf(da.id, commentaire, codeSignature))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: al ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                    >
                      {al ? 'En cours…' : 'Rejeter'}
                    </button>
                    <button
                      disabled={al || !codeSignature}
                      onClick={() => act(() => demandesApi.validerDaf(da.id, commentaire || undefined, codeSignature))}
                      style={{ flex: 1, padding: '6px', fontSize: 13.5, border: 'none', borderRadius: 5, background: (al || !codeSignature) ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: (al || !codeSignature) ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                    >
                      {al ? 'En cours…' : 'Valider'}
                    </button>
                  </div>
                </div>
              )}

              {(da.statut === 'approuvee' || da.statut === 'recue') && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Traitement de la commande</div>
                  {[
                    { label: 'Bon de commande créé', fait: da.bc_cree_le, action: () => act(() => demandesApi.marquerBcCree(da.id)), peut: peutTraiter && !da.bc_cree_le, cle: 'bc' },
                    {
                      label: 'Commande passée au fournisseur',
                      fait: da.commande_le,
                      action: () => {
                        // Pré-remplit avec les lignes demandées comme point de départ,
                        // mais l'acheteur peut tout modifier avant de valider : ce qui
                        // est réellement commandé (quantité, désignation) peut différer
                        // de la demande d'origine, et c'est ce prix-là qui compte.
                        setLignesCommande(
                          da.lignes.length > 0
                            ? da.lignes.map(l => ({ designation: l.designation, quantite: l.quantite, prix_unitaire: 0 }))
                            : [{ designation: '', quantite: 1, prix_unitaire: 0 }]
                        )
                        setShowCommandeForm(true)
                      },
                      peut: peutTraiter && !!da.bc_cree_le && !da.commande_le,
                      cle: 'commande',
                    },
                    { label: 'Livraison reçue', fait: da.livre_le, action: () => act(() => demandesApi.marquerLivre(da.id)), peut: peutTraiter && !!da.commande_le && !da.livre_le, cle: 'livraison' },
                  ].map((etape, i, arr) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: etape.fait ? '#0B3C7A' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: etape.fait ? '#fff' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {etape.fait ? '✓' : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: etape.fait ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{etape.label}</div>
                      {peutTraiter && (etape.cle === 'commande' || etape.cle === 'livraison') && (
                        <label
                          title="Joindre le bon de commande ou la facture comme preuve"
                          style={{ padding: '3px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: uploadEnCours ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', flexShrink: 0, opacity: uploadEnCours === etape.cle ? 0.6 : 1 }}
                        >
                          {uploadEnCours === etape.cle ? '…' : '📎'}
                          <input
                            type="file"
                            disabled={!!uploadEnCours}
                            style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) uploaderPreuve(etape.cle, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                      {etape.peut && (
                        <button
                          disabled={al}
                          onClick={etape.action}
                          style={{ padding: '3px 9px', fontSize: 11.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap' as const, flexShrink: 0 }}
                        >
                          Cocher
                        </button>
                      )}
                    </div>
                  ))}
                  {peutTraiter && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                      📎 = joindre le bon de commande ou la facture comme preuve (visible dans l'onglet Fichiers).
                    </div>
                  )}
                  {!peutTraiter && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Traité par le Service Achats{serviceAutorise ? ' ou votre service (autorisé)' : ''}.
                    </div>
                  )}
                  {peutVoirDetailCommande && da.commande_le && da.lignes_commande.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 5, fontWeight: 500 }}>Ce qui a été réellement commandé</div>
                      {da.lignes_commande.map(l => (
                        <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '3px 0' }}>
                          <span>{l.quantite} × {l.designation}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{(l.quantite * l.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', color: '#0B3C7A' }}>
                        <span>Total dépensé</span>
                        <span>{da.montant_total_commande.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(da.statut === 'approuvee' || da.statut === 'recue') && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 9, fontWeight: 500 }}>Confirmation de réception</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    La demande passe au statut « Reçue » dès que <b>le demandeur</b> confirme avoir bien reçu la commande.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: da.confirmation_demandeur_le ? '#dbeefc' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: da.confirmation_demandeur_le ? '#0B3C7A' : 'var(--text-secondary)', flexShrink: 0 }}>
                      {da.confirmation_demandeur_le ? '✓' : '•'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}>Confirmé par le demandeur</div>
                      {da.confirmation_demandeur_le && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(da.confirmation_demandeur_le)}</div>}
                    </div>
                  </div>

                  {utilisateur?.id === da.demandeur.id && !da.confirmation_demandeur_le && da.livre_le && (
                    <button
                      disabled={al}
                      onClick={() => act(() => demandesApi.confirmerReceptionDemandeur(da.id))}
                      style={{ width: '100%', padding: '8px', fontSize: 13.5, border: 'none', borderRadius: 5, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 500, marginBottom: 6 }}
                    >
                      {al ? 'En cours…' : "J'ai reçu ma commande"}
                    </button>
                  )}
                  {utilisateur?.id === da.demandeur.id && !da.confirmation_demandeur_le && !da.livre_le && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Vous pourrez confirmer la réception une fois que le Service Achats aura marqué la livraison comme reçue.
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>

        </div>

        {/* Discussion — visible par tous ceux qui voient cette demande */}
        <div ref={discussionRef} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            Discussion
            {da.messages.length > 0 && (
              <span style={{ fontSize: 11, color: '#fff', background: '#0B3C7A', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{da.messages.length}</span>
            )}
            {nbNouveauxMessages > 0 && (
              <span style={{ fontSize: 11, color: '#fff', background: '#c0392b', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                {nbNouveauxMessages} nouveau{nbNouveauxMessages > 1 ? 'x' : ''}
              </span>
            )}
          </div>
          <div style={{ padding: 14 }}>
            {da.messages.length === 0 ? (
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Aucun message pour l'instant. Tout le monde voyant cette demande verra les messages échangés ici.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 360, overflowY: 'auto' as const }}>
                {da.messages.length > nbMessagesAffiches && (
                  <button
                    onClick={() => setNbMessagesAffiches(n => n + 15)}
                    style={{ alignSelf: 'center', padding: '6px 14px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    Voir les {Math.min(15, da.messages.length - nbMessagesAffiches)} messages précédents
                  </button>
                )}
                {da.messages.slice(-nbMessagesAffiches).map(m => (
                  <div key={m.id} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: m.auteur.id === utilisateur?.id ? '#eaf2fb' : 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0B3C7A' }}>{m.auteur.prenom} {m.auteur.nom}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}>{fmt(m.date_envoi)}</span>
                    </div>
                    <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' as const }}>{m.texte}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                ref={messageInputRef}
                value={messageTexte}
                onChange={e => setMessageTexte(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage() } }}
                placeholder="Écrire un message à propos de cette demande…"
                style={{ flex: 1, fontSize: 13.5, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'none', minHeight: 40, boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
              />
              <button
                disabled={envoiMessage || !messageTexte.trim()}
                onClick={envoyerMessage}
                style={{ padding: '0 18px', fontSize: 13.5, border: 'none', borderRadius: 6, background: (envoiMessage || !messageTexte.trim()) ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: (envoiMessage || !messageTexte.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {envoiMessage ? '…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {showCommandeForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: '#0B3C7A', marginBottom: 4 }}>Commande passée : ce qui est réellement commandé</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Ajuste les désignations/quantités si ce qui est commandé diffère de la demande initiale, et indique le prix unitaire de chaque ligne.
            </div>

            {lignesCommande.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input
                  value={l.designation}
                  onChange={e => setLignesCommande(ls => ls.map((x, j) => j === i ? { ...x, designation: e.target.value } : x))}
                  placeholder="Désignation"
                  style={{ flex: 1, fontSize: 13, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <input
                  type="number" min={1} value={l.quantite}
                  onChange={e => setLignesCommande(ls => ls.map((x, j) => j === i ? { ...x, quantite: Number(e.target.value) } : x))}
                  placeholder="Qté"
                  style={{ width: 62, fontSize: 13, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <input
                  type="number" min={0} step="0.01" value={l.prix_unitaire}
                  onChange={e => setLignesCommande(ls => ls.map((x, j) => j === i ? { ...x, prix_unitaire: Number(e.target.value) } : x))}
                  placeholder="Prix unitaire"
                  style={{ width: 100, fontSize: 13, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => setLignesCommande(ls => ls.filter((_, j) => j !== i))}
                  disabled={lignesCommande.length <= 1}
                  title="Retirer cette ligne"
                  style={{ padding: '5px 9px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: lignesCommande.length <= 1 ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                >×</button>
              </div>
            ))}

            <button
              onClick={() => setLignesCommande(ls => [...ls, { designation: '', quantite: 1, prix_unitaire: 0 }])}
              style={{ fontSize: 12.5, color: '#0B3C7A', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 10 }}
            >+ Ajouter une ligne</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#0B3C7A', padding: '8px 0', borderTop: '1px solid var(--border)', marginBottom: 14 }}>
              <span>Total</span>
              <span>{lignesCommande.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCommandeForm(false)} disabled={al} style={{ padding: '7px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button
                disabled={al || lignesCommande.some(l => !l.designation.trim() || l.quantite <= 0 || l.prix_unitaire < 0)}
                onClick={async () => {
                  await act(() => demandesApi.marquerCommande(da.id, lignesCommande))
                  setShowCommandeForm(false)
                }}
                style={{ padding: '7px 16px', fontSize: 13.5, border: 'none', borderRadius: 6, background: al ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: al ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {al ? 'En cours…' : 'Valider la commande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
