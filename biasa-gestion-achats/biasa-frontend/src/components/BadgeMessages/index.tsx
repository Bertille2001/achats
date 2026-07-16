import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchat } from '../../types'

export default function BadgeMessages({ da }: { da: DemandeAchat }) {
  const navigate = useNavigate()
  const { utilisateur } = useAuthStore()
  if (da.messages.length === 0) return null
  const vus = Number(localStorage.getItem(`messages_vus_${da.id}`) || 0)
  // Un message qu'on a soi-même envoyé ne compte jamais comme "nouveau".
  const nonVus = da.messages.slice(vus).filter(m => m.auteur?.id !== utilisateur?.id).length
  return (
    <span
      role="button"
      title="Voir la discussion"
      onClick={e => {
        // Empêche le clic de se propager à la ligne du tableau (qui a son
        // propre onClick vers la fiche sans le paramètre ?discussion=1) —
        // sinon la navigation ci-dessous serait écrasée par celle du parent.
        e.stopPropagation()
        navigate(`/demandes/${da.id}?discussion=1`)
      }}
      style={{
        fontSize: 10.5, marginLeft: 6, padding: '1px 6px', borderRadius: 9, fontWeight: 600,
        color: '#fff', background: nonVus > 0 ? '#c0392b' : '#8a96a3',
        cursor: 'pointer',
      }}
    >
      {nonVus > 0 ? `${nonVus} nv.` : da.messages.length}
    </span>
  )
}
