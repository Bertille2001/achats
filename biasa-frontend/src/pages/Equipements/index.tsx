import { useEffect, useState } from 'react'
import { equipementsApi, type EquipementForm } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { Equipement, EtatEquipement } from '../../types'
import { ETAT_EQUIPEMENT_LABELS, ETAT_EQUIPEMENT_COLORS } from '../../types'

const tdS: React.CSSProperties = { fontSize: 13.5, padding: '9px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const inp: React.CSSProperties = { fontSize: 13, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' as const }

const formVide = (): EquipementForm => ({
  designation: '', reference: '', lieu_deploiement: '', responsable: '', etat: 'en_service', garantie_fin: '', prix_unitaire: undefined,
})

export default function EquipementsPage() {
  const { utilisateur } = useAuthStore()
  const [equipements, setEquipements] = useState<Equipement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EquipementForm>(formVide())
  const [enregistrement, setEnregistrement] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [filtreEtat, setFiltreEtat] = useState('')

  const peutModifier = utilisateur?.role === 'acheteur' || utilisateur?.role === 'admin'

  const charger = async () => {
    setLoading(true)
    try { setEquipements(await equipementsApi.lister()) } finally { setLoading(false) }
  }
  useEffect(() => { charger() }, [])

  const enregistrer = async () => {
    if (!form.designation.trim()) { alert('La désignation est obligatoire.'); return }
    setEnregistrement(true)
    try {
      await equipementsApi.creer(form)
      setForm(formVide())
      setShowForm(false)
      charger()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    } finally {
      setEnregistrement(false)
    }
  }

  const changerEtat = async (id: number, etat: EtatEquipement) => {
    try {
      const updated = await equipementsApi.modifier(id, { etat })
      setEquipements(prev => prev.map(e => e.id === id ? updated : e))
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    }
  }

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cet équipement du registre ?')) return
    try {
      await equipementsApi.supprimer(id)
      setEquipements(prev => prev.filter(e => e.id !== id))
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    }
  }

  const filtres = equipements.filter(e => {
    const txt = `${e.designation} ${e.reference || ''} ${e.lieu_deploiement || ''} ${e.responsable || ''}`.toLowerCase()
    if (filtre && !txt.includes(filtre.toLowerCase())) return false
    if (filtreEtat && e.etat !== filtreEtat) return false
    return true
  })

  const totalValeur = filtres.reduce((s, e) => s + (e.prix_unitaire || 0), 0)

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Équipements</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
            Tout ce qui a été acheté et déployé : {filtres.length} équipement(s), {totalValeur.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} au total
          </div>
        </div>
        {peutModifier && (
          <button onClick={() => setShowForm(true)} style={{ padding: '6px 14px', background: '#1B9DE0', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
            + Ajouter un équipement
          </button>
        )}
      </div>

      <div style={{ padding: '12px 18px 0', display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        <input
          placeholder="Rechercher désignation, référence, lieu, responsable…"
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
          style={{ ...inp, width: 280 }}
        />
        <select value={filtreEtat} onChange={e => setFiltreEtat(e.target.value)} style={inp}>
          <option value="">Tous les états</option>
          {Object.entries(ETAT_EQUIPEMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
          ) : filtres.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Aucun équipement enregistré.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Désignation', 'Référence', 'Lieu de déploiement', 'Responsable', 'Prix', 'Garantie', 'État', peutModifier ? '' : undefined].filter(Boolean).map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtres.map(eq => (
                    <tr key={eq.id}>
                      <td style={{ ...tdS, fontWeight: 500 }}>{eq.designation}</td>
                      <td style={tdS}>{eq.reference || '-'}</td>
                      <td style={tdS}>{eq.lieu_deploiement || '-'}</td>
                      <td style={tdS}>{eq.responsable || '-'}</td>
                      <td style={tdS}>{eq.prix_unitaire != null ? eq.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '-'}</td>
                      <td style={tdS}>{eq.garantie_fin || '-'}</td>
                      <td style={tdS}>
                        {peutModifier ? (
                          <select
                            value={eq.etat}
                            onChange={e => changerEtat(eq.id, e.target.value as EtatEquipement)}
                            style={{ ...inp, padding: '3px 6px', color: ETAT_EQUIPEMENT_COLORS[eq.etat], fontWeight: 600, border: '1px solid var(--border)' }}
                          >
                            {Object.entries(ETAT_EQUIPEMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: ETAT_EQUIPEMENT_COLORS[eq.etat], fontWeight: 600, fontSize: 12.5 }}>{ETAT_EQUIPEMENT_LABELS[eq.etat]}</span>
                        )}
                      </td>
                      {peutModifier && (
                        <td style={tdS}>
                          <button onClick={() => supprimer(eq.id)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: '#a32d2d' }}>Retirer</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: '#0B3C7A', marginBottom: 14 }}>Nouvel équipement</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input placeholder="Désignation *" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} style={inp} />
              <input placeholder="Référence / n° de série" value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} style={inp} />
              <input placeholder="Lieu de déploiement (service, salle...)" value={form.lieu_deploiement || ''} onChange={e => setForm({ ...form, lieu_deploiement: e.target.value })} style={inp} />
              <input placeholder="Responsable / utilisateur" value={form.responsable || ''} onChange={e => setForm({ ...form, responsable: e.target.value })} style={inp} />
              <div style={{ display: 'flex', gap: 9 }}>
                <input type="number" min={0} step="0.01" placeholder="Prix" value={form.prix_unitaire ?? ''} onChange={e => setForm({ ...form, prix_unitaire: e.target.value ? Number(e.target.value) : undefined })} style={{ ...inp, flex: 1 }} />
                <input placeholder="Fin de garantie (JJ/MM/AAAA)" value={form.garantie_fin || ''} onChange={e => setForm({ ...form, garantie_fin: e.target.value })} style={{ ...inp, flex: 1 }} />
              </div>
              <select value={form.etat} onChange={e => setForm({ ...form, etat: e.target.value })} style={inp}>
                {Object.entries(ETAT_EQUIPEMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setShowForm(false); setForm(formVide()) }} disabled={enregistrement} style={{ padding: '7px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button onClick={enregistrer} disabled={enregistrement} style={{ padding: '7px 16px', fontSize: 13.5, border: 'none', borderRadius: 6, background: enregistrement ? '#9ab4e8' : '#0B3C7A', color: '#fff', cursor: enregistrement ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
