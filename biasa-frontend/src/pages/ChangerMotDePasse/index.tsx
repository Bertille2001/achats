import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

export default function ChangerMotDePassePage() {
  const { utilisateur, token, isAuthenticated, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const provisoire = !!utilisateur?.doit_changer_mdp

  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErreur('')
    if (nouveau.length < 6) { setErreur('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return }
    if (nouveau !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const updated = await authApi.changerMotDePasse(provisoire ? null : ancien, nouveau)
      if (token) setAuth(updated, token)
      navigate('/')
    } catch (e: any) {
      setErreur(e.response?.data?.detail || 'Erreur lors du changement de mot de passe')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 14.5, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#eaf2fb', color: '#0B3C7A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#5e6f85', marginBottom: 6, letterSpacing: '0.4px' }

  return (
    <div style={{ minHeight: '100vh', background: '#eaf2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px' }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: '#0B3C7A', marginBottom: 4 }}>
            {provisoire ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
          </div>
          <div style={{ fontSize: 13.5, color: '#5e6f85', marginBottom: 22 }}>
            {provisoire
              ? 'Votre mot de passe actuel est provisoire. Choisissez-en un nouveau avant de continuer.'
              : 'Saisissez votre mot de passe actuel puis le nouveau.'}
          </div>

          {erreur && (
            <div style={{ padding: '9px 12px', marginBottom: 18, fontSize: 13.5, borderRadius: 8, color: '#791f1f', background: '#fcebeb', border: '1px solid #f09595' }}>
              {erreur}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!provisoire && (
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>MOT DE PASSE ACTUEL</label>
                <input type="password" value={ancien} onChange={e => setAncien(e.target.value)} required style={inp} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>NOUVEAU MOT DE PASSE</label>
              <input type="password" value={nouveau} onChange={e => setNouveau(e.target.value)} required placeholder="6 caractères minimum" style={inp} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>CONFIRMER LE NOUVEAU MOT DE PASSE</label>
              <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required style={inp} />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#9ab4e8' : '#003580', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15.5, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Enregistrement…' : 'Valider'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
