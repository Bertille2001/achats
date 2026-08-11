import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { Navigate } from 'react-router-dom'
import { pharmacieApi } from '../../api/demandes'
import client from '../../api/client'
import type { SortiePharmacie, SortiePharmacieForm, LigneSortiePharmacieForm } from '../../types'
import { afficherAlerte, demanderConfirmation } from '../../store/modal'

const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const aujourdhui = () => new Date().toISOString().slice(0, 16)

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

const inp: React.CSSProperties = {
  fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
}
const ligneVide = (): LigneSortiePharmacieForm => ({ produit: '', quantite: 1, unite: '' })
const formVide = (): SortiePharmacieForm => ({ date_sortie: aujourdhui(), service: '', commentaire: '', lignes: [ligneVide()] })

export default function PharmaciePage() {
  const { utilisateur } = useAuthStore()
  const accesAutorise = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'

  const [sorties, setSorties] = useState<SortiePharmacie[]>([])
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SortiePharmacieForm>(formVide())
  const [saving, setSaving] = useState(false)

  const [filtre, setFiltre] = useState('')
  const [filtreService, setFiltreService] = useState('')
  const [periode, setPeriode] = useState('tout')

  const charger = () => {
    setLoading(true)
    pharmacieApi.lister().then(setSorties).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!accesAutorise) return
    charger()
    client.get<string[]>('/autocomplete/services').then(r => setServices(r.data)).catch(() => {})
  }, [])

  if (!accesAutorise) return <Navigate to="/" replace />

  // Suggestions de produits déjà saisis, pour l'autocomplétion — pas besoin
  // d'une liste prédéfinie séparée, ça s'enrichit tout seul avec l'usage.
  const produitsConnus = Array.from(new Set(sorties.flatMap(s => s.lignes.map(l => l.produit)))).sort()

  const filtrees = sorties.filter(s => {
    const txt = `${s.service} ${s.lignes.map(l => l.produit).join(' ')} ${s.enregistre_par.prenom} ${s.enregistre_par.nom}`.toLowerCase()
    const matchTxt = txt.includes(filtre.toLowerCase())
    const matchService = filtreService ? s.service === filtreService : true
    const matchPeriode = dansLaPeriode(s.date_sortie, periode)
    return matchTxt && matchService && matchPeriode
  })

  const parService = Array.from(new Set(filtrees.map(s => s.service)))
    .map(srv => {
      const du = filtrees.filter(s => s.service === srv)
      const nbProduits = du.reduce((sum, s) => sum + s.lignes.reduce((a, l) => a + l.quantite, 0), 0)
      return { service: srv, nb: du.length, nbProduits }
    })
    .sort((a, b) => b.nb - a.nb)
  const nbMax = Math.max(1, ...parService.map(s => s.nb))

  const parProduit = new Map<string, number>()
  filtrees.forEach(s => s.lignes.forEach(l => parProduit.set(l.produit, (parProduit.get(l.produit) || 0) + l.quantite)))
  const topProduits = Array.from(parProduit.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const set = (k: keyof SortiePharmacieForm, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setLigne = (i: number, k: keyof LigneSortiePharmacieForm, v: any) =>
    setForm(f => ({ ...f, lignes: f.lignes.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }))
  const ajouterLigne = () => setForm(f => ({ ...f, lignes: [...f.lignes, ligneVide()] }))
  const retirerLigne = (i: number) => setForm(f => ({ ...f, lignes: f.lignes.length > 1 ? f.lignes.filter((_, idx) => idx !== i) : f.lignes }))

  const lignesValides = form.lignes.filter(l => l.produit.trim() && l.quantite > 0)
  const formValide = form.service.trim() !== '' && lignesValides.length > 0

  const enregistrer = async () => {
    if (!formValide) return
    setSaving(true)
    try {
      await pharmacieApi.creer({
        date_sortie: new Date(form.date_sortie).toISOString(),
        service: form.service.trim(),
        commentaire: form.commentaire.trim() || undefined as any,
        lignes: lignesValides.map(l => ({ produit: l.produit.trim(), quantite: l.quantite, unite: l.unite.trim() })),
      })
      setForm(formVide())
      setShowForm(false)
      charger()
    } catch (e: any) {
      afficherAlerte(e.response?.data?.detail || "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const supprimer = async (id: number) => {
    if (!(await demanderConfirmation('Supprimer cette sortie ?'))) return
    try {
      await pharmacieApi.supprimer(id)
      charger()
    } catch (e: any) {
      afficherAlerte(e.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Pharmacie</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Retraits de produits par service, consommation par jour et par mois</div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ padding: '7px 16px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer' }}
        >
          {showForm ? 'Fermer' : '+ Enregistrer une sortie'}
        </button>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Formulaire d'enregistrement */}
        {showForm && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Date et heure</label>
                <input type="datetime-local" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.date_sortie} onChange={e => set('date_sortie', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Service *</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.service} onChange={e => set('service', e.target.value)} list="services-pharma" placeholder="Ex. Urgences" />
                <datalist id="services-pharma">{services.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Commentaire (optionnel)</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.commentaire} onChange={e => set('commentaire', e.target.value)} placeholder="Ex. retrait urgent" />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Produits retirés *</label>
            <datalist id="produits-pharma">{produitsConnus.map(p => <option key={p} value={p} />)}</datalist>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
              {form.lignes.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input style={{ ...inp, flex: 1 }} value={l.produit} onChange={e => setLigne(i, 'produit', e.target.value)} list="produits-pharma" placeholder="Désignation du produit" />
                  <input style={{ ...inp, width: 90 }} type="number" min={1} value={l.quantite} onChange={e => setLigne(i, 'quantite', Number(e.target.value))} placeholder="Qté" />
                  <input style={{ ...inp, width: 110 }} value={l.unite} onChange={e => setLigne(i, 'unite', e.target.value)} placeholder="Unité" />
                  <button
                    onClick={() => retirerLigne(i)}
                    disabled={form.lignes.length === 1}
                    style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: form.lignes.length === 1 ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', opacity: form.lignes.length === 1 ? 0.4 : 1 }}
                  >×</button>
                </div>
              ))}
            </div>
            <button onClick={ajouterLigne} style={{ padding: '5px 12px', fontSize: 12.5, border: '1px dashed var(--border-md)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#0B3C7A', fontWeight: 500, marginBottom: 14 }}>
              + Ajouter un produit
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setShowForm(false); setForm(formVide()) }} style={{ padding: '7px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button
                onClick={enregistrer}
                disabled={!formValide || saving}
                style={{ padding: '7px 16px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 6, background: (!formValide || saving) ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: (!formValide || saving) ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer la sortie'}
              </button>
            </div>
          </div>
        )}

        {/* Résumé */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 140 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Sorties enregistrées</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{filtrees.length}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 160 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Services distincts</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B2C5C' }}>{parService.length}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Service le plus demandeur</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0B2C5C' }}>{parService[0]?.service || '—'}</div>
          </div>
        </div>

        {/* Retraits par service */}
        {parService.length > 0 && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Retraits par service</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {parService.map(({ service: s, nb, nbProduits }) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 160, flexShrink: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={s}>{s}</div>
                  <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (nb / nbMax) * 100)}%`, height: '100%', background: '#0B3C7A', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 130, flexShrink: 0, textAlign: 'right' as const, fontSize: 12.5, fontWeight: 600, color: '#0B2C5C' }}>{nb} sortie{nb > 1 ? 's' : ''}</div>
                  <div style={{ width: 110, flexShrink: 0, textAlign: 'right' as const, fontSize: 11.5, color: 'var(--text-secondary)' }}>{nbProduits} unité{nbProduits > 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Produits les plus retirés */}
        {topProduits.length > 0 && (
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Produits les plus retirés</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {topProduits.map(([produit, qte]) => (
                <span key={produit} style={{ fontSize: 12.5, padding: '5px 11px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {produit} <strong style={{ color: '#0B3C7A' }}>×{qte}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <input
            placeholder="Rechercher service, produit, agent…"
            value={filtre}
            onChange={e => setFiltre(e.target.value)}
            style={{ ...inp, width: 220 }}
          />
          <select value={filtreService} onChange={e => setFiltreService(e.target.value)} style={inp}>
            <option value="">Tous les services</option>
            {Array.from(new Set(sorties.map(s => s.service))).sort().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
            {FILTRES_PERIODE.map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriode(v)}
                style={{
                  padding: '6px 11px', fontSize: 12.5, borderRadius: 20, cursor: 'pointer',
                  outline: periode === v ? '2px solid #0B3C7A' : 'none', outlineOffset: periode === v ? '-2px' : '0',
                  background: periode === v ? '#0B3C7A' : '#dde5ef', color: periode === v ? '#fff' : '#0B3C7A',
                  fontWeight: periode === v ? 700 : 500,
                }}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement…</div>
          ) : filtrees.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Aucune sortie enregistrée.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Date', 'Service', 'Produits', 'Enregistré par', 'Commentaire', ''].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }}>{fmtD(s.date_sortie)}</td>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{s.service}</td>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                        {s.lignes.map(l => `${l.produit} ×${l.quantite}${l.unite ? ' ' + l.unite : ''}`).join(', ')}
                      </td>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }}>{s.enregistre_par.prenom} {s.enregistre_par.nom}</td>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{s.commentaire || '—'}</td>
                      <td style={{ fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => supprimer(s.id)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: '#a32d2d' }}>Supprimer</button>
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
