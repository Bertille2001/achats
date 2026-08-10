import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    try {
      const res = await authApi.login(username, mdp)
      setAuth(res.utilisateur, res.access_token)
      navigate('/')
    } catch {
      setErreur("Nom d'utilisateur ou mot de passe incorrect")
    } finally {
      setLoading(false)
    }
  }

  const filigranes = [
    { bottom: 20, right: 20, size: 80 },
    { bottom: 140, right: 160, size: 60 },
    { top: 30, left: 20, size: 70 },
    { top: 200, right: 50, size: 55 },
    { bottom: 220, left: 110, size: 65 },
    { top: 100, left: 200, size: 50 },
    { bottom: 60, left: 60, size: 55 },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cercles décoratifs bleus */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'rgba(0,53,128,0.08)', top: -150, right: -150 }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,53,128,0.06)', bottom: -80, left: 80 }} />
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(0,53,128,0.05)', top: 60, left: -60 }} />

      {/* Filigranes logo — plusieurs petits */}
      {filigranes.map((pos, i) => (
        <img
          key={i}
          src="/logo_biasa.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: pos.size,
            height: pos.size,
            objectFit: 'contain',
            opacity: 0.40,
            pointerEvents: 'none',
            top: (pos as any).top,
            bottom: (pos as any).bottom,
            left: (pos as any).left,
            right: (pos as any).right,
          }}
        />
      ))}

      <div style={{ width: '100%', maxWidth: 350, zIndex: 1 }}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '30px 26px 24px', position: 'relative', overflow: 'hidden' }}>

            <div style={{ marginBottom: 20, textAlign: 'center' as const }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: '#003580', marginBottom: 3, letterSpacing: '-0.4px' }}>
                Clinique BIASA
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Système de gestion des achats
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 18 }} />

            {erreur && (
              <div style={{ padding: '9px 12px', marginBottom: 16, fontSize: 13, borderRadius: 8, color: 'var(--error-text)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
                {erreur}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.4px' }}>
                  NOM D'UTILISATEUR
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="ex. bertille"
                  style={{ width: '100%', padding: '10px 13px', fontSize: 14, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'var(--bg-secondary)', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#003580'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.15)'; e.target.style.background = '#eaf2fb' }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.4px' }}>
                  MOT DE PASSE
                </label>
                <input
                  type="password"
                  value={mdp}
                  onChange={e => setMdp(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 13px', fontSize: 14, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'var(--bg-secondary)', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#003580'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.15)'; e.target.style.background = '#eaf2fb' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: loading ? '#9ab4e8' : '#003580',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 15.5, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Connexion…' : 'Se connecter →'}
              </button>
            </form>

            <div style={{ marginTop: 16, textAlign: 'center' as const }}>
              <Link to="/mot-de-passe-oublie" style={{ fontSize: 13.5, color: '#0B3C7A', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
          Clinique BIASA © {new Date().getFullYear()} · Nous prenons soin de la vie
        </div>
      </div>
    </div>
  )
}
