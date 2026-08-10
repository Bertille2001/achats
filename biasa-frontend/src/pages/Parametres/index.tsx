import { useEffect, useState } from 'react'
import client from '../../api/client'

const CATEGORIES = [
  { key: 'service', label: 'Services' },
  { key: 'poste', label: 'Postes / Fonctions' },
  { key: 'designation', label: 'Désignations articles' },
  { key: 'norme', label: 'Normes & certifications' },
  { key: 'fournisseur', label: 'Fournisseurs' },
  { key: 'unite', label: 'Unités' },
]

interface Val { id: number; valeur: string }

export default function ParametresPage() {
  const [categorie, setCategorie] = useState('service')
  const [vals, setVals] = useState<Val[]>([])
  const [nouvelle, setNouvelle] = useState('')
  const [loading, setLoading] = useState(false)

  const charger = async (cat: string) => {
    setLoading(true)
    try {
      const r = await client.get<Val[]>(`/parametres/${cat}`)
      setVals(r.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { charger(categorie) }, [categorie])

  const ajouter = async () => {
    if (!nouvelle.trim()) return
    try {
      await client.post('/parametres/', { categorie, valeur: nouvelle.trim() })
      setNouvelle('')
      charger(categorie)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    }
  }

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cette valeur ?')) return
    await client.delete(`/parametres/${id}`)
    charger(categorie)
  }

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Paramètres</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Valeurs prédéfinies pour l'autocomplétion des formulaires</div>
      </div>

      <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>

        {/* Catégories */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategorie(c.key)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 14px', fontSize: 13.5, cursor: 'pointer',
              background: categorie === c.key ? 'var(--bg-secondary)' : 'transparent',
              border: 'none', borderLeft: categorie === c.key ? '2px solid #0B3C7A' : '2px solid transparent',
              color: categorie === c.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: categorie === c.key ? 500 : 400,
            }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Valeurs */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={nouvelle}
              onChange={e => setNouvelle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouter()}
              placeholder={`Ajouter une valeur pour "${CATEGORIES.find(c => c.key === categorie)?.label}"…`}
              style={{ flex: 1, fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <button onClick={ajouter} style={{ padding: '7px 16px', fontSize: 13.5, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Ajouter
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5 }}>Chargement…</div>
          ) : vals.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5 }}>
              Aucune valeur enregistrée. Ajoutez-en une ci-dessus.
            </div>
          ) : (
            <div>
              {vals.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 13.5 }}>{v.valeur}</div>
                  <button onClick={() => supprimer(v.id)} style={{ padding: '3px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
