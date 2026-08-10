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
    { top: 40, left: 60, size: 60 },
    { top: 90, right: 100, size: 44 },
    { bottom: 70, left: 120, size: 50 },
    { bottom: 40, right: 60, size: 64 },
    { top: '45%', left: 30, size: 40 },
    { top: '38%', right: 40, size: 46 },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f4f7fc 0%, #eaf0fa 45%, #e4ecf9 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes biasaFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .biasa-login-card { animation: biasaFadeUp 0.5s ease-out; }
        .biasa-input { transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; }
        .biasa-input:focus { border-color: #003580 !important; background: #ffffff !important; box-shadow: 0 0 0 3px rgba(0,53,128,0.10); }
        .biasa-submit { transition: transform 0.15s, box-shadow 0.15s, filter 0.15s; }
        .biasa-submit:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,53,128,0.28); filter: brightness(1.05); }
        .biasa-submit:not(:disabled):active { transform: translateY(0); }
        .biasa-forgot { transition: opacity 0.15s; }
        .biasa-forgot:hover { opacity: 0.7; }
      `}</style>

      {/* Halo décoratif subtil */}
      <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,53,128,0.10) 0%, rgba(0,53,128,0) 70%)', top: -220, right: -180 }} />
      <div style={{ position: 'absolute', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,53,128,0.07) 0%, rgba(0,53,128,0) 70%)', bottom: -180, left: -140 }} />

      {/* Filigranes logo discrets */}
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
            opacity: 0.12,
            pointerEvents: 'none',
            top: (pos as any).top,
            bottom: (pos as any).bottom,
            left: (pos as any).left,
            right: (pos as any).right,
          }}
        />
      ))}

      <div style={{ width: '100%', maxWidth: 408, zIndex: 1 }} className="biasa-login-card">

        <div style={{ textAlign: 'center' as const, marginBottom: 26 }}>
          <img
            src="/logo_biasa.png"
            alt="Clinique BIASA"
            style={{ width: 58, height: 58, objectFit: 'contain', marginBottom: 12 }}
          />
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0B2C5C', letterSpacing: '-0.3px', lineHeight: 1.15 }}>
            Clinique BIASA
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Système de gestion des achats
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid rgba(15,40,80,0.07)',
          boxShadow: '0 24px 60px -18px rgba(0,53,128,0.28), 0 2px 8px rgba(0,53,128,0.06)',
        }}>
          {/* Bandeau supérieur */}
          <div style={{ height: 5, background: 'linear-gradient(90deg, #003580 0%, #1B6FE0 55%, #1B9DE0 100%)' }} />

          <div style={{ padding: '32px 34px 30px' }}>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 17.5, fontWeight: 600, color: '#0B2C5C', marginBottom: 3 }}>Connexion</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Accédez à votre espace de gestion</div>
            </div>

            {erreur && (
              <div style={{ padding: '10px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: 'var(--error-text)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
                {erreur}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.5px' }}>
                  NOM D'UTILISATEUR
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="ex. bertille"
                  className="biasa-input"
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14.5, border: '1px solid rgba(15,40,80,0.14)', borderRadius: 9, background: '#f5f8fd', color: '#0B2C5C', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 26 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.5px' }}>
                  MOT DE PASSE
                </label>
                <input
                  type="password"
                  value={mdp}
                  onChange={e => setMdp(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="biasa-input"
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14.5, border: '1px solid rgba(15,40,80,0.14)', borderRadius: 9, background: '#f5f8fd', color: '#0B2C5C', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="biasa-submit"
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? '#9ab4e8' : 'linear-gradient(135deg, #003580 0%, #0B4FA8 100%)',
                  color: '#fff', border: 'none', borderRadius: 9,
                  fontSize: 15, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(0,53,128,0.22)',
                }}
              >
                {loading ? 'Connexion…' : 'Se connecter →'}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: 'center' as const }}>
              <Link to="/mot-de-passe-oublie" className="biasa-forgot" style={{ fontSize: 13.5, color: '#1B6FE0', textDecoration: 'none', fontWeight: 500 }}>Mot de passe oublié ?</Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
          Clinique BIASA © {new Date().getFullYear()} · Nous prenons soin de la vie
        </div>
      </div>
    </div>
  )
}
