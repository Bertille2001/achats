import { useModalStore } from '../../store/modal'

// Rendu une seule fois à la racine de l'appli (voir App.tsx). Écoute le
// store modal et affiche l'alerte/confirmation en cours, s'il y en a une.
export default function ModalGlobal() {
  const { ouvert, type, titre, message, resolve } = useModalStore()
  if (!ouvert) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,35,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={() => { if (type === 'alert') resolve?.(true) }}
    >
      <div
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, width: '100%', maxWidth: 400, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 18px 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{titre}</div>
        <div style={{ padding: '0 18px 18px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{message}</div>
        <div style={{ padding: '11px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {type === 'confirm' && (
            <button
              onClick={() => resolve?.(false)}
              style={{ padding: '7px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              Annuler
            </button>
          )}
          <button
            onClick={() => resolve?.(true)}
            autoFocus
            style={{ padding: '7px 14px', fontSize: 13.5, border: 'none', borderRadius: 6, background: type === 'confirm' ? '#c0392b' : '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
          >
            {type === 'confirm' ? 'Confirmer' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
