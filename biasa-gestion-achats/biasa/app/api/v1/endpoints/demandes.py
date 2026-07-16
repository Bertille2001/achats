from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists
from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.schemas import DemandeAchatCreate, DemandeAchatOut, ValidationRequest, RejetRequest, FichierDAOut, MessageDACreate, MessageDAOut, DemandeAchatUpdate
from app.services import da_service
from app.models.models import RoleUtilisateur, DemandeAchat, FichierDA, HistoriqueValidation, ActionHistorique
from app.core.config import UPLOAD_PATH

router = APIRouter(prefix="/demandes", tags=["Demandes d'achat"])


# !! Routes fixes AVANT /{da_id} !!

@router.get("/mes-demandes", response_model=list[DemandeAchatOut])
async def mes_demandes(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.mes_demandes(db, current_user.id)


@router.get("/a-valider", response_model=list[DemandeAchatOut])
async def a_valider(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == RoleUtilisateur.DEMANDEUR:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return await da_service.demandes_a_valider(db, current_user)


@router.get("/mes-validations", response_model=list[DemandeAchatOut])
async def mes_validations(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    actions_validateur = [
        ActionHistorique.VALIDATION_RESPONSABLE,
        ActionHistorique.REJET_RESPONSABLE,
        ActionHistorique.VALIDATION_DAF,
        ActionHistorique.REJET_DAF,
        ActionHistorique.TRAITEMENT_ACHETEUR,
    ]
    result = await db.execute(
        select(DemandeAchat)
        .where(
            exists(
                select(HistoriqueValidation.id).where(
                    HistoriqueValidation.demande_id == DemandeAchat.id,
                    HistoriqueValidation.utilisateur_id == current_user.id,
                    HistoriqueValidation.action.in_(actions_validateur),
                )
            )
        )
        .options(*da_service._load_options())
        .order_by(DemandeAchat.mise_a_jour_le.desc())
    )
    return list(result.scalars().all())


# !! Routes avec /{da_id} APRES !!

@router.get("/{da_id}/pdf")
async def telecharger_pdf(
    da_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.services.pdf_service import build_pdf
    da = await da_service._get_da_or_404(db, da_id)
    if current_user.role == RoleUtilisateur.DEMANDEUR and da.demandeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    da_dict = {
        'numero': da.numero,
        'date_demande': da.date_demande.strftime('%d/%m/%Y'),
        'service_demandeur': da.service_demandeur or '',
        'demandeur_nom': f"{da.demandeur.prenom} {da.demandeur.nom}",
        'poste_fonction': da.poste_fonction or '',
        'motif': da.motif.value,
        'urgence': da.urgence.value,
        'justification': da.justification or '',
        'normes_certifications': da.normes_certifications or '',
        'date_peremption_min': da.date_peremption_min or '',
        'fournisseur_suggere': da.fournisseur_suggere or '',
        'autres_specs': da.autres_specs or '',
        'lieu_utilisation': da.lieu_utilisation or '',
        'lignes': [
            {
                'designation': l.designation,
                'quantite': l.quantite,
                'unite': l.unite or '',
                'stock_actuel': l.stock_actuel or '',
                'reference_marque': l.reference_marque or '',
                'description_technique': l.description_technique or '',
                'observation': l.observation or '',
            }
            for l in da.lignes
        ],
        'historique': [
            {
                'action': h.action.value,
                'utilisateur': {'prenom': h.utilisateur.prenom, 'nom': h.utilisateur.nom},
                'date_action': h.date_action.isoformat(),
                'commentaire': h.commentaire or '',
            }
            for h in da.historique
        ],
    }

    pdf = build_pdf(da_dict, is_medical=(da.type_da.value == 'medical'))
    return Response(
        content=pdf,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{da.numero}.pdf"'}
    )



@router.get("/toutes", response_model=list[DemandeAchatOut])
async def toutes_demandes_acheteur(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Toutes les DA — visibles par le Service Achats et l'Admin pour voir où ça bloque."""
    if current_user.role not in ('acheteur', 'admin', 'responsable', 'daf'):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return await da_service.toutes_les_demandes_acheteur(db)
@router.get("/{da_id}", response_model=DemandeAchatOut)
async def detail(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    da = await da_service._get_da_or_404(db, da_id)
    if current_user.role == RoleUtilisateur.DEMANDEUR and da.demandeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return da


@router.post("/", response_model=DemandeAchatOut, status_code=201)
async def creer(data: DemandeAchatCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.creer_demande(db, data, current_user)


@router.post("/{da_id}/soumettre", response_model=DemandeAchatOut)
async def soumettre(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.soumettre_demande(db, da_id, current_user)


@router.post("/{da_id}/valider-responsable", response_model=DemandeAchatOut)
async def valider_responsable(da_id: int, body: ValidationRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.valider_responsable(db, da_id, current_user, body.commentaire)


@router.post("/{da_id}/rejeter-responsable", response_model=DemandeAchatOut)
async def rejeter_responsable(da_id: int, body: RejetRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.rejeter_responsable(db, da_id, current_user, body.commentaire)


@router.post("/{da_id}/valider-daf", response_model=DemandeAchatOut)
async def valider_daf(da_id: int, body: ValidationRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.valider_daf(db, da_id, current_user, body.commentaire)


@router.post("/{da_id}/rejeter-daf", response_model=DemandeAchatOut)
async def rejeter_daf(da_id: int, body: RejetRequest, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.rejeter_daf(db, da_id, current_user, body.commentaire)


@router.post("/{da_id}/confirmer-reception-demandeur", response_model=DemandeAchatOut)
async def confirmer_reception_demandeur(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.confirmer_reception_demandeur(db, da_id, current_user)


@router.post("/{da_id}/confirmer-reception-acheteur", response_model=DemandeAchatOut)
async def confirmer_reception_acheteur(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.confirmer_reception_acheteur(db, da_id, current_user)


@router.post("/{da_id}/marquer-bc-cree", response_model=DemandeAchatOut)
async def marquer_bc_cree(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.marquer_bc_cree(db, da_id, current_user)


@router.post("/{da_id}/marquer-commande", response_model=DemandeAchatOut)
async def marquer_commande(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.marquer_commande(db, da_id, current_user)


@router.post("/{da_id}/marquer-livre", response_model=DemandeAchatOut)
async def marquer_livre(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.marquer_livre(db, da_id, current_user)


@router.get("/{da_id}/messages", response_model=list[MessageDAOut])
async def lister_messages(da_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.lister_messages(db, da_id, current_user)


@router.post("/{da_id}/messages", response_model=DemandeAchatOut, status_code=201)
async def envoyer_message(da_id: int, body: MessageDACreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.envoyer_message(db, da_id, current_user, body.texte)


@router.post("/{da_id}/fichiers", response_model=FichierDAOut, status_code=201)
async def upload(da_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    return await da_service.upload_fichier(db, da_id, file, current_user)


@router.get("/{da_id}/fichiers/{fichier_id}/apercu")
async def apercu(da_id: int, fichier_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(FichierDA).where(FichierDA.id == fichier_id, FichierDA.demande_id == da_id)
    )
    fichier = result.scalar_one_or_none()
    if not fichier:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin = UPLOAD_PATH / fichier.nom_stockage
    if not chemin.exists():
        raise HTTPException(status_code=404, detail="Fichier manquant")
    return FileResponse(path=str(chemin), media_type=fichier.mime_type)


@router.get("/{da_id}/fichiers/{fichier_id}/telecharger")
async def telecharger(da_id: int, fichier_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    chemin, nom = await da_service.telecharger_fichier(db, da_id, fichier_id, current_user)
    return FileResponse(path=str(chemin), filename=nom, media_type="application/octet-stream")



@router.put("/{da_id}", response_model=DemandeAchatOut)
async def modifier_demande(da_id: int, data: DemandeAchatUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Modifier une DA en brouillon ou rejetée. Après rejet, le demandeur peut
    corriger et renvoyer une seule fois."""
    return await da_service.modifier_demande(db, da_id, data, current_user)
