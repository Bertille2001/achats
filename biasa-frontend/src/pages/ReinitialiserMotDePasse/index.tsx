import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../../api/auth'

export default function ReinitialiserMotDePassePage() {
  const [params] = useSearchParams()
  const jeton = params.get('jeton') || ''
  const navigate = useNavigate()

  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErreur('')
    if (nouveau.length < 6) { setErreur('Le mot de passe doit contenir au moins 6 caractères.'); return }
    if (nouveau !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      await authApi.reinitialiserMotDePasse(jeton, nouveau)
      setSucces(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (e: any) {
      setErreur(e.response?.data?.detail || 'Lien invalide ou expiré.')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 14.5, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#eaf2fb', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

  if (!jeton) {
    return (
      <div style={{ minHeight: '100vh', background: '#eaf2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '32px 28px', maxWidth: 400 }}>
          <div style={{ fontSize: 14.5, color: '#791f1f' }}>Lien de réinitialisation invalide.</div>
          <Link to="/mot-de-passe-oublie" style={{ fontSize: 13.5, color: '#1B9DE0' }}>Faire une nouvelle demande</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eaf2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px' }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: '#0B3C7A', marginBottom: 4 }}>Nouveau mot de passe</div>

          {succes ? (
            <div style={{ padding: '12px 14px', fontSize: 12.5, borderRadius: 8, color: '#0B3C7A', background: '#eaf2fb', border: '1px solid #dbe9f7' }}>
              Mot de passe mis à jour. Redirection vers la connexion…
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13.5, color: '#5e6f85', marginBottom: 22 }}>Choisissez votre nouveau mot de passe.</div>
              {erreur && (
                <div style={{ padding: '9px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: '#791f1f', background: '#fcebeb', border: '1px solid #f09595' }}>
                  {erreur}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#5e6f85', marginBottom: 6 }}>NOUVEAU MOT DE PASSE</label>
                  <input type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} required style={inp} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#5e6f85', marginBottom: 6 }}>CONFIRMER</label>
                  <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required style={inp} />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#9ab4e8' : '#003580', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Enregistrement…' : 'Valider'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
