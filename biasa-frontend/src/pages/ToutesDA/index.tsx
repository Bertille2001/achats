import { useEffect, useState } from 'react'
import BadgeMessages from '../../components/BadgeMessages'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, URGENCE_LABELS, MOTIF_LABELS, STATUT_COLORS, URGENCE_COLORS, LABEL_TYPE_DA } from '../../types'

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

const fmtMontant = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' FCFA'

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
  // Par défaut, les DA de plus de 2 ans ne sont pas chargées (archivées côté
  // serveur) pour garder la page rapide ; ce bouton les redemande à la
  // demande seulement.
  const [avecArchives, setAvecArchives] = useState(false)

  useEffect(() => {
    setLoading(true)
    client.get<DemandeAchat[]>('/admin/toutes-les-da', { params: avecArchives ? { archives: true } : {} })
      .then(r => setDemandes(r.data))
      .finally(() => setLoading(false))
  }, [avecArchives])

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
  const dasCommandees = filtrees.filter(da => da.montant_total_commande)
  const montantMoyen = dasCommandees.length ? montantTotal / dasCommandees.length : 0
  const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Analyse par service : nombre de demandes, montant dépensé et part du
  // total, triée du service qui coûte le plus cher au moins cher — c'est la
  // vue qu'un DAF ou un directeur cherche en premier dans ce genre de
  // rapport.
  const parService = Array.from(new Set(filtrees.map(da => da.service_demandeur)))
    .map(s => {
      const das = filtrees.filter(da => da.service_demandeur === s)
      const montant = das.reduce((sum, da) => sum + (da.montant_total_commande || 0), 0)
      return { service: s, nb: das.length, montant }
    })
    .sort((a, b) => b.montant - a.montant || b.nb - a.nb)
  const montantMax = Math.max(1, ...parService.map(s => s.montant))

  // Répartition par statut, pour voir d'un coup d'œil où en est le circuit
  // (combien en attente, approuvées, rejetées, reçues).
  const ORDRE_STATUTS: (keyof typeof STATUT_LABELS)[] = ['att_responsable', 'att_daf', 'approuvee', 'recue', 'rejetee', 'brouillon']
  const parStatut = ORDRE_STATUTS
    .map(s => ({ statut: s, nb: filtrees.filter(da => da.statut === s).length }))
    .filter(x => x.nb > 0)

  const exporterExcel = () => {
    const echapper = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const entetes = ['N° DA', 'Date', 'Demandeur', 'Service', 'Type', 'Motif', 'Urgence', 'Statut', 'Montant (FCFA)', 'Fichiers']
    const lignes = filtrees.map(da => [
      da.numero,
      fmtD(da.date_demande),
      `${da.demandeur.prenom} ${da.demandeur.nom}`,
      da.service_demandeur,
      LABEL_TYPE_DA[da.type_da],
      MOTIF_LABELS[da.motif],
      URGENCE_LABELS[da.urgence],
      STATUT_LABELS[da.statut],
      da.montant_total_commande || 0,
      da.fichiers.length,
    ])
    // Point-virgule comme séparateur (Excel en français découpe mal les
    // colonnes avec une simple virgule), BOM UTF-8 pour que les accents
    // s'affichent correctement à l'ouverture.
    const csv = [entetes, ...lignes].map(l => l.map(echapper).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport_da_biasa_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="no-print" style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Toutes les demandes d'achat</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>{filtrees.length} demande(s), vision globale du circuit</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exporterExcel}
            style={{ padding: '7px 16px', fontSize: 13.5, fontWeight: 600, border: '1px solid #0B3C7A', borderRadius: 6, background: '#fff', color: '#0B3C7A', cursor: 'pointer' }}
          >
            Exporter Excel
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: '7px 16px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer' }}
          >
            Imprimer / Exporter PDF
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* En-tête visible uniquement à l'impression */}
        <div className="print-only" style={{ display: 'none', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a617c', letterSpacing: '0.6px', textTransform: 'uppercase' as const }}>Clinique BIASA</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C', marginTop: 2 }}>Rapport des demandes d'achat</div>
          <div style={{ fontSize: 12.5, color: '#4a617c', marginTop: 4 }}>
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
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Montant total commandé</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{fmtMontant(montantTotal)}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Montant moyen par commande</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{dasCommandees.length ? fmtMontant(montantMoyen) : '0 FCFA'}</div>
          </div>
        </div>

        {/* Répartition par statut */}
        {parStatut.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
            {parStatut.map(({ statut: s, nb }) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, padding: '5px 11px', borderRadius: 20, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: dotColor(s) }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(s) }} />
                {nb} {STATUT_LABELS[s]}
              </span>
            ))}
          </div>
        )}

        {/* Dépenses par service */}
        {parService.length > 0 && (
          <div className="print-card" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Dépenses par service</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {parService.map(({ service: s, nb, montant }) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 160, flexShrink: 0, fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={s}>{s}</div>
                  <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 16, position: 'relative' as const, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (montant / montantMax) * 100)}%`, height: '100%', background: '#0B3C7A', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 130, flexShrink: 0, textAlign: 'right' as const, fontSize: 12.5, fontWeight: 600, color: '#0B2C5C' }}>{fmtMontant(montant)}</div>
                  <div style={{ width: 90, flexShrink: 0, textAlign: 'right' as const, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {montantTotal > 0 ? `${Math.round((montant / montantTotal) * 100)} %` : '0 %'} · {nb} DA
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <button
            onClick={() => setAvecArchives(v => !v)}
            title="Les demandes de plus de 2 ans sont masquées par défaut pour garder la page rapide"
            style={{
              padding: '6px 11px', fontSize: 12.5, borderRadius: 20, cursor: 'pointer',
              border: '1px solid ' + (avecArchives ? '#0B3C7A' : 'var(--border)'),
              background: avecArchives ? '#0B3C7A' : 'transparent',
              color: avecArchives ? '#fff' : 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >{avecArchives ? '✓ Archives incluses (+2 ans)' : 'Inclure les archives (+2 ans)'}</button>
        </div>

        <div className="print-card" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement…</div>
          ) : (
            <div className="print-table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {[
                      ['N° DA', undefined], ['Date', undefined], ['Demandeur', undefined], ['Service', undefined],
                      ['Type', 'no-print'], ['Motif', undefined], ['Urgence', 'no-print'], ['Statut', undefined],
                      ['Montant', undefined], ['Fichiers', 'no-print'], ['', 'no-print'],
                    ].map(([h, cls]) => (
                      <th key={h} className={cls} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map(da => (
                    <tr key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{da.numero}<span className="no-print"><BadgeMessages da={da} /></span></td>
                      <td style={tdS}>{fmtD(da.date_demande)}</td>
                      <td style={tdS}>{da.demandeur.prenom} {da.demandeur.nom}</td>
                      <td style={tdS}>{da.service_demandeur}</td>
                      <td className="no-print" style={tdS}>{LABEL_TYPE_DA[da.type_da]}</td>
                      <td style={tdS}>{MOTIF_LABELS[da.motif]}</td>
                      <td className="no-print" style={tdS}><span style={{ color: URGENCE_COLORS[da.urgence], fontWeight: 600 }}>{URGENCE_LABELS[da.urgence]}</span></td>
                      <td style={tdS}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut) }} />
                          {STATUT_LABELS[da.statut]}
                        </span>
                      </td>
                      <td style={tdS}>{da.montant_total_commande ? fmtMontant(da.montant_total_commande) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' as const }}>Non commandé</span>}</td>
                      <td className="no-print" style={tdS}>{da.fichiers.length > 0 ? `${da.fichiers.length} fichier(s)` : <span style={{ color: 'var(--text-muted)' }}>Aucun</span>}</td>
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
