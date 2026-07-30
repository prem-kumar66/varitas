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
    """Render the interview report to a PDF byte string."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        topMargin=0.6*inch, bottomMargin=0.6*inch,
        leftMargin=0.7*inch, rightMargin=0.7*inch,
    )
    s = _styles()
    story = []

    # ---------- Header ----------
    story.append(Paragraph("VERITAS", s["title"]))
    story.append(Paragraph("INTERVIEW AUTHENTICITY REPORT", s["subtitle"]))

    started = datetime.fromtimestamp(session.get("started_at", 0)).strftime("%B %d, %Y · %H:%M")
    candidate = session.get("candidate_name") or "Unnamed candidate"
    role = session.get("role") or "Role unspecified"

    header_table = Table(
        [
            ["Candidate:", candidate, "Session ID:", session.get("id", "—")[:16]],
            ["Role:",      role,      "Conducted:",  started],
        ],
        colWidths=[1*inch, 2.5*inch, 1*inch, 2.5*inch],
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
    avg_auth = sum(a["authenticity_score"] for a in real_answers) / len(real_answers) if real_answers else 100.0
    avg_risk = 100 - avg_auth
    risk_color = _risk_color(avg_risk)
    tier = _risk_label(avg_risk)

    story.append(Paragraph("Overall Assessment", s["h2"]))

    summary_table = Table(
        [[
            Paragraph(f"<b>{avg_auth:.0f}</b><br/><font size=8>AUTHENTICITY</font>", s["body"]),
            Paragraph(f"<b>{avg_risk:.0f}%</b><br/><font size=8>RISK</font>", s["body"]),
            Paragraph(f"<b>{tier}</b><br/><font size=8>TIER</font>", s["body"]),
            Paragraph(f"<b>{len(real_answers)}</b><br/><font size=8>ANSWERS ANALYZED</font>", s["body"]),
        ]],
        colWidths=[1.7*inch]*4,
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,0), HexColor("#FAF3E0")),
        ("BACKGROUND", (1,0), (1,0), HexColor("#F5EDD3")),
        ("BACKGROUND", (2,0), (2,0), risk_color),
        ("TEXTCOLOR", (2,0), (2,0), white),
        ("BACKGROUND", (3,0), (3,0), HexColor("#F5EDD3")),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("FONT", (0,0), (-1,-1), "Helvetica", 18),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 16),
        ("BOTTOMPADDING", (0,0), (-1,-1), 16),
        ("BOX", (0,0), (-1,-1), 0.5, GOLD_DARK),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))

    # ---------- Methodology note ----------
    story.append(Paragraph("Methodology", s["h2"]))
    story.append(Paragraph(
        "Veritas combines six behavioral signals (response delay, language-model perplexity, "
        "hesitation rate, AI-typical phrasing, speech pacing, cross-answer consistency) into a "
        "composite authenticity score. Where possible, signals are calibrated against the "
        "candidate's own baseline rather than population averages — this reduces unfairness "
        "toward non-native speakers and naturally articulate candidates. "
        "This report is decision support, not a verdict. Combine with human judgment.",
        s["body"]
    ))

    # ---------- Per-answer breakdown ----------
    story.append(Paragraph("Answer-by-Answer Breakdown", s["h2"]))

    for i, a in enumerate(real_answers, 1):
        signals = json.loads(a["signals_json"]) if isinstance(a["signals_json"], str) else a["signals_json"]
        explanations = json.loads(a["explanations_json"]) if isinstance(a["explanations_json"], str) else a["explanations_json"]
        risk = a["risk_score"]
        c = _risk_color(risk)
        label = _risk_label(risk)

        # Q&A
        story.append(Paragraph(f"Q{i}. {a['question']}", s["h3"]))
        story.append(Paragraph(f'"{a["transcript"]}"', s["quote"]))

        # Stats row
        ppl = a.get("perplexity")
        ppl_str = f"PPL {ppl:.0f}" if ppl else "PPL n/a"
        meta = (f'<font color="#666">'
                f'{a["word_count"]} words · '
                f'{a["duration_sec"]:.1f}s spoken · '
                f'{a["delay_sec"]:.1f}s delay · '
                f'{ppl_str}'
                f'</font>')
        story.append(Paragraph(meta, s["small"]))
        story.append(Spacer(1, 6))

        # Signal grid
        rows = [["Signal", "Score", "Explanation"]]
        for sig, score in signals.items():
            rows.append([
                sig.capitalize(),
                f"{score:.0f}",
                explanations.get(sig, ""),
            ])
        signal_tbl = Table(rows, colWidths=[1.2*inch, 0.6*inch, 4.5*inch])
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
        story.append(Spacer(1, 6))

        # Risk badge + follow-up
        badge = Table([[
            Paragraph(f'<b><font color="white">{label} · {risk:.0f}</font></b>', s["small"]),
            Paragraph(f'<b>Suggested probe:</b> "{a.get("follow_up", "")}"', s["small"]),
        ]], colWidths=[1.3*inch, 5*inch])
        badge.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (0,0), c),
            ("BACKGROUND", (1,0), (1,0), HexColor("#FAF3E0")),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(badge)
        story.append(Spacer(1, 18))

        # Page break every 2 answers
        if i % 2 == 0 and i < len(real_answers):
            story.append(PageBreak())

    # ---------- Footer ----------
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "Generated by Veritas · Behavioral risk estimation, not detection · "
        "Final hiring judgment remains human.", s["footer"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
