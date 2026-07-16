import { useEffect, useState } from 'react'
import client from '../../api/client'

type Role = 'demandeur' | 'responsable' | 'daf' | 'acheteur' | 'admin'

interface User {
  id: number
  nom: string
  prenom: string
  username: string
  email: string | null
  poste: string | null
  service: string | null
  role: Role
  actif: boolean
  verrouille_jusqua: string | null
}

const ROLES: Role[] = ['demandeur', 'responsable', 'daf', 'acheteur', 'admin']
const ROLE_LABELS: Record<Role, string> = {
  demandeur: 'Demandeur', responsable: 'Responsable', daf: 'DAF',
  acheteur: 'Acheteur', admin: 'Admin',
}

const tdS: React.CSSProperties = {
  fontSize: 13.5, padding: '9px 12px',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const,
}

const inp: React.CSSProperties = {
  width: '100%', fontSize: 13.5, padding: '7px 10px',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
  boxSizing: 'border-box' as const,
}

const formVide = () => ({
  nom: '', prenom: '', username: '', email: '', mot_de_passe: '',
  poste: '', service: '', role: 'demandeur' as Role,
})

export default function GestionUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState(formVide())
  const [saving, setSaving] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [postes, setPostes] = useState<string[]>([])

  const charger = async () => {
    setLoading(true)
    try {
      const [u, s, p] = await Promise.all([
        client.get<User[]>('/users/'),
        client.get<string[]>('/autocomplete/services'),
        client.get<string[]>('/autocomplete/postes'),
      ])
      setUsers(u.data)
      setServices(s.data)
      setPostes(p.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  const ouvrirCreation = () => {
    setEditUser(null)
    setForm(formVide())
    setShowModal(true)
  }

  const ouvrirEdition = (u: User) => {
    setEditUser(u)
    setForm({ nom: u.nom, prenom: u.prenom, username: u.username, email: u.email || '', mot_de_passe: '', poste: u.poste || '', service: u.service || '', role: u.role })
    setShowModal(true)
  }

  const sauvegarder = async () => {
    setSaving(true)
    try {
      if (editUser) {
        const payload: any = { ...form }
        if (!payload.mot_de_passe) delete payload.mot_de_passe
        await client.patch(`/users/${editUser.id}`, payload)
      } else {
        await client.post('/users/', form)
      }
      setShowModal(false)
      charger()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const desactiver = async (u: User) => {
    if (!confirm(`Désactiver ${u.prenom} ${u.nom} ?`)) return
    await client.delete(`/users/${u.id}`)
    charger()
  }

  const reactiver = async (u: User) => {
    await client.patch(`/users/${u.id}`, { actif: true })
    charger()
  }

  const deverrouiller = async (u: User) => {
    await client.post(`/admin/users/${u.id}/deverrouiller`)
    charger()
  }

  const genererMotDePasse = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let mdp = ''
    for (let i = 0; i < 10; i++) mdp += caracteres[Math.floor(Math.random() * caracteres.length)]
    set('mot_de_passe', mdp)
  }

  const estVerrouille = (u: User) => u.verrouille_jusqua && new Date(u.verrouille_jusqua) > new Date()

  const filtres = users.filter(u =>
    `${u.nom} ${u.prenom} ${u.username} ${u.email || ''} ${u.service} ${u.role}`.toLowerCase().includes(recherche.toLowerCase())
  )

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 500 }}>Gestion des utilisateurs</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>{users.length} compte(s) enregistré(s)</div>
        </div>
        <button onClick={ouvrirCreation} style={{ padding: '6px 14px', background: '#1B9DE0', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
          + Nouvel utilisateur
        </button>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Recherche */}
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="Rechercher par nom, identifiant, service, rôle…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            style={{ ...inp, maxWidth: 360 }}
          />
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['Nom', "Nom d'utilisateur", 'Service', 'Poste', 'Rôle', 'Statut', ''].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtres.map(u => (
                    <tr key={u.id} style={{ opacity: u.actif ? 1 : 0.5 }}>
                      <td style={tdS}><span style={{ fontWeight: 500 }}>{u.prenom} {u.nom}</span></td>
                      <td style={tdS}>{u.username}</td>
                      <td style={tdS}>{u.service || '—'}</td>
                      <td style={tdS}>{u.poste || '—'}</td>
                      <td style={tdS}>
                        <span style={{ fontSize: 11.5, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-secondary)' }}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td style={tdS}>
                        <span style={{ fontSize: 11.5, color: u.actif ? '#27500a' : '#a32d2d' }}>
                          {u.actif ? 'Actif' : 'Désactivé'}
                        </span>
                        {estVerrouille(u) && (
                          <div style={{ fontSize: 10.5, color: '#a32d2d', marginTop: 2 }}>Verrouillé</div>
                        )}
                      </td>
                      <td style={tdS}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => ouvrirEdition(u)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Modifier</button>
                          {estVerrouille(u) && (
                            <button onClick={() => deverrouiller(u)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: '#0B3C7A' }}>Déverrouiller</button>
                          )}
                          {u.actif
                            ? <button onClick={() => desactiver(u)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: '#a32d2d' }}>Désactiver</button>
                            : <button onClick={() => reactiver(u)} style={{ padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: '#27500a' }}>Réactiver</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création / édition */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15.5, fontWeight: 500 }}>{editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</div>
              <button onClick={() => setShowModal(false)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', fontSize: 15.5, color: 'var(--text-secondary)' }}>×</button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Prénom"><input style={inp} value={form.prenom} onChange={e => set('prenom', e.target.value)} /></Field>
                <Field label="Nom"><input style={inp} value={form.nom} onChange={e => set('nom', e.target.value)} /></Field>
              </div>
              <Field label="Nom d'utilisateur"><input style={inp} value={form.username} onChange={e => set('username', e.target.value)} /></Field>
              <Field label="Email (optionnel — pour les notifications)"><input type="email" style={inp} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
              <Field label={editUser ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe provisoire'}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" style={inp} value={form.mot_de_passe} onChange={e => set('mot_de_passe', e.target.value)} placeholder={editUser ? '••••••••' : ''} />
                  <button type="button" onClick={genererMotDePasse} style={{ padding: '0 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}>Générer</button>
                </div>
                {!editUser && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Communiquez ce mot de passe à la personne — elle devra le changer à sa première connexion.
                  </div>
                )}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Service">
                  <input style={inp} value={form.service} onChange={e => set('service', e.target.value)} list="services-list" />
                  <datalist id="services-list">{services.map(s => <option key={s} value={s} />)}</datalist>
                </Field>
                <Field label="Poste / Fonction">
                  <input style={inp} value={form.poste} onChange={e => set('poste', e.target.value)} list="postes-list" />
                  <datalist id="postes-list">{postes.map(p => <option key={p} value={p} />)}</datalist>
                </Field>
              </div>
              <Field label="Rôle">
                <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ padding: '11px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '6px 14px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button onClick={sauvegarder} disabled={saving} style={{ padding: '6px 14px', fontSize: 13.5, border: 'none', borderRadius: 5, background: '#1B9DE0', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
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
