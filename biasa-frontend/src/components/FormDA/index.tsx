import { useState, useRef, useEffect } from 'react'
import { demandesApi } from '../../api/demandes'
import { useAuthStore } from '../../store/auth'
import type { DemandeAchatForm, LigneDAForm, TypeDA, MotifDA, UrgenceDA } from '../../types'
import client from '../../api/client'

const ligneVide = (n: number): LigneDAForm => ({
  numero_ligne: n, designation: '', quantite: 1, unite: '',
  observation: '', stock_actuel: '', reference_marque: '', description_technique: '',
})
const formVide = (service: string, poste: string): DemandeAchatForm => ({
  service_demandeur: service, poste_fonction: poste,
  type_da: 'medical', nature: 'achat', motif: 'reappro', urgence: 'moyenne',
  justification: '', normes_certifications: '', date_peremption_min: '',
  fournisseur_suggere: '', autres_specs: '', lieu_utilisation: '',
  lignes: [ligneVide(1), ligneVide(2)],
})

function ST({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.5px', paddingBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 12, marginTop: 16, textTransform: 'uppercase' as const }}>{children}</div>
}
function FL({ label, children, style, required }: { label: string; children: React.ReactNode; style?: React.CSSProperties; required?: boolean }) {
  return <div style={style}><label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}{required && <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>}</label>{children}</div>
}

export default function FormDA({ onClose, onSuccess, valeurInitiale, onSubmit: onSubmitExterieur, labelBouton }: {
  onClose?: () => void
  onSuccess?: () => void
  valeurInitiale?: Partial<DemandeAchatForm>
  onSubmit?: (form: DemandeAchatForm) => Promise<void>
  labelBouton?: string
}) {
  const { utilisateur } = useAuthStore()
  const [form, setForm] = useState<DemandeAchatForm>(
    valeurInitiale
      ? { ...formVide(utilisateur?.service || '', utilisateur?.poste || ''), ...valeurInitiale }
      : formVide(utilisateur?.service || '', utilisateur?.poste || '')
  )
  const [fichiers, setFichiers] = useState<File[]>([])
  const [etape, setEtape] = useState<'form' | 'confirm'>('form')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [services, setServices] = useState<string[]>([])
  const [postes, setPostes] = useState<string[]>([])
  const [fournisseurs, setFournisseurs] = useState<string[]>([])
  const [normes, setNormes] = useState<string[]>([])
  const [lieux, setLieux] = useState<string[]>([])
  const [designations, setDesignations] = useState<string[]>([])
  const [unites, setUnites] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      client.get<string[]>('/autocomplete/services'),
      client.get<string[]>('/autocomplete/postes'),
      client.get<string[]>('/autocomplete/fournisseurs'),
      client.get<string[]>('/autocomplete/normes'),
      client.get<string[]>('/autocomplete/lieux'),
      client.get<string[]>('/autocomplete/designations'),
      client.get<string[]>('/autocomplete/unites'),
    ]).then(([s, p, f, n, l, d, u]) => {
      setServices(s.data); setPostes(p.data)
      setFournisseurs(f.data); setNormes(n.data)
      setLieux(l.data); setDesignations(d.data); setUnites(u.data)
    }).catch(() => {})
  }, [])

  const set = <K extends keyof DemandeAchatForm>(k: K, v: DemandeAchatForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const setLigne = (i: number, k: keyof LigneDAForm, v: string | number) =>
    setForm(f => { const lignes = [...f.lignes]; lignes[i] = { ...lignes[i], [k]: v }; return { ...f, lignes } })

  const ajouterLigne = () =>
    setForm(f => ({ ...f, lignes: [...f.lignes, ligneVide(f.lignes.length + 1)] }))

  const handleFichiers = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFichiers(prev => [...prev, ...Array.from(e.target.files!)])
  }
  const supprimerFichier = (i: number) => setFichiers(prev => prev.filter((_, idx) => idx !== i))

  const isMed = form.type_da === 'medical'

  // Validation — seuls les champs vraiment indispensables sont obligatoires :
  // le service, le motif/urgence (déjà pré-remplis) et au moins un article avec
  // une désignation et une quantité. Le reste (poste, justification détaillée,
  // normes, fournisseur, observations…) reste utile mais facultatif : on ne
  // bloque pas une demande simple/urgente pour des détails que tout le monde
  // n'a pas toujours sous la main au moment de la saisie.
  const lignesValides = form.lignes.filter(l => l.designation.trim() !== '' && l.quantite > 0)

  const formValide =
    form.service_demandeur.trim() !== '' &&
    lignesValides.length > 0

  const erreurChamp = () => {
    if (!form.service_demandeur.trim()) return 'Service requis'
    if (lignesValides.length === 0) return 'Au moins un article avec désignation et quantité est requis'
    return ''
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const lignesNettoyees = lignesValides.map((l, i) => ({ ...l, numero_ligne: i + 1 }))
      const formNettoye = { ...form, lignes: lignesNettoyees }
      if (onSubmitExterieur) {
        // Mode modification — pas de création ni de soumission automatique
        await onSubmitExterieur(formNettoye)
      } else {
        // Mode création normal
        const da = await demandesApi.creer(formNettoye)
        for (const fichier of fichiers) await demandesApi.uploadFichier(da.id, fichier)
        await demandesApi.soumettre(da.id)
        onSuccess?.()
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erreur lors de la soumission')
    } finally {
      setLoading(false)
    }
  }

  const ms: React.CSSProperties = { background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.10)', width: '100%', maxWidth: etape === 'confirm' ? 420 : 640, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }
  const mtd: React.CSSProperties = { padding: '3px 4px', border: '1px solid rgba(0,0,0,0.08)' }
  const inp: React.CSSProperties = { fontSize: 12.5, padding: '3px 5px', border: 'none', background: 'transparent', color: '#0B3C7A', width: '100%', fontFamily: 'inherit', outline: 'none' }
  const foot: React.CSSProperties = { padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 7 }
  const inpStyle: React.CSSProperties = { fontSize: 13.5, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'var(--bg-secondary)', color: '#0B3C7A', width: '100%', outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, zIndex: 100, overflowY: 'auto' }}>
      {etape === 'confirm' ? (
        <div style={ms}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: '#0B3C7A' }}>Confirmer la soumission</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Votre responsable sera notifié par email</div>
            </div>
            <button onClick={() => setEtape('form')} style={{ width: 28, height: 28, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 17.5, color: 'var(--text-secondary)' }}>×</button>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                ['Type', isMed ? 'Médical & Consommables' : 'Bien / Service'],
                ['Service', form.service_demandeur],
                ['Urgence', form.urgence],
                ['Motif', form.motif],
                ['Articles', `${lignesValides.length} article(s)`],
                ['Fichiers', fichiers.length > 0 ? `${fichiers.length} fichier(s)` : 'Aucun'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={foot}>
            <button onClick={() => setEtape('form')} style={{ padding: '8px 16px', fontSize: 13.5, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>← Retour</button>
            <button onClick={handleSubmit} disabled={loading} style={{ padding: '8px 20px', fontSize: 13.5, border: 'none', borderRadius: 6, background: loading ? '#9ab4e8' : '#1B9DE0', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {loading ? 'Envoi…' : 'Confirmer et soumettre'}
            </button>
          </div>
        </div>
      ) : (
        <div style={ms}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: '#0B3C7A' }}>Nouvelle demande d'achat</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Le service et au moins un article (désignation + quantité) sont requis ; le reste est facultatif</div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 17.5, color: 'var(--text-secondary)' }}>×</button>
          </div>

          <div style={{ padding: 16, maxHeight: '75vh', overflowY: 'auto' }}>

            <ST>Type de demande</ST>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {(['medical', 'bien_service'] as TypeDA[]).map(t => (
                <button key={t} onClick={() => set('type_da', t)} style={{ flex: 1, padding: 10, outline: form.type_da === t ? '2px solid #0B3C7A' : 'none', outlineOffset: form.type_da === t ? '-2px' : '0', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, background: form.type_da === t ? '#1B9DE0' : '#eaf2fb', color: form.type_da === t ? '#fff' : '#5e6f85', fontWeight: form.type_da === t ? 600 : 400 }}>
                  {t === 'medical' ? 'Médical & Consommables' : 'Bien / Service'}
                </button>
              ))}
            </div>

            <ST>Informations générales</ST>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 4 }}>
              <FL label="Service demandeur" required>
                <input value={form.service_demandeur} onChange={e => set('service_demandeur', e.target.value)} list="ac-services" style={inpStyle} placeholder="Ex : Urgences" />
                <datalist id="ac-services">{services.map(s => <option key={s} value={s} />)}</datalist>
              </FL>
              <FL label="Poste / Fonction">
                <input value={form.poste_fonction} onChange={e => set('poste_fonction', e.target.value)} list="ac-postes" style={inpStyle} placeholder="Ex : Infirmier chef" />
                <datalist id="ac-postes">{postes.map(p => <option key={p} value={p} />)}</datalist>
              </FL>
              <FL label="Nature">
                <select value={form.nature} onChange={e => set('nature', e.target.value as any)} style={inpStyle}>
                  <option value="achat">Achat</option>
                  <option value="service">Service</option>
                </select>
              </FL>
            </div>

            <ST>Justification</ST>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Motif <span style={{ color: '#c0392b' }}>*</span></div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                {([['reappro','Réapprovisionnement'],['nouveau_besoin','Nouveau besoin'],['commande_specifique','Cmd. spécifique'],['remplacement','Remplacement'],['activite_urgente','Activité urgente']] as [MotifDA,string][]).map(([v,l]) => (
                  <button key={v} onClick={() => set('motif', v)} style={{ padding: '5px 10px', outline: form.motif === v ? '2px solid #0B3C7A' : 'none', outlineOffset: form.motif === v ? '-2px' : '0', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, background: form.motif === v ? '#1B9DE0' : '#eaf2fb', color: form.motif === v ? '#fff' : '#5e6f85', fontWeight: form.motif === v ? 600 : 400 }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Urgence <span style={{ color: '#c0392b' }}>*</span></div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {([['haute','Haute (24h)'],['moyenne','Moyenne (48h)'],['faible','Faible (>72h)']] as [UrgenceDA,string][]).map(([v,l]) => (
                  <button key={v} onClick={() => set('urgence', v)} style={{ flex: 1, padding: '7px', outline: form.urgence === v ? '2px solid #0B3C7A' : 'none', outlineOffset: form.urgence === v ? '-2px' : '0', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, background: form.urgence === v ? '#1B9DE0' : '#eaf2fb', color: form.urgence === v ? '#fff' : '#5e6f85', fontWeight: form.urgence === v ? 600 : 400 }}>{l}</button>
                ))}
              </div>
              <FL label="Précisions / Contexte">
                <textarea value={form.justification} onChange={e => set('justification', e.target.value)} placeholder="Contexte, raison détaillée…" style={{ ...inpStyle, minHeight: 56, resize: 'none' as const }} />
              </FL>
            </div>

            <ST>Articles demandés <span style={{ color: '#c0392b' }}>*</span></ST>
            <div style={{ overflowX: 'auto', marginBottom: 8, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['N°','Désignation *','Qté *','Unité',...(isMed ? ['Stock actuel','Réf. / Marque'] : ['Description technique']),'Obs.'].map(h => (
                      <th key={h} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', padding: '7px 6px', borderBottom: '1px solid rgba(0,0,0,0.08)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.lignes.map((l, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                      <td style={mtd}><span style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '0 4px' }}>{l.numero_ligne}</span></td>
                      <td style={mtd}><input value={l.designation} onChange={e => setLigne(i,'designation',e.target.value)} placeholder="Nom complet" list="ac-designations" style={inp} /></td>
                      <td style={mtd}><input type="number" min={1} value={l.quantite} onChange={e => setLigne(i,'quantite',Number(e.target.value))} style={{...inp,width:50}} /></td>
                      <td style={mtd}><input value={l.unite} onChange={e => setLigne(i,'unite',e.target.value)} placeholder="Boîte…" list="ac-unites" style={inp} /></td>
                      {isMed ? <>
                        <td style={mtd}><input value={l.stock_actuel} onChange={e => setLigne(i,'stock_actuel',e.target.value)} placeholder="Approx." style={inp} /></td>
                        <td style={mtd}><input value={l.reference_marque} onChange={e => setLigne(i,'reference_marque',e.target.value)} placeholder="Réf." style={inp} /></td>
                      </> : <td style={mtd}><input value={l.description_technique} onChange={e => setLigne(i,'description_technique',e.target.value)} placeholder="Détails…" style={inp} /></td>}
                      <td style={mtd}><input value={l.observation} onChange={e => setLigne(i,'observation',e.target.value)} placeholder="Note" style={inp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={ajouterLigne} style={{ fontSize: 12.5, color: '#1B9DE0', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0', marginBottom: 12 }}>+ Ajouter une ligne</button>
            <datalist id="ac-designations">{designations.map(d => <option key={d} value={d} />)}</datalist>
            <datalist id="ac-unites">{unites.map(u => <option key={u} value={u} />)}</datalist>

            {isMed && <>
              <ST>Spécifications techniques</ST>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 4 }}>
                <FL label="Normes / certifications">
                  <input value={form.normes_certifications} onChange={e => set('normes_certifications', e.target.value)} placeholder="CE, FDA, ISO…" list="ac-normes" style={inpStyle} />
                  <datalist id="ac-normes">{normes.map(n => <option key={n} value={n} />)}</datalist>
                </FL>
                <FL label="Date de réception souhaitée (au plus tard)">
                  <input type="date" value={form.date_peremption_min} onChange={e => set('date_peremption_min', e.target.value)} style={inpStyle} />
                </FL>
                <FL label="Fournisseur suggéré" style={{ gridColumn: '1 / -1' }}>
                  <input value={form.fournisseur_suggere} onChange={e => set('fournisseur_suggere', e.target.value)} placeholder="Nom du fournisseur" list="ac-fournisseurs" style={inpStyle} />
                  <datalist id="ac-fournisseurs">{fournisseurs.map(f => <option key={f} value={f} />)}</datalist>
                </FL>
                <FL label="Autres précisions" style={{ gridColumn: '1 / -1' }}>
                  <input value={form.autres_specs} onChange={e => set('autres_specs', e.target.value)} placeholder="Conditionnement, taille, couleur…" style={inpStyle} />
                </FL>
              </div>
            </>}

            {!isMed && <>
              <ST>Lieu d'utilisation</ST>
              <FL label="Service, salle, localisation" style={{ marginBottom: 12 }}>
                <input value={form.lieu_utilisation} onChange={e => set('lieu_utilisation', e.target.value)} placeholder="Ex : Bloc opératoire" list="ac-lieux" style={inpStyle} />
                <datalist id="ac-lieux">{lieux.map(l => <option key={l} value={l} />)}</datalist>
              </FL>
            </>}

            <ST>Pièces jointes (facultatif)</ST>
            <div onClick={() => fileInputRef.current?.click()} style={{ border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', marginBottom: 10, background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Cliquer pour ajouter un fichier</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>PDF, Word, Excel, Image · Max 10 Mo</div>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFichiers} style={{ display: 'none' }} />
            {fichiers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {fichiers.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5 }}>{f.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{Math.round(f.size / 1024)} Ko</div></div>
                    <button onClick={() => supprimerFichier(i)} style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Retirer</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={foot}>
            <div style={{ fontSize: 12.5 }}>
              {!formValide && (
                <span style={{ color: '#c0392b' }}>{erreurChamp()}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13.5, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>Annuler</button>
              <button
                onClick={() => { if (formValide) setEtape('confirm') }}
                disabled={!formValide}
                style={{
                  padding: '8px 20px', fontSize: 13.5, border: 'none', borderRadius: 6,
                  background: formValide ? '#1B9DE0' : '#d4d4d0',
                  color: formValide ? '#fff' : '#8a96a3',
                  cursor: formValide ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {labelBouton ?? 'Soumettre →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
