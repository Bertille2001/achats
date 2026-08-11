import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

export default function CodeSignaturePage() {
  const { utilisateur, token, isAuthenticated, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const dejaDefini = !!utilisateur?.code_signature_defini

  const [motDePasse, setMotDePasse] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErreur('')
    setSucces('')
    if (nouveau.length < 4) { setErreur('Le code doit contenir au moins 4 caractères.'); return }
    if (nouveau !== confirmation) { setErreur('Les deux codes ne correspondent pas.'); return }
    setLoading(true)
    try {
      const updated = await authApi.definirCodeSignature(motDePasse, nouveau)
      if (token) setAuth(updated, token)
      setSucces('Code de signature enregistré.')
      setMotDePasse(''); setNouveau(''); setConfirmation('')
    } catch (e: any) {
      setErreur(e.response?.data?.detail || "Erreur lors de l'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 14.5, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'var(--bg-secondary)', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.4px' }

  return (
    <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '1px solid var(--border)', padding: '28px 26px' }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: '#0B3C7A', marginBottom: 4 }}>
            {dejaDefini ? 'Changer mon code de signature' : 'Créer mon code de signature'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
            Ce code est différent de votre mot de passe de connexion. Il vous sera redemandé uniquement au moment de valider ou rejeter une demande — gardez-le pour vous, ne le communiquez à personne.
          </div>

          {!dejaDefini && (
            <div style={{ padding: '9px 12px', marginBottom: 18, fontSize: 13, borderRadius: 8, color: '#a3610a', background: '#fdf3e3', border: '1px solid #f0d9a8' }}>
              Vous n'avez pas encore de code de signature. Vous devez en créer un avant de pouvoir valider ou rejeter une demande.
            </div>
          )}
          {erreur && (
            <div style={{ padding: '9px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: 'var(--error-text)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
              {erreur}
            </div>
          )}
          {succes && (
            <div style={{ padding: '9px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: '#1e8f5f', background: '#eaf6ee', border: '1px solid #bfe3cc' }}>
              {succes}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>MOT DE PASSE DE CONNEXION (pour confirmer que c'est bien vous)</label>
              <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} required style={inp} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{dejaDefini ? 'NOUVEAU CODE DE SIGNATURE' : 'CODE DE SIGNATURE'}</label>
              <input type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} required placeholder="4 caractères minimum" style={inp} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>CONFIRMER LE CODE</label>
              <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => navigate('/')} style={{ padding: '11px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Retour
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: 11, background: loading ? '#9ab4e8' : '#003580', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
