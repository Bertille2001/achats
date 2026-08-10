import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth'

export default function MotDePasseOubliePage() {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.motDePasseOublie(username)
      setMessage(res.message)
    } catch {
      setMessage("Si ce compte existe et possède un email enregistré, un lien de réinitialisation vient d'y être envoyé. Sinon, contactez un administrateur.")
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 14.5, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'var(--bg-secondary)', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px' }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: '#0B3C7A', marginBottom: 4 }}>Mot de passe oublié</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 22 }}>
            Indiquez votre nom d'utilisateur. Si un email est enregistré sur le compte, un lien de réinitialisation vous y sera envoyé.
          </div>

          {message ? (
            <div style={{ padding: '12px 14px', fontSize: 12.5, borderRadius: 8, color: '#0B3C7A', background: 'var(--bg-secondary)', border: '1px solid #dbe9f7', lineHeight: 1.5 }}>
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.4px' }}>NOM D'UTILISATEUR</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={inp} />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#9ab4e8' : '#003580', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          )}

          <div style={{ marginTop: 18, textAlign: 'center' as const }}>
            <Link to="/login" style={{ fontSize: 13.5, color: '#0B3C7A', textDecoration: 'none' }}>Retour à la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
