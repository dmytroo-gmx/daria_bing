"""Render the source-checked Russian user manual to a readable A4 PDF."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


SOURCE = Path(__file__).resolve().parents[1] / "docs" / "ПОЛНОЕ_РУКОВОДСТВО_LEGACY_BRAIN_2026-10-07.md"
DEFAULT_OUTPUT = Path("C:/Users/Co-Founder/Desktop/Legacy_Brain_Полная_инструкция_2026-10-07.pdf")
FONT_DIR = Path("C:/Windows/Fonts")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("ArialManual", str(FONT_DIR / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("ArialManualBold", str(FONT_DIR / "arialbd.ttf")))
    pdfmetrics.registerFontFamily("ArialManual", normal="ArialManual", bold="ArialManualBold")


def inline(text: str) -> str:
    safe = escape(text)
    safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)
    safe = re.sub(r"`(.+?)`", r"<font color='#765633'>\1</font>", safe)
    return safe


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#d7cbb9"))
    canvas.setLineWidth(0.4)
    canvas.line(43, height - 37, width - 43, height - 37)
    canvas.setFont("ArialManual", 7.6)
    canvas.setFillColor(colors.HexColor("#766b61"))
    canvas.drawString(43, height - 30, "LEGACY BRAIN  •  РУКОВОДСТВО КОМАНДЫ")
    canvas.line(43, 42, width - 43, 42)
    canvas.drawString(43, 29, "Версия 13.10.2026  •  по действующему интерфейсу")
    canvas.drawRightString(width - 43, 29, f"{doc.page}")
    canvas.restoreState()


def build(source: Path, output: Path) -> None:
    register_fonts()
    body = ParagraphStyle(
        "body", fontName="ArialManual", fontSize=9.6, leading=13.7,
        textColor=colors.HexColor("#282420"), spaceAfter=5.5, allowWidows=0, allowOrphans=0,
    )
    heading = ParagraphStyle(
        "heading", parent=body, fontName="ArialManualBold", fontSize=15.2,
        leading=18.4, textColor=colors.HexColor("#3d3026"),
        spaceBefore=16, spaceAfter=7, keepWithNext=True,
    )
    subheading = ParagraphStyle(
        "subheading", parent=body, fontName="ArialManualBold", fontSize=11.3,
        leading=14.2, textColor=colors.HexColor("#64502f"),
        spaceBefore=10, spaceAfter=5, keepWithNext=True,
    )
    title = ParagraphStyle(
        "title", parent=body, fontName="ArialManualBold", fontSize=27,
        leading=32, textColor=colors.HexColor("#27201d"), spaceAfter=18,
    )
    subtitle = ParagraphStyle(
        "subtitle", parent=body, fontSize=13.5, leading=19,
        textColor=colors.HexColor("#886936"), spaceAfter=19,
    )
    bullet = ParagraphStyle(
        "bullet", parent=body, leftIndent=17, firstLineIndent=-12,
        spaceAfter=3.5, bulletIndent=0,
    )
    contents = ParagraphStyle(
        "contents", parent=body, leftIndent=13, fontSize=9.8,
        leading=15, spaceAfter=3,
    )
    doc = SimpleDocTemplate(
        str(output), pagesize=A4, rightMargin=46, leftMargin=46,
        topMargin=54, bottomMargin=57, title="Legacy Brain и Всё под рукой — полная инструкция",
        author="Legacy Imperial", subject="Подробное руководство для команды",
    )
    story = []
    lines = source.read_text(encoding="utf-8").splitlines()
    in_contents = False
    paragraph_lines: list[str] = []

    def flush() -> None:
        if paragraph_lines:
            story.append(Paragraph(inline(" ".join(paragraph_lines)), body))
            paragraph_lines.clear()

    for index, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            flush()
            continue
        if line.startswith("# "):
            flush()
            if index == 0:
                story.append(Spacer(1, 76))
                story.append(HRFlowable(width="100%", thickness=3, color=colors.HexColor("#a37c36")))
                story.append(Spacer(1, 26))
                story.append(Paragraph(inline(line[2:]), title))
            else:
                story.append(Paragraph(inline(line[2:]), heading))
            continue
        if line.startswith("## "):
            flush()
            text = line[3:]
            if text == "Подробная инструкция для команды":
                story.append(Paragraph(inline(text), subtitle))
            elif text == "Содержание":
                in_contents = True
                story.append(Spacer(1, 15))
                story.append(Paragraph(text, heading))
            else:
                if in_contents:
                    story.append(PageBreak())
                    in_contents = False
                story.append(Paragraph(inline(text), heading))
            continue
        if line.startswith("### "):
            flush()
            story.append(Paragraph(inline(line[4:]), subheading))
            continue
        match = re.match(r"^(\d+)\.\s+(.+)", line)
        if match:
            flush()
            number, content = match.groups()
            style = contents if in_contents else bullet
            story.append(Paragraph(f"{number}.  {inline(content)}", style))
            continue
        if line.startswith("- "):
            flush()
            story.append(Paragraph("•  " + inline(line[2:]), bullet))
            continue
        paragraph_lines.append(line)
    flush()
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    build(args.source, args.output)
