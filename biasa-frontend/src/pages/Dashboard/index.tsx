import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { demandesApi } from '../../api/demandes'
import type { DemandeAchat } from '../../types'
import { STATUT_LABELS, STATUT_COLORS } from '../../types'
import FormDA from '../../components/FormDA'

const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
const dotColor = (s: string) => STATUT_COLORS[s as keyof typeof STATUT_COLORS] || '#888'

function Stat({ label, value, color = '#0B3C7A' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 25.5, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

const ROLE_EXPLICATIONS: Record<string, string> = {
  demandeur: "Vous créez vos demandes d'achat et suivez leur avancement. Une fois la commande livrée, n'oubliez pas de confirmer la réception depuis la fiche de votre demande : c'est ce qui clôture le circuit.",
  responsable: "Vous validez en premier les demandes d'achat de votre service, avant le DAF. Vérifiez que le besoin est légitime et que les quantités sont raisonnables.",
  daf: "Vous validez l'engagement budgétaire après le responsable de service. Une fois votre validation faite, la demande est approuvée et peut être traitée par le Service Achats.",
  acheteur: "Vous traitez les demandes approuvées : sourcing, commande auprès du fournisseur, puis confirmation de la livraison une fois la commande remise au demandeur.",
  admin: "Vous avez une visibilité complète sur l'ensemble des demandes, des utilisateurs et des paramètres du système, en plus de pouvoir intervenir sur n'importe quelle étape en cas de besoin.",
}

export default function DashboardPage() {
  const { utilisateur } = useAuthStore()
  const navigate = useNavigate()
  const [mesDa, setMesDa] = useState<DemandeAchat[]>([])
  const [aValider, setAValider] = useState<DemandeAchat[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const role = utilisateur?.role

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [mes, val] = await Promise.all([
          demandesApi.mesDemandes(),
          role === 'demandeur' ? Promise.resolve([] as DemandeAchat[]) : demandesApi.aValider().catch(() => [] as DemandeAchat[]),
        ])
        setMesDa(mes)
        setAValider(val)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role])

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13.5 }}>Chargement…</div>

  const enCours = mesDa.filter(d => ['att_responsable','att_daf'].includes(d.statut)).length
  const approuvees = mesDa.filter(d => d.statut === 'approuvee').length
  const recues = mesDa.filter(d => d.statut === 'recue').length
  const ouvertes = mesDa.filter(d => !['recue', 'rejetee'].includes(d.statut)).length
  const urgentes = aValider.filter(d => d.urgence === 'haute').length

  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 16.5, fontWeight: 600, color: '#0B3C7A' }}>Bonjour, {utilisateur?.prenom}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {role === 'demandeur' && 'Résumé de vos demandes d\'achat'}
          {role === 'responsable' && 'Demandes en attente de votre validation'}
          {role === 'daf' && 'Demandes en attente de votre approbation'}
          {role === 'acheteur' && 'Demandes approuvées à traiter'}
          {role === 'admin' && 'Vue globale du système'}
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* Votre rôle dans le circuit */}
        {role && ROLE_EXPLICATIONS[role] && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0B3C7A', textTransform: 'uppercase' as const, letterSpacing: '1px', marginBottom: 4 }}>Votre rôle dans le circuit</div>
            <div style={{ fontSize: 13.5, color: '#1a2733', lineHeight: 1.5 }}>{ROLE_EXPLICATIONS[role]}</div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
          {(role === 'demandeur' || role === 'admin') && <>
            <Stat label="Demandes ouvertes" value={ouvertes} />
            <Stat label="En cours de validation" value={enCours} color="#0B3C7A" />
            <Stat label="En traitement" value={approuvees} color="#0B3C7A" />
            <Stat label="Reçues" value={recues} color="#0B3C7A" />
          </>}
          {(role === 'responsable' || role === 'daf') && <>
            <Stat label="À valider" value={aValider.length} color="#0B3C7A" />
            <Stat label="Urgentes" value={urgentes} color="#a32d2d" />
            <Stat label="Mes demandes" value={mesDa.length} />
          </>}
          {role === 'acheteur' && <>
            <Stat label="DA approuvées" value={aValider.length} color="#0B3C7A" />
            <Stat label="Mes demandes" value={mesDa.length} />
          </>}
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Dernières demandes */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>Dernières demandes</div>
              <button onClick={() => navigate('/mes-demandes')} style={{ fontSize: 12.5, color: '#0B3C7A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Voir tout →</button>
            </div>
            {mesDa.length === 0
              ? <div style={{ padding: '20px 14px', fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center' }}>Aucune demande</div>
              : mesDa.slice(0, 3).map(da => (
                <div key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ padding: '9px 14px', borderBottom: '1px solid #eaf2fb', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>{da.numero}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{fmt(da.date_demande)}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut), flexShrink: 0 }} />
                    {STATUT_LABELS[da.statut]}
                  </span>
                </div>
              ))
            }
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Actions rapides - demandeur */}
            {role === 'demandeur' && (
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A', marginBottom: 10 }}>Actions rapides</div>
                <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '10px 12px', fontSize: 13.5, border: '1px solid #0B3C7A', borderRadius: 7, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500, textAlign: 'left' as const, marginBottom: 6 }}>
                  + Nouvelle demande d'achat
                </button>
                <button onClick={() => navigate('/mes-demandes')} style={{ width: '100%', padding: '10px 12px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' as const }}>
                  Voir toutes mes demandes
                </button>
              </div>
            )}

            {/* DA à valider */}
            {(role === 'responsable' || role === 'daf' || role === 'acheteur') && (
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>
                    {role === 'acheteur' ? 'DA approuvées' : 'En attente'}
                  </div>
                  <button onClick={() => navigate('/a-valider')} style={{ fontSize: 12.5, color: '#0B3C7A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Voir tout →</button>
                </div>
                {aValider.length === 0
                  ? <div style={{ padding: '20px 14px', fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center' }}>Aucune demande en attente</div>
                  : aValider.slice(0, 3).map(da => (
                    <div key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ padding: '9px 14px', borderBottom: '1px solid #eaf2fb', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>{da.numero}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{da.demandeur?.prenom} {da.demandeur?.nom} · {fmt(da.date_demande)}</div>
                      </div>
                      {da.urgence === 'haute' && (
                        <span style={{ fontSize: 11.5, background: '#fcebeb', color: '#a32d2d', padding: '1px 6px', borderRadius: 8, border: '1px solid #f09595' }}>urgent</span>
                      )}
                    </div>
                  ))
                }
              </div>
            )}

            {/* Admin — vue globale */}
            {role === 'admin' && (
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>DA en attente</div>
                  <button onClick={() => navigate('/a-valider')} style={{ fontSize: 12.5, color: '#0B3C7A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Voir tout →</button>
                </div>
                {aValider.slice(0, 3).map(da => (
                  <div key={da.id} onClick={() => navigate(`/demandes/${da.id}`)} style={{ padding: '9px 14px', borderBottom: '1px solid #eaf2fb', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0B3C7A' }}>{da.numero}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{da.demandeur?.prenom} {da.demandeur?.nom}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: dotColor(da.statut), fontWeight: 600 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(da.statut), flexShrink: 0 }} />
                      {STATUT_LABELS[da.statut]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && <FormDA onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false) }} />}
    </>
  )
}
