import { useState } from 'react'
import client from '../../api/client'
import { afficherAlerte } from '../../store/modal'

export default function ConfigEmailPage() {
  const [form, setForm] = useState({
    MAIL_SERVER: '', MAIL_PORT: '587', MAIL_USERNAME: '',
    MAIL_PASSWORD: '', MAIL_FROM: '', MAIL_STARTTLS: 'True', MAIL_SSL_TLS: 'False',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [msg, setMsg] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const sauvegarder = async () => {
    setSaving(true)
    setMsg('')
    try {
      await client.post('/admin/config-email', form)
      setMsg('Configuration sauvegardée. Redémarrez le serveur pour appliquer.')
    } catch (e: any) {
      setMsg(e.response?.data?.detail || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const tester = async () => {
    if (!testEmail) { afficherAlerte('Entrez un email de test'); return }
    setTesting(true)
    setMsg('')
    try {
      await client.post('/admin/test-email', { email: testEmail, ...form })
      setMsg(`Email de test envoyé à ${testEmail}`)
    } catch (e: any) {
      setMsg(e.response?.data?.detail || 'Erreur lors de l\'envoi')
    } finally {
      setTesting(false)
    }
  }

  const inpS: React.CSSProperties = {
    width: '100%', fontSize: 13.5, padding: '8px 10px',
    border: '1px solid var(--border)', borderRadius: 6,
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>Configuration email</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>Paramètres SMTP pour les notifications automatiques</div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>

          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500 }}>Serveur SMTP</div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

              <Field label="Serveur SMTP">
                <input style={inpS} value={form.MAIL_SERVER} onChange={e => set('MAIL_SERVER', e.target.value)} placeholder="smtp.gmail.com" />
              </Field>
              <Field label="Port">
                <select style={inpS} value={form.MAIL_PORT} onChange={e => set('MAIL_PORT', e.target.value)}>
                  <option value="587">587 (STARTTLS)</option>
                  <option value="465">465 (SSL)</option>
                  <option value="25">25 (Non sécurisé)</option>
                </select>
              </Field>
              <Field label="Chiffrement">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['STARTTLS', 'True', 'False'], ['SSL/TLS', 'False', 'True']].map(([label, tls, ssl]) => (
                    <button key={label} onClick={() => { set('MAIL_STARTTLS', tls); set('MAIL_SSL_TLS', ssl) }}
                      style={{ flex: 1, padding: '6px', fontSize: 12.5, border: form.MAIL_STARTTLS === tls ? '1.5px solid #0B3C7A' : '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: form.MAIL_STARTTLS === tls ? 'var(--bg-secondary)' : 'transparent', color: form.MAIL_STARTTLS === tls ? '#0B3C7A' : 'var(--text-secondary)', fontWeight: form.MAIL_STARTTLS === tls ? 500 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong>Gmail :</strong> smtp.gmail.com · Port 587 · STARTTLS<br />
                <strong>Outlook :</strong> smtp.office365.com · Port 587 · STARTTLS<br />
                <strong>OVH :</strong> ssl0.ovh.net · Port 465 · SSL
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500 }}>Authentification</div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Adresse email (expéditeur)">
                <input type="email" style={inpS} value={form.MAIL_FROM} onChange={e => set('MAIL_FROM', e.target.value)} placeholder="noreply@clinique-biasa.tg" />
              </Field>
              <Field label="Nom d'utilisateur SMTP">
                <input style={inpS} value={form.MAIL_USERNAME} onChange={e => set('MAIL_USERNAME', e.target.value)} placeholder="votre@gmail.com" />
              </Field>
              <Field label="Mot de passe SMTP">
                <input type="password" style={inpS} value={form.MAIL_PASSWORD} onChange={e => set('MAIL_PASSWORD', e.target.value)} placeholder="Mot de passe d'application" />
              </Field>
              <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Pour Gmail, utilisez un <strong>mot de passe d'application</strong> (16 caractères), pas votre mot de passe Google habituel.
              </div>
            </div>
          </div>
        </div>

        {/* Test + Sauvegarde */}
        <div style={{ maxWidth: 700, marginTop: 12, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 10 }}>Tester la configuration</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              type="email"
              placeholder="Email de destination pour le test"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              style={{ flex: 1, fontSize: 13.5, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
            <button onClick={tester} disabled={testing} style={{ padding: '8px 16px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {testing ? 'Envoi…' : 'Envoyer test'}
            </button>
          </div>

          {msg && (
            <div style={{ padding: '8px 12px', marginBottom: 12, fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={sauvegarder} disabled={saving} style={{ padding: '8px 20px', fontSize: 13.5, border: 'none', borderRadius: 6, background: '#0B3C7A', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
