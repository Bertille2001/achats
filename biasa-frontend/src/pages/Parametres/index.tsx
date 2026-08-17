import { useEffect, useState } from 'react'
import client from '../../api/client'
import { afficherAlerte, demanderConfirmation } from '../../store/modal'

const CATEGORIES = [
  { key: 'service', label: 'Services' },
  { key: 'poste', label: 'Postes / Fonctions' },
  { key: 'designation', label: 'Désignations articles' },
  { key: 'norme', label: 'Normes & certifications' },
  { key: 'fournisseur', label: 'Fournisseurs' },
  { key: 'unite', label: 'Unités' },
]

// Les 16 services de la clinique — catégories du catalogue d'articles
// (chaque désignation peut être rattachée à l'un d'eux, ou laissée "Tous
// services" pour rester visible partout, comme avant cette fonctionnalité).
const SERVICES_CATALOGUE = [
  'Bloc opératoire et salle d\'Endoscopie',
  'Centre de Fertilité',
  'Comptabilité',
  'Contrôle de gestion',
  'Gynecologie-obstétrique et Maternité',
  'Hospitalisation Adultes et Soins à Domicile',
  'Imagerie Médicale',
  'Laboratoire de Biologie Médicales',
  'Moyens Généraux',
  'Pédiatrie et Néonatologie',
  'Pharmacie',
  'Bilan de santé et Services Interentreprises',
  'Service des ressources humaines',
  'Service informatique',
  'Service Portes Consultations et soins externes',
  'Urgences et Soins Intensifs',
]

interface Val { id: number; valeur: string; service?: string | null }

export default function ParametresPage() {
  const [categorie, setCategorie] = useState('service')
  const [vals, setVals] = useState<Val[]>([])
  const [nouvelle, setNouvelle] = useState('')
  const [nouveauService, setNouveauService] = useState('')
  const [filtreService, setFiltreService] = useState('')
  const [loading, setLoading] = useState(false)

  const estDesignations = categorie === 'designation'

  const charger = async (cat: string) => {
    setLoading(true)
    try {
      const r = await client.get<Val[]>(`/parametres/${cat}`)
      setVals(r.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { charger(categorie) }, [categorie])

  const valsAffichees = estDesignations && filtreService
    ? vals.filter(v => v.service === filtreService || !v.service)
    : vals

  const ajouter = async () => {
    if (!nouvelle.trim()) return
    try {
      await client.post('/parametres/', { categorie, valeur: nouvelle.trim(), service: estDesignations ? (nouveauService || null) : null })
      setNouvelle('')
      charger(categorie)
    } catch (e: any) {
      afficherAlerte(e.response?.data?.detail || 'Erreur')
    }
  }

  const supprimer = async (id: number) => {
    if (!(await demanderConfirmation('Supprimer cette valeur ?'))) return
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
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <input
              value={nouvelle}
              onChange={e => setNouvelle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouter()}
              placeholder={`Ajouter une valeur pour "${CATEGORIES.find(c => c.key === categorie)?.label}"…`}
              style={{ flex: 1, minWidth: 200, fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
            />
            {estDesignations && (
              <select
                value={nouveauService}
                onChange={e => setNouveauService(e.target.value)}
                style={{ fontSize: 13.5, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <option value="">Tous services</option>
                {SERVICES_CATALOGUE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={ajouter} style={{ padding: '7px 16px', fontSize: 13.5, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Ajouter
            </button>
          </div>

          {estDesignations && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Filtrer par service :</span>
              <select
                value={filtreService}
                onChange={e => setFiltreService(e.target.value)}
                style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <option value="">Tous</option>
                {SERVICES_CATALOGUE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5 }}>Chargement…</div>
          ) : valsAffichees.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13.5 }}>
              Aucune valeur enregistrée. Ajoutez-en une ci-dessus.
            </div>
          ) : (
            <div>
              {valsAffichees.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 13.5 }}>
                    {v.valeur}
                    {estDesignations && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                        {v.service || 'Tous services'}
                      </span>
                    )}
                  </div>
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
