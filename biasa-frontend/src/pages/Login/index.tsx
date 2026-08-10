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
    { top: 60, left: 40, size: 90 },
    { top: '20%', right: 60, size: 60 },
    { bottom: 90, left: 90, size: 70 },
    { bottom: '18%', right: 40, size: 50 },
    { top: '50%', left: '55%', size: 55 },
  ]

  const atouts = [
    'Traçabilité complète de chaque demande',
    'Validation multi-niveaux sécurisée',
    'Suivi des dépenses en temps réel',
  ]

  return (
    <div className="biasa-login-wrap" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        html, body, #root { height: 100%; margin: 0; }
        .biasa-login-wrap { display: flex; min-height: 100vh; }
        .biasa-left {
          flex: 1.1; position: relative; overflow: hidden; display: flex; flex-direction: column;
          justify-content: center; padding: 60px 64px;
          background: linear-gradient(155deg, #001B42 0%, #003580 55%, #0B5FC4 100%);
        }
        .biasa-right { flex: 1; display: flex; align-items: center; justify-content: center; background: #ffffff; padding: 40px 24px; }
        @media (max-width: 860px) {
          .biasa-login-wrap { flex-direction: column; }
          .biasa-left { flex: none; padding: 40px 32px; min-height: 220px; }
          .biasa-right { flex: none; }
        }
        @keyframes biasaFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .biasa-fade { animation: biasaFadeUp 0.5s ease-out; }
        .biasa-input { transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; }
        .biasa-input:focus { border-color: #003580 !important; background: #ffffff !important; box-shadow: 0 0 0 3px rgba(0,53,128,0.10); }
        .biasa-submit { transition: transform 0.15s, box-shadow 0.15s, filter 0.15s; }
        .biasa-submit:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,53,128,0.30); filter: brightness(1.05); }
        .biasa-submit:not(:disabled):active { transform: translateY(0); }
        .biasa-forgot { transition: opacity 0.15s; }
        .biasa-forgot:hover { opacity: 0.7; }
      `}</style>

      {/* Panneau de marque */}
      <div className="biasa-left">
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)', top: -160, left: -140 }} />
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,157,224,0.18) 0%, rgba(27,157,224,0) 70%)', bottom: -140, right: -100 }} />

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
              opacity: 0.07,
              filter: 'brightness(0) invert(1)',
              pointerEvents: 'none',
              top: (pos as any).top,
              bottom: (pos as any).bottom,
              left: (pos as any).left,
              right: (pos as any).right,
            }}
          />
        ))}

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420 }} className="biasa-fade">
          <div style={{ width: 68, height: 68, borderRadius: 16, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 12px 28px rgba(0,0,0,0.18)' }}>
            <img src="/logo_biasa.png" alt="Clinique BIASA" style={{ width: 46, height: 46, objectFit: 'contain' }} />
          </div>

          <div style={{ fontSize: 32, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.4px', lineHeight: 1.2, marginBottom: 10 }}>
            Clinique BIASA
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginBottom: 36 }}>
            Système de gestion des achats
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {atouts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: '#fff' }}>✓</div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{a}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: 48, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
          Clinique BIASA © {new Date().getFullYear()} · Nous prenons soin de la vie
        </div>
      </div>

      {/* Panneau de connexion */}
      <div className="biasa-right">
        <div style={{ width: '100%', maxWidth: 380 }} className="biasa-fade">
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0B2C5C', marginBottom: 5 }}>Connexion</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Accédez à votre espace de gestion</div>
          </div>

          {erreur && (
            <div style={{ padding: '10px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: 'var(--error-text)', background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
              {erreur}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7, letterSpacing: '0.5px' }}>
                NOM D'UTILISATEUR
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                placeholder="ex. bertille"
                className="biasa-input"
                style={{ width: '100%', padding: '13px 15px', fontSize: 14.5, border: '1px solid rgba(15,40,80,0.16)', borderRadius: 10, background: '#f5f8fd', color: '#0B2C5C', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7, letterSpacing: '0.5px' }}>
                MOT DE PASSE
              </label>
              <input
                type="password"
                value={mdp}
                onChange={e => setMdp(e.target.value)}
                required
                placeholder="••••••••"
                className="biasa-input"
                style={{ width: '100%', padding: '13px 15px', fontSize: 14.5, border: '1px solid rgba(15,40,80,0.16)', borderRadius: 10, background: '#f5f8fd', color: '#0B2C5C', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="biasa-submit"
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#9ab4e8' : 'linear-gradient(135deg, #003580 0%, #0B4FA8 100%)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 6px 16px rgba(0,53,128,0.24)',
              }}
            >
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' as const }}>
            <Link to="/mot-de-passe-oublie" className="biasa-forgot" style={{ fontSize: 13.5, color: '#1B6FE0', textDecoration: 'none', fontWeight: 500 }}>Mot de passe oublié ?</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
