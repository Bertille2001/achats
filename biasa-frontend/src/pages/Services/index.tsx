import { useEffect, useState } from 'react'
import { servicesApi } from '../../api/demandes'
import type { ServiceConfig } from '../../types'

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = async () => {
    setLoading(true)
    try { setServices(await servicesApi.lister()) } finally { setLoading(false) }
  }
  useEffect(() => { charger() }, [])

  const basculer = async (nom: string, valeur: boolean) => {
    setEnCours(nom)
    try {
      const updated = await servicesApi.modifier(nom, valeur)
      setServices(prev => prev.map(s => s.nom === nom ? updated : s))
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Services</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
          Un service activé ici peut traiter lui-même ses commandes (BC créé / Commandé / Livré) sans passer par le Service Achats. N'importe quelle personne de ce service peut alors agir, quel que soit son rôle de compte.
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Chargement…</div>
          ) : services.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14.5 }}>Aucun service trouvé.</div>
          ) : (
            <div>
              {services.map(s => (
                <div key={s.nom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.nom}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: enCours === s.nom ? 'wait' : 'pointer', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Traite ses propres commandes
                    <span
                      onClick={() => enCours ? null : basculer(s.nom, !s.peut_traiter_soi_meme)}
                      style={{
                        width: 38, height: 22, borderRadius: 12, position: 'relative' as const,
                        background: s.peut_traiter_soi_meme ? '#1B9DE0' : '#d4d4d0',
                        transition: 'background 0.15s', flexShrink: 0,
                        opacity: enCours === s.nom ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        position: 'absolute' as const, top: 2, left: s.peut_traiter_soi_meme ? 18 : 2,
                        width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-primary)',
                        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
