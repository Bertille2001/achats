import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { demandesApi } from '../../api/demandes'
import FormDA from '../../components/FormDA'
import type { DemandeAchat } from '../../types'

export default function ModifierDAPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [da, setDa] = useState<DemandeAchat | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (!id) return
    demandesApi.detail(Number(id)).then(d => {
      if (!['brouillon', 'rejetee'].includes(d.statut)) {
        navigate(`/demandes/${id}`, { replace: true })
        return
      }
      setDa(d)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
  if (!da) return <div style={{ padding: 32, color: '#a32d2d', fontSize: 14.5 }}>Demande introuvable.</div>

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(`/demandes/${id}`)} style={{ fontSize: 13.5, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Retour</button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>Modifier la demande {da.numero}</div>
          {da.statut === 'rejetee' && (
            <div style={{ fontSize: 12.5, color: '#a32d2d', marginTop: 2 }}>
              Demande rejetée — vous pouvez la corriger et la renvoyer (une seule fois possible).
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {erreur && <div style={{ padding: '10px 14px', background: '#fcebeb', color: '#a32d2d', borderRadius: 8, marginBottom: 12, fontSize: 13.5 }}>{erreur}</div>}
        <FormDA
          valeurInitiale={{
            service_demandeur: da.service_demandeur,
            poste_fonction: da.poste_fonction || '',
            type_da: da.type_da,
            nature: da.nature,
            motif: da.motif,
            urgence: da.urgence,
            justification: da.justification || '',
            normes_certifications: da.normes_certifications || '',
            date_peremption_min: da.date_peremption_min || '',
            fournisseur_suggere: da.fournisseur_suggere || '',
            autres_specs: da.autres_specs || '',
            lieu_utilisation: da.lieu_utilisation || '',
            lignes: da.lignes.map((l, i) => ({
              numero_ligne: i + 1,
              designation: l.designation,
              quantite: l.quantite,
              unite: l.unite || 'unité',
              observation: l.observation || '',
              stock_actuel: l.stock_actuel || '',
              reference_marque: l.reference_marque || '',
              description_technique: l.description_technique || '',
            })),
          }}
          onSubmit={async (form) => {
            try {
              await demandesApi.modifier(Number(id), form)
              navigate(`/demandes/${id}`)
            } catch (e: any) {
              setErreur(e.response?.data?.detail || 'Erreur lors de la modification')
            }
          }}
          labelBouton="Enregistrer les modifications"
        />
      </div>
    </>
  )
}
