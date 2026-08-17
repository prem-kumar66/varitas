"""
PDF Report Generator
====================
Produces a clean, recruiter-friendly PDF summary of an interview session.
"""
import io
import json
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

# Dark luxury palette
GOLD = HexColor("#C9A961")
INK = HexColor("#171614")
CREAM = HexColor("#FAF3E0")
EMERALD = HexColor("#059669")
CRIMSON = HexColor("#DC2626")
GOLD_DARK = HexColor("#8B6F2E")


def _styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("title", parent=base["Title"],
                                fontName="Helvetica-Bold", fontSize=28,
                                textColor=GOLD_DARK, alignment=TA_LEFT,
                                spaceAfter=4),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"],
                                   fontName="Helvetica", fontSize=10,
                                   textColor=GOLD_DARK, letterSpacing=3,
                                   spaceAfter=20),
        "h2": ParagraphStyle("h2", parent=base["Heading2"],
                             fontName="Helvetica-Bold", fontSize=14,
                             textColor=INK, spaceBefore=16, spaceAfter=8),
        "h3": ParagraphStyle("h3", parent=base["Heading3"],
                             fontName="Helvetica-Bold", fontSize=11,
                             textColor=GOLD_DARK, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["Normal"],
                               fontName="Helvetica", fontSize=10,
                               textColor=black, leading=14, spaceAfter=6),
        "quote": ParagraphStyle("quote", parent=base["Normal"],
                                fontName="Helvetica-Oblique", fontSize=10,
                                textColor=HexColor("#2E2B27"),
                                leftIndent=20, rightIndent=20,
                                leading=14, spaceAfter=8),
        "small": ParagraphStyle("small", parent=base["Normal"],
                                fontName="Helvetica", fontSize=8,
                                textColor=HexColor("#666"), leading=11),
        "footer": ParagraphStyle("footer", parent=base["Normal"],
                                 fontName="Helvetica-Oblique", fontSize=8,
                                 textColor=HexColor("#999"), alignment=TA_CENTER),
    }
    return styles


def _risk_color(score: float) -> HexColor:
    if score >= 70: return CRIMSON
    if score >= 40: return GOLD
    return EMERALD


def _risk_label(score: float) -> str:
    if score >= 70: return "HIGH RISK"
    if score >= 40: return "ELEVATED"
    return "BASELINE"


def generate_report(session: dict, answers: list) -> bytes:
    """Render the student recruitment report to a PDF byte string."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        topMargin=0.6*inch, bottomMargin=0.6*inch,
        leftMargin=0.7*inch, rightMargin=0.7*inch,
    )
    s = _styles()
    story = []

    # ---------- Header ----------
    story.append(Paragraph("VERITAS ACADEMIC", s["title"]))
    story.append(Paragraph("STUDENT RECRUITMENT & COGNITIVE ASSESSMENT REPORT", s["subtitle"]))

    started = datetime.fromtimestamp(session.get("started_at", 0)).strftime("%B %d, %Y · %H:%M")
    candidate = session.get("candidate_name") or "Unnamed Student"
    roll_no = session.get("roll_number") or "N/A"
    mobile_no = session.get("mobile_number") or "N/A"
    year_str = session.get("academic_year") or "N/A"
    subject = session.get("subject_key") or session.get("role") or "General Assessment"
    mode_str = (session.get("mode") or "oral").upper()

    header_table = Table(
        [
            ["Student Name:", candidate, "Roll Number:", roll_no],
            ["Mobile Number:", mobile_no, "Academic Year:", year_str],
            ["Department/Subject:", subject, "Assessment Mode:", mode_str],
            ["Session ID:", session.get("id", "—")[:16], "Conducted:", started],
        ],
        colWidths=[1.3*inch, 2.2*inch, 1.3*inch, 2.2*inch],
    )
    header_table.setStyle(TableStyle([
        ("FONT", (0,0), (-1,-1), "Helvetica", 9),
        ("FONT", (0,0), (0,-1), "Helvetica-Bold", 9),
        ("FONT", (2,0), (2,-1), "Helvetica-Bold", 9),
        ("TEXTCOLOR", (0,0), (-1,-1), black),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 16))

    # ---------- Summary ----------
    real_answers = [a for a in answers if not a.get("is_calibration")]
    avg_auth = sum(a.get("authenticity_score", 100.0) for a in real_answers) / max(1, len(real_answers))
    avg_acc = sum(a.get("accuracy_score", 0.0) for a in real_answers) / max(1, len(real_answers))
    avg_overall = sum(a.get("overall_score", (avg_acc * 0.65 + avg_auth * 0.35)) for a in real_answers) / max(1, len(real_answers))
    avg_risk = 100 - avg_auth
    risk_color = _risk_color(avg_risk)
    tier = _risk_label(avg_risk)

    story.append(Paragraph("Overall Student Evaluation Summary", s["h2"]))

    summary_table = Table(
        [[
            Paragraph(f"<b>{avg_overall:.1f}/100</b><br/><font size=8>OVERALL SCORE</font>", s["body"]),
            Paragraph(f"<b>{avg_acc:.1f}%</b><br/><font size=8>CONCEPT ACCURACY</font>", s["body"]),
            Paragraph(f"<b>{avg_auth:.1f}%</b><br/><font size=8>AUTHENTICITY</font>", s["body"]),
            Paragraph(f"<b>{tier}</b><br/><font size=8>ANTI-CHEAT TIER</font>", s["body"]),
        ]],
        colWidths=[1.7*inch]*4,
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,0), HexColor("#FAF3E0")),
        ("BACKGROUND", (1,0), (1,0), HexColor("#E6F4EA")),
        ("BACKGROUND", (2,0), (2,0), HexColor("#F5EDD3")),
        ("BACKGROUND", (3,0), (3,0), risk_color),
        ("TEXTCOLOR", (3,0), (3,0), white),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("FONT", (0,0), (-1,-1), "Helvetica", 16),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 14),
        ("BOTTOMPADDING", (0,0), (-1,-1), 14),
        ("BOX", (0,0), (-1,-1), 0.5, GOLD_DARK),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))

    # ---------- Methodology note ----------
    story.append(Paragraph("Evaluation Framework", s["h2"]))
    story.append(Paragraph(
        "Veritas Academic evaluates students using a dual-pillar scoring model: "
        "<b>1) Semantic Answer Key Validation</b> (65% weight) comparing student answers against evaluator model solutions & rubrics, and "
        "<b>2) Anti-Cheat Cognitive Authenticity Analysis</b> (35% weight) detecting copy-paste attempts, typing cadence anomalies, "
        "speech pauses, and AI-generated perplexity signatures. Combine automated scores with evaluator oversight.",
        s["body"]
    ))

    # ---------- Per-answer breakdown ----------
    story.append(Paragraph("Detailed Question & Answer Analysis", s["h2"]))

    for i, a in enumerate(real_answers, 1):
        signals = json.loads(a["signals_json"]) if isinstance(a["signals_json"], str) else (a["signals_json"] or {})
        explanations = json.loads(a["explanations_json"]) if isinstance(a["explanations_json"], str) else (a["explanations_json"] or {})
        risk = a.get("risk_score", 0.0)
        acc = a.get("accuracy_score", 0.0)
        overall = a.get("overall_score", 0.0)
        c = _risk_color(risk)
        label = _risk_label(risk)
        ans_mode = (a.get("mode") or "oral").upper()

        # Q&A Header
        story.append(Paragraph(f"Q{i}. {a['question']} [{ans_mode} MODE]", s["h3"]))
        story.append(Paragraph(f'<b>Student Answer:</b> "{a["transcript"]}"', s["quote"]))

        ref_ans = a.get("reference_answer")
        if ref_ans:
            story.append(Paragraph(f'<b>Expected Model Answer:</b> "{ref_ans}"', s["quote"]))

        # Stats row
        ppl = a.get("perplexity")
        ppl_str = f"PPL {ppl:.0f}" if ppl else "PPL n/a"
        pastes = a.get("copy_paste_attempts", 0)
        paste_str = f" · <font color='red'>{pastes} Paste Attempt(s)</font>" if pastes > 0 else ""
        meta = (f'<font color="#444">'
                f'<b>Accuracy:</b> {acc:.1f}% | <b>Authenticity:</b> {100-risk:.1f}% | <b>Final Score:</b> {overall:.1f}/100<br/>'
                f'{a["word_count"]} words · {a.get("duration_sec", 0):.1f}s · {ppl_str}{paste_str}'
                f'</font>')
        story.append(Paragraph(meta, s["small"]))
        story.append(Spacer(1, 6))

        # Conceptual Feedback
        fb = a.get("conceptual_feedback")
        if fb:
            story.append(Paragraph(f'<b>Evaluator Feedback:</b> {fb}', s["body"]))

        # Signal grid
        rows = [["Signal / Metric", "Score", "Audit Details"]]
        for sig, score in signals.items():
            rows.append([
                sig.capitalize(),
                f"{score:.0f}",
                explanations.get(sig, ""),
            ])
        signal_tbl = Table(rows, colWidths=[1.4*inch, 0.6*inch, 4.7*inch])
        signal_tbl.setStyle(TableStyle([
            ("FONT", (0,0), (-1,0), "Helvetica-Bold", 8),
            ("FONT", (0,1), (-1,-1), "Helvetica", 8),
            ("BACKGROUND", (0,0), (-1,0), HexColor("#22201D")),
            ("TEXTCOLOR", (0,0), (-1,0), CREAM),
            ("BACKGROUND", (0,1), (-1,-1), HexColor("#FAF8F0")),
            ("BOX", (0,0), (-1,-1), 0.3, HexColor("#888")),
            ("INNERGRID", (0,0), (-1,-1), 0.2, HexColor("#CCC")),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(signal_tbl)
        story.append(Spacer(1, 14))

        if i % 2 == 0 and i < len(real_answers):
            story.append(PageBreak())

    # ---------- Footer ----------
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "Generated by Veritas Academic · Student Recruitment & Cognitive Evaluation Platform", s["footer"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()

