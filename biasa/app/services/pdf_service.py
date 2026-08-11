# biasa/app/services/pdf_service.py
import os
import hmac
import hashlib
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from app.core.config import settings

GRIS_BORD = colors.HexColor('#CCCCCC')
GRIS_LEGER = colors.HexColor('#F2F2F2')
BLEU = colors.HexColor('#003580')
NOIR = colors.HexColor('#1a1a1a')

import os
LOGO_PATH = os.path.join(os.path.dirname(__file__), 'logo_biasa.png')

ACTIONS_SIGNATURE = ('validation_responsable', 'rejet_responsable', 'validation_daf', 'rejet_daf')


def code_verification(da: dict) -> str:
    """Code court dérivé (HMAC) du numéro de DA, du montant commandé et de
    l'historique des décisions (qui, quand). Comme l'historique n'est jamais
    modifiable après coup, ce code ne peut être reproduit que si ces données
    n'ont pas changé depuis l'impression — toute altération (dans la base ou
    sur le papier) fait que le code recalculé ne correspond plus."""
    parties = [str(da.get('numero', '')), str(da.get('montant_total_commande', 0) or 0)]
    for h in da.get('historique', []):
        if h.get('action') in ACTIONS_SIGNATURE:
            uid = (h.get('utilisateur') or {}).get('id', '')
            parties.append(f"{h['action']}:{uid}:{h.get('date_action', '')}")
    base = '|'.join(parties)
    digest = hmac.new(settings.SECRET_KEY.encode(), base.encode(), hashlib.sha256).hexdigest()
    return f"{digest[:4]}-{digest[4:8]}-{digest[8:12]}".upper()


MOTIF_LABELS = {
    'reappro': 'Réapprovisionnement régulier',
    'nouveau_besoin': 'Nouveau besoin',
    'commande_specifique': 'Commande spécifique patient',
    'remplacement': 'Remplacement / Panne',
    'activite_urgente': 'Activité urgente',
}
URGENCE_LABELS = {
    'haute': 'Haute (24h)',
    'moyenne': 'Moyenne (48h)',
    'faible': 'Faible (>72h)',
}


def P(txt, **kw):
    s = ParagraphStyle('_',
        fontName=kw.pop('fontName', 'Helvetica'),
        fontSize=kw.pop('fontSize', 8),
        leading=kw.pop('leading', 11),
        textColor=kw.pop('textColor', NOIR),
        **kw)
    return Paragraph(str(txt), s)


def Pb(txt, **kw):
    kw.setdefault('fontName', 'Helvetica-Bold')
    return P(txt, **kw)


def base_tbl(t):
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, GRIS_BORD),
        ('BACKGROUND', (0,0), (-1,0), GRIS_LEGER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTSIZE', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))


def get_hist(historique, *actions):
    for h in historique:
        if h.get('action') in actions:
            return h
    return None


def cell_decision(h):
    if not h: return ''
    nom = f"{h['utilisateur']['prenom']} {h['utilisateur']['nom']}"
    dec = 'Validé' if 'validation' in h['action'] else 'Rejeté'
    return f"{nom} : {dec}"


def cell_date(h):
    if not h: return ''
    d = h.get('date_action', '')
    return d[:10].replace('-', '/') if d else ''


def build_pdf(da: dict, is_medical: bool) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=1.8*cm, leftMargin=1.8*cm,
        topMargin=1.5*cm, bottomMargin=1.8*cm)
    story = []

    # ── EN-TÊTE ──────────────────────────────────────────────────────────
    # 1. Logo tout en haut à droite
    logo = Image(LOGO_PATH, width=3.8*cm, height=1.6*cm)
    logo_row = Table([[P(''), logo]], colWidths=[12.2*cm, 3.8*cm])
    logo_row.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(logo_row)
    story.append(Spacer(1, 0.3*cm))

    # 2. Titre centré en bleu gras
    sous_titre = 'Articles Médicaux & Consommables' if is_medical else 'Bien & Service'
    story.append(Pb(
        f'FICHE DE DEMANDE D\'ACHAT ({sous_titre})',
        fontSize=11, textColor=BLEU, alignment=TA_CENTER
    ))
    story.append(Spacer(1, 0.15*cm))

    # 4. Numéro DA centré
    story.append(P(
        f'N° {da.get("numero", "")}',
        fontSize=8, textColor=colors.HexColor('#666666'), alignment=TA_CENTER
    ))
    story.append(Spacer(1, 0.2*cm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=BLEU, spaceAfter=8))

    # ── 1. INFORMATIONS GÉNÉRALES ─────────────────────────────────────────
    story.append(Pb('Informations générales',
        fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
    for label, val in [
        ('Date de la demande', da.get('date_demande', '')),
        ('Service demandeur', da.get('service_demandeur', '')),
        ('Nom du demandeur', da.get('demandeur_nom', '')),
        ('Poste / Fonction', da.get('poste_fonction', '')),
    ]:
        row = Table([[Pb(f'• {label} :'), P(str(val))]], colWidths=[5*cm, 11*cm])
        row.setStyle(TableStyle([
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 2),
        ]))
        story.append(row)
    story.append(Spacer(1, 0.25*cm))

    # ── 2. JUSTIFICATION ─────────────────────────────────────────────────
    story.append(Pb('Justification du besoin',
        fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
    motif = MOTIF_LABELS.get(da.get('motif', ''), da.get('motif', ''))
    urgence = URGENCE_LABELS.get(da.get('urgence', ''), da.get('urgence', ''))
    just_rows = [
        [P(f'• <b>Motif :</b>  {motif}')],
        [P(f'• <b>Niveau d\'urgence :</b>  {urgence}')],
    ]
    if da.get('justification'):
        just_rows.append([P(f'• <b>Précisions :</b>  {da["justification"]}')])
    jt = Table(just_rows, colWidths=[16*cm])
    jt.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, GRIS_BORD),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(jt)
    story.append(Spacer(1, 0.25*cm))

    # ── 3. DESCRIPTION DU BESOIN ─────────────────────────────────────────
    story.append(Pb('Description du besoin',
        fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
    lignes = da.get('lignes', [])

    if is_medical:
        header = [
            Pb('N°', alignment=TA_CENTER),
            Pb('Désignation de l\'article\n(Nom complet)', alignment=TA_CENTER),
            Pb('Qté\ndemandée', alignment=TA_CENTER),
            Pb('Unité\n(Boîte, Pièce, Kit)', alignment=TA_CENTER),
            Pb('Stock actuel\n(Approximatif)', alignment=TA_CENTER),
            Pb('Réf. Fournisseur /\nMarque (Si connue)', alignment=TA_CENTER),
            Pb('Observation', alignment=TA_CENTER),
        ]
        rows = [header]
        for i, l in enumerate(lignes[:10], 1):
            rows.append([
                P(str(i), alignment=TA_CENTER),
                P(str(l.get('designation', ''))),
                P(str(l.get('quantite', '')), alignment=TA_CENTER),
                P(str(l.get('unite', '')), alignment=TA_CENTER),
                P(str(l.get('stock_actuel', '')), alignment=TA_CENTER),
                P(str(l.get('reference_marque', ''))),
                P(str(l.get('observation', ''))),
            ])
        t = Table(rows,
                  colWidths=[0.6*cm, 4.2*cm, 1.4*cm, 1.8*cm, 1.9*cm, 2.7*cm, 3.4*cm],
                  rowHeights=[0.9*cm] + [0.6*cm] * min(len(lignes), 10))
    else:
        header = [
            Pb('N°', alignment=TA_CENTER),
            Pb('Désignation du besoin / service', alignment=TA_CENTER),
            Pb('Qté', alignment=TA_CENTER),
            Pb('Unité', alignment=TA_CENTER),
            Pb('Description technique / détails', alignment=TA_CENTER),
            Pb('Observation', alignment=TA_CENTER),
        ]
        rows = [header]
        for i, l in enumerate(lignes[:10], 1):
            rows.append([
                P(str(i), alignment=TA_CENTER),
                P(str(l.get('designation', ''))),
                P(str(l.get('quantite', '')), alignment=TA_CENTER),
                P(str(l.get('unite', ''))),
                P(str(l.get('description_technique', ''))),
                P(str(l.get('observation', ''))),
            ])
        t = Table(rows,
                  colWidths=[0.6*cm, 3.5*cm, 1.2*cm, 1.4*cm, 5.7*cm, 3.6*cm],
                  rowHeights=[0.9*cm] + [0.6*cm] * min(len(lignes), 10))

    base_tbl(t)
    story.append(t)
    story.append(Spacer(1, 0.25*cm))

    # ── 4. SPÉCIFICATIONS / LIEU ─────────────────────────────────────────
    if is_medical:
        story.append(Pb('Spécifications Techniques',
            fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
        specs = []
        if da.get('normes_certifications'):
            specs.append(f"• Normes / Certifications exigées : {da['normes_certifications']}")
        if da.get('date_peremption_min'):
            specs.append(f"• Date de péremption minimale : {da['date_peremption_min']}")
        if da.get('fournisseur_suggere'):
            specs.append(f"• Fournisseur suggéré : {da['fournisseur_suggere']}")
        if da.get('autres_specs'):
            specs.append(f"• Autres spécifications : {da['autres_specs']}")
        txt = '\n'.join(specs) if specs else ' '
    else:
        story.append(Pb('Lieu d\'utilisation / d\'exécution',
            fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
        txt = da.get('lieu_utilisation', ' ')

    spec_t = Table([[P(txt)]], colWidths=[16*cm])
    spec_t.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, GRIS_BORD),
        ('MINROWHEIGHT', (0,0), (-1,-1), 1.2*cm),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(spec_t)
    story.append(Spacer(1, 0.25*cm))

    # ── 5. VALIDATION HIÉRARCHIQUE ────────────────────────────────────────
    story.append(Pb('Validation hiérarchique',
        fontSize=9, textColor=BLEU, spaceBefore=2, spaceAfter=4))
    hist = da.get('historique', [])
    resp = get_hist(hist, 'validation_responsable', 'rejet_responsable')
    daf  = get_hist(hist, 'validation_daf', 'rejet_daf')

    vd = [
        [Pb('Visa', alignment=TA_CENTER), Pb('Signature', alignment=TA_CENTER), Pb('Date', alignment=TA_CENTER)],
        [P('Responsable du service demandeur'), P(cell_decision(resp)), P(cell_date(resp), alignment=TA_CENTER)],
        [P('DAF'), P(cell_decision(daf)), P(cell_date(daf), alignment=TA_CENTER)],
    ]
    vt = Table(vd, colWidths=[5*cm, 8*cm, 3*cm], rowHeights=[0.65*cm, 1.3*cm, 1.3*cm])
    base_tbl(vt)
    story.append(vt)

    # ── Code de vérification ────────────────────────────────────────────
    # N'apparaît que si la DA a au moins une décision (validation/rejet) —
    # avant ça, le document n'a rien à authentifier.
    if any(h.get('action') in ACTIONS_SIGNATURE for h in hist):
        story.append(Spacer(1, 0.3*cm))
        code = code_verification(da)
        story.append(P(
            f'Code de vérification : {code}',
            fontSize=7, textColor=colors.HexColor('#8a96a3')
        ))

    doc.build(story)
    return buffer.getvalue()
