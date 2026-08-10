import { useEffect, useState } from 'react'
import BadgeMessages from '../../components/BadgeMessages'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, MOTIF_LABELS, STATUT_COLORS, URGENCE_COLORS } from '../../types'

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'
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

const fmtMontant = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' FCFA'

export default function ToutesDaPage() {
  const navigate = useNavigate()
  const [demandes, setDemandes] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')
  const [statut, setStatut] = useState('')
  const [periode, setPeriode] = useState('tout')
  const [service, setService] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  useEffect(() => {
    client.get<DemandeAchat[]>('/admin/toutes-les-da')
      .then(r => setDemandes(r.data))
      .finally(() => setLoading(false))
  }, [])

  const services = Array.from(new Set(demandes.map(d => d.service_demandeur))).sort()

  const filtrees = demandes.filter(da => {
    const txt = `${da.numero} ${da.demandeur.prenom} ${da.demandeur.nom} ${da.service_demandeur}`.toLowerCase()
    const matchTxt = txt.includes(filtre.toLowerCase())
    const matchStatut = statut ? da.statut === statut : true
    const matchService = service ? da.service_demandeur === service : true
    const matchPeriode = dansLaPeriode(da.date_demande, periode)
    const d = new Date(da.date_demande)
    const matchDebut = dateDebut ? d >= new Date(dateDebut) : true
    const matchFin = dateFin ? d <= new Date(dateFin + 'T23:59:59') : true
    return matchTxt && matchStatut && matchService && matchPeriode && matchDebut && matchFin
  })

  const montantTotal = filtrees.reduce((s, da) => s + (da.montant_total_commande || 0), 0)
  const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <div className="no-print" style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Toutes les demandes d'achat</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>{filtrees.length} demande(s), vision globale du circuit</div>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: '7px 16px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer' }}
        >
          Imprimer / Exporter PDF
        </button>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* En-tête visible uniquement à l'impression */}
        <div className="print-only" style={{ display: 'none', marginBottom: 16 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0B2C5C' }}>Clinique BIASA — Rapport des demandes d'achat</div>
          <div style={{ fontSize: 12.5, color: '#4a617c', marginTop: 3 }}>
            Édité le {dateImpression}
            {periode !== 'tout' && ` · Période : ${FILTRES_PERIODE.find(([v]) => v === periode)?.[1]}`}
            {dateDebut && ` · Du ${new Date(dateDebut).toLocaleDateString('fr-FR')}`}
            {dateFin && ` au ${new Date(dateFin).toLocaleDateString('fr-FR')}`}
            {service && ` · Service : ${service}`}
            {statut && ` · Statut : ${STATUT_LABELS[statut as keyof typeof STATUT_LABELS]}`}
          </div>
        </div>

        {/* Résumé */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 140 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Demandes</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{filtrees.length}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Montant total (commandé)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{fmtMontant(montantTotal)}</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <input
            placeholder="Rechercher N° DA, demandeur, service…"
            value={filtre}
            onChange={e => setFiltre(e.target.value)}
            style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', width: 220 }}
          />
          <select
            value={statut}
            onChange={e => setStatut(e.target.value)}
            style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="att_responsable">Att. responsable</option>
            <option value="att_daf">Att. DAF</option>
            <option value="approuvee">Approuvée</option>
            <option value="rejetee">Rejetée</option>
            <option value="recue">Reçue</option>
          </select>
          <select
            value={service}
            onChange={e => setService(e.target.value)}
            style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          >
            <option value="">Tous les services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} title="Du" style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>au</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} title="Au" style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
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
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['N° DA','Date','Demandeur','Service','Type','Motif','Urgence','Statut','Montant','Fichiers',''].map(h => (
                      <th key={h} className={h === '' ? 'no-print' : undefined} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map(da => (
                    <tr key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{da.numero}<BadgeMessages da={da} /></td>
                      <td style={tdS}>{fmtD(da.date_demande)}</td>
                      <td style={tdS}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                      <td style={tdS}>{da.service_demandeur}</td>
                      <td style={tdS}>{da.type_da === 'medical' ? 'Médical' : 'Bien/Service'}</td>
                      <td style={tdS}>{MOTIF_LABELS[da.motif]}</td>
                      <td style={tdS}><span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span></td>
                      <td style={tdS}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut) }} />
                          {STATUT_LABELS[da.statut]}
                        </span>
                      </td>
                      <td style={tdS}>{da.montant_total_commande ? fmtMontant(da.montant_total_commande) : '-'}</td>
                      <td style={tdS}>{da.fichiers.length > 0 ? `${da.fichiers.length} fichier(s)` : '-'}</td>
                      <td className="no-print" style={tdS}>
                        <button onClick={() => navigate(`/demandes/${da.id}`)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Voir</button>
                      </td>
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
