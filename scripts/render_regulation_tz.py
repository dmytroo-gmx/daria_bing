"""Render the dated regulation specification as a readable PDF."""

import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def format_inline(value):
    value = html.escape(value.strip())
    value = re.sub(r"`([^`]+)`", r"<font color='#694919'>\1</font>", value)
    value = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", value)
    return value


def render(source, target):
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleRu", fontName="Arial-Bold", fontSize=19, leading=24, textColor=colors.HexColor("#1b1a19"), spaceAfter=11))
    styles.add(ParagraphStyle(name="HeadingRu", fontName="Arial-Bold", fontSize=11.5, leading=15, textColor=colors.HexColor("#5d421e"), spaceBefore=11, spaceAfter=5))
    styles.add(ParagraphStyle(name="BodyRu", fontName="Arial", fontSize=8.8, leading=12.7, spaceAfter=4))
    styles.add(ParagraphStyle(name="SmallRu", fontName="Arial", fontSize=8, leading=11, spaceAfter=4))
    styles.add(ParagraphStyle(name="TableHeadRu", fontName="Arial-Bold", fontSize=7.2, leading=9.5, textColor=colors.white))
    styles.add(ParagraphStyle(name="TableRu", fontName="Arial", fontSize=7.1, leading=9.5))
    story = []
    lines = source.read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("# "):
            story.append(Paragraph(format_inline(line[2:]), styles["TitleRu"]))
        elif line.startswith("## "):
            story.append(Paragraph(format_inline(line[3:]), styles["HeadingRu"]))
        elif line.startswith("| "):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[- :]+", cell) for cell in cells):
                    style = styles["TableHeadRu"] if not rows else styles["TableRu"]
                    rows.append([Paragraph(format_inline(cell), style) for cell in cells])
                index += 1
            table = Table(rows, colWidths=[15 * mm, 46 * mm, 60 * mm, 65 * mm], repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#25211d")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f4ec")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d7cec0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.extend([table, Spacer(1, 4 * mm)])
            continue
        elif line.startswith("- ") or re.match(r"^\d+\. ", line):
            marker = "•" if line.startswith("- ") else line.split(".", 1)[0] + "."
            body = line[2:] if line.startswith("- ") else line.split(". ", 1)[1]
            story.append(Paragraph(f"{marker}  {format_inline(body)}", styles["BodyRu"]))
        else:
            story.append(Paragraph(format_inline(line), styles["BodyRu"]))
        index += 1

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Arial", 8)
        canvas.setFillColor(colors.HexColor("#77716a"))
        canvas.drawString(14 * mm, 10 * mm, "Legacy Brain · дополнительное ТЗ · 07.10.2026")
        canvas.drawRightString(200 * mm, 10 * mm, str(document.page))
        canvas.restoreState()

    target.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(target), pagesize=(210 * mm, 297 * mm), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=13 * mm, bottomMargin=18 * mm)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    render(Path(sys.argv[1]), Path(sys.argv[2]))
