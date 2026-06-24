import type { DemandeAchat } from '../../types'

export default function BadgeMessages({ da }: { da: DemandeAchat }) {
  if (da.messages.length === 0) return null
  const vus = Number(localStorage.getItem(`messages_vus_${da.id}`) || 0)
  const nonVus = da.messages.length - vus
  return (
    <span
      title={`${da.messages.length} message(s)`}
      style={{
        fontSize: 10.5, marginLeft: 6, padding: '1px 6px', borderRadius: 9, fontWeight: 600,
        color: '#fff', background: nonVus > 0 ? '#c0392b' : '#8a96a3',
      }}
    >
      {nonVus > 0 ? `${nonVus} nv.` : da.messages.length}
    </span>
  )
}
