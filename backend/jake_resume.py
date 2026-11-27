"""Render the resume text in the layout of Jake's Resume (Overleaf) with the Computer Modern font.

The text comes from the Google Drive resume. If it cannot be read in the expected sections, build_jake_pdf returns
None and the caller falls back to the older layout, so a download never fails because of this module.
"""

from io import BytesIO
from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_DIR = Path(__file__).parent / "fonts"
REGULAR, BOLD, ITALIC = "CMU-Regular", "CMU-Bold", "CMU-Italic"
ICONS_BRANDS, ICONS_SOLID = "FA-Brands", "FA-Solid"  # Font Awesome Free icons (SIL OFL)
DEFAULT_LINKEDIN = "https://www.linkedin.com/in/akash-bhalshanakar/"
DEFAULT_GITHUB = "https://github.com/AkashBhalshankar"
SITE = "https://akashbhalshankar.com"
# Listed in Akash's knowledge base but missing from the Drive resume, so it is added when the Drive text lacks it.
NACHITRAM = {
    "title": "NaChitram: Screen, Webcam & Whiteboard Recorder",
    "tech": "Chrome Extension (MV3), MediaRecorder, Web Audio",
    "link": "Chrome Web Store",
    "url": "https://chromewebstore.google.com/detail/scioflow-screen-webcam-wh/nklfcnddfghefifdpgmlkccbanmmoido",
    "bullets": [
        "Built a free Chrome extension for teachers and creators that records screen and webcam together, with a live whiteboard, a draggable camera bubble and a private teleprompter that never appears in the recording.",
        "Engineered offscreen-page recording and audio mixing with MediaRecorder and Web Audio, writing video to local browser storage in chunks so long recordings survive a crash, with no accounts, servers or cloud upload.",
    ],
}
APP_LINKS = {"shareinsync": "https://shareinsync.akashbhalshankar.com"}

SECTIONS = {
    "summary": "summary",
    "technical skills": "skills",
    "skills": "skills",
    "professional experience": "experience",
    "experience": "experience",
    "projects": "projects",
    "education": "education",
    "certifications & leadership": "extra",
    "certifications and leadership": "extra",
    "certifications": "extra",
}
ORDER = ("summary", "experience", "projects", "education", "skills", "extra")
TITLES = {
    "summary": "Summary", "experience": "Professional Experience", "projects": "Projects",
    "education": "Education", "skills": "Technical Skills", "extra": "Certifications & Leadership",
}
DATE_LINE = re.compile(
    r"^(?P<left>.*?)\s+(?P<date>(?:[A-Z][a-z]{2,8}\.?\s+)?\d{4}\s*[–—-]\s*(?:(?:[A-Z][a-z]{2,8}\.?\s+)?\d{4}|Present|Current))\s*$"
)
BULLET = ("•", "▪", "- ", "● ")
_fonts_ready = False
_missing_glyphs: dict[str, set[int]] = {}


def _register_fonts() -> bool:
    global _fonts_ready
    if _fonts_ready:
        return True
    try:
        for name, file in ((REGULAR, "cmunrm.ttf"), (BOLD, "cmunbx.ttf"), (ITALIC, "cmunti.ttf")):
            pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
        pdfmetrics.registerFont(TTFont(ICONS_BRANDS, str(FONT_DIR / "fa-brands.ttf")))
        pdfmetrics.registerFont(TTFont(ICONS_SOLID, str(FONT_DIR / "fa-solid.ttf")))
        pdfmetrics.registerFontFamily(REGULAR, normal=REGULAR, bold=BOLD, italic=ITALIC, boldItalic=BOLD)
        _fonts_ready = True
    except Exception as error:  # a missing font file must not break the download
        print(f"[resume] Computer Modern fonts unavailable: {error}")
    return _fonts_ready


def _clean(text: str) -> str:
    """Replace characters the font may not have with close ones."""
    return (
        re.sub(r"[ \t]+,", ",", text).replace("∼", "~").replace("⁠", "").replace(" ", " ")
        .replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    )


def _is_bullet(line: str) -> bool:
    return line.startswith(BULLET)


def _strip_bullet(line: str) -> str:
    return re.sub(r"^(?:[•▪●]|-)\s*", "", line).strip()


def _split_org(line: str) -> tuple[str, str]:
    match = re.match(r"^(.*\S)\s+(\S+)\s*,\s*(.+)$", line)
    if match:
        return match.group(1).strip(), f"{match.group(2)}, {match.group(3).strip()}"
    return line.strip(), ""


PLACE_ONLY = re.compile(r"^[A-Z][A-Za-z. ]+,\s*[A-Z][A-Za-z. ]+$")
DATE_ONLY = re.compile(r"^(?:[A-Z][a-z]{2,8}\.?\s+)?\d{4}\s*[–—-]\s*(?:(?:[A-Z][a-z]{2,8}\.?\s+)?\d{4}|Present|Current)$")


def _merge_split_rows(raw: list[str]) -> list[str]:
    """A PDF made by this module reads back as "org", "place", "role", "date" on four lines; join them in pairs."""
    out: list[str] = []
    i = 0
    while i < len(raw):
        if (
            i + 3 < len(raw)
            and not _is_bullet(raw[i])
            and PLACE_ONLY.match(raw[i + 1])
            and DATE_ONLY.match(raw[i + 3])
        ):
            out.append(f"{raw[i]} {raw[i + 1]}")
            out.append(f"{raw[i + 2]} {raw[i + 3]}")
            i += 4
        else:
            out.append(raw[i])
            i += 1
    return out


def parse_resume_text(text: str) -> dict | None:
    lines = [_clean(line).strip() for line in text.replace("\r", "").split("\n")]
    lines = [line for line in lines if line]
    header: list[str] = []
    body: dict[str, list[str]] = {}
    section = ""
    for line in lines:
        key = SECTIONS.get(re.sub(r"\s+", " ", line.lower().rstrip(":")))
        if key:
            section = key
            body.setdefault(section, [])
        elif section:
            body[section].append(line)
        else:
            header.append(line)
    if not header or not body.get("experience"):
        return None

    def entries(raw: list[str]) -> list[dict]:
        raw = _merge_split_rows(raw)
        result: list[dict] = []
        current: dict | None = None
        bullet_open = False
        for index, line in enumerate(raw):
            following = raw[index + 1] if index + 1 < len(raw) else ""
            if _is_bullet(line):
                if current is None:
                    return []
                current["bullets"].append(_strip_bullet(line))
                bullet_open = True
            elif DATE_LINE.match(line) and current is not None and not current["role"]:
                match = DATE_LINE.match(line)
                current["role"], current["date"] = match.group("left").strip(), match.group("date").strip()
                bullet_open = False
            elif DATE_LINE.match(following) and not _is_bullet(following):
                org, place = _split_org(line)
                current = {"org": org, "place": place, "role": "", "date": "", "bullets": []}
                result.append(current)
                bullet_open = False
            elif bullet_open and current and current["bullets"]:
                current["bullets"][-1] += " " + line
        return result

    def projects(raw: list[str]) -> list[dict]:
        result: list[dict] = []
        for line in raw:
            if _is_bullet(line):
                if result:
                    result[-1]["bullets"].append(_strip_bullet(line))
            elif result and not result[-1]["bullets"] and re.fullmatch(r"(Live Demo|Live App|Chrome Web Store|Demo|Live)", line):
                result[-1]["link"] = line
            elif result and not result[-1]["bullets"] and " | " not in line and not result[-1]["link"]:
                result[-1]["tech"] = f"{result[-1]['tech']} {line}".strip()
            elif " | " in line or (result and not result[-1]["bullets"]):
                link = re.search(r"\s+(Live Demo|Live App|Demo|Live)\s*$", line)
                label = link.group(1) if link else ""
                head = line[: link.start()] if link else line
                title, _, tech = head.partition(" | ")
                result.append({"title": title.strip(), "tech": tech.strip(), "link": label, "bullets": []})
            elif result and result[-1]["bullets"]:
                result[-1]["bullets"][-1] += " " + line
        return result

    def labelled(raw: list[str]) -> list[tuple[str, str]]:
        result: list[tuple[str, str]] = []
        for line in raw:
            match = re.match(r"^([A-Z][^:—–|]{1,30}?)\s*:\s*(.*)$", line)
            if match:
                result.append((match.group(1).strip(), match.group(2).strip()))
            elif result:
                result[-1] = (result[-1][0], f"{result[-1][1]} {line}".strip())
        return result

    parsed = {
        "header": header,
        "summary": " ".join(body.get("summary", [])),
        "experience": entries(body["experience"]),
        "projects": projects(body.get("projects", [])),
        "education": entries(body.get("education", [])),
        "skills": labelled(body.get("skills", [])),
        "extra": labelled(body.get("extra", [])),
    }
    if not parsed["experience"] or not any(job["bullets"] for job in parsed["experience"]):
        return None
    return parsed



def _with_tilde(text: str) -> str:
    """Computer Modern's "~" sits high above the digit that follows it, so it is lowered to the middle of the line."""
    return text.replace("~", '<font name="Helvetica">~</font>')


def _bold_label(item: str) -> str:
    label, sep, rest = item.partition(": ")
    if sep and len(label) <= 45 and "." not in label:
        return f"<b>{escape(label)}:</b> {escape(rest)}"
    return escape(item)


# Plainer wording for the same facts, applied to the Drive text before it is laid out.
REWRITES = (
    ('request management service', 'Request Management Service: Built a multi-agent platform on LangGraph for 5–7 enterprise applications, with a reflection agent that checks each output.'),
    ('automated application onboarding', 'Automated Application Onboarding: Wrote onboarding logic that turns agent outputs into runnable SQL, so setting up a new application takes less work.'),
    ('human-in-the-loop', 'Human-in-the-Loop (HITL) Governance: Added a Microsoft Teams approval step so reviewers see AI-generated responses before anything runs. Supported the live production deployment.'),
    ('provisioning accelerator', 'Provisioning Accelerator: Set up sign-in with Microsoft Entra ID and the Graph API, and handled file processing for the provisioning pipeline.'),
    ('vibe testing', 'Vibe Testing / NavLearn: Used GitHub Copilot to turn BDD specs into runnable test scripts and built a skill-file agent on navigation and action registries. Manual test writing dropped by 30–40%.'),
    ('agrimentor', 'AgriMentor: Built an agricultural assistant on FastAPI that takes soil-test inputs as PDF, image or text and gives crop and soil recommendations.'),
    ('investment delivery services', 'Investment Delivery Services: Checked ETL data between on-premises and cloud with Informatica and SQL Server, automated regression tests in Selenium, and tracked defects in Jira.'),
    ('eagle version release', 'Eagle Version Release: Ran functional and regression tests against the business requirements to confirm each release was ready.'),
    ('architected a dual-mode', 'Built a voice and text AI portfolio assistant with React, FastAPI and WebSockets, using browser speech recognition and Edge-TTS for spoken replies.'),
    ('engineered a resilient', 'Added automatic failover across Groq, Gemini, NVIDIA and OpenRouter, with Langfuse for tracing.'),
    ('built an automated google drive', 'Wrote a pipeline that pulls the resume from Google Drive and exports recruiter-tailored PDFs with ReportLab.'),
    ('developed a zero-server', 'Built a PWA with React, WebRTC and WebSockets that sends files and syncs media directly between browsers, with no server storage.'),
    ('deployed serverless signaling', 'Ran signaling and room state on Cloudflare Workers and Durable Objects, and checked file integrity with SHA-256 in the browser.'),
)
NACHITRAM_TEXT = "Built a free Chrome extension for teachers and creators that records screen and webcam with a live whiteboard and a private teleprompter. Long recordings are saved to local storage in chunks, with no account or cloud upload."
SUMMARY_TEXT = "AI Engineer with about 2 years of experience building LLM agents, RAG workflows and FastAPI backends. Built enterprise multi-agent workflows with LangGraph and Azure OpenAI that cut manual review effort by up to 50% and hallucinations by 30%. Also build full-stack AI and real-time web apps."


def _rewrite(data: dict) -> dict:
    """The same facts in plainer words. Unknown bullets are left exactly as they are in the resume."""
    from copy import deepcopy

    out = deepcopy(data)

    def reword(bullets: list[str]) -> list[str]:
        result = []
        for text in bullets:
            lowered = text.lower()
            result.append(next((new for key, new in REWRITES if lowered.startswith(key)), text))
        return result

    if out["summary"].lower().startswith("results-driven"):
        out["summary"] = SUMMARY_TEXT
    for job in out["experience"]:
        job["bullets"] = reword(job["bullets"])
    for project in out["projects"]:
        project["title"] = project["title"].replace(" — ", ": ")
        project["bullets"] = [NACHITRAM_TEXT] if "nachitram" in project["title"].lower() else reword(project["bullets"])
    out["extra"] = [(label, value.replace(" — ", ", ")) for label, value in out["extra"]]
    return out


def _focus_terms(focus: str) -> set[str]:
    skip = {"about", "akash", "and", "for", "from", "how", "his", "the", "what", "with"}
    return {t for t in re.findall(r"[\w+#.-]+", focus.lower()) if len(t) > 2 and t not in skip}


def _score(text: str, terms: set[str]) -> int:
    lowered = text.lower()
    return sum(term in lowered for term in terms)


def _small_caps(text: str, size: float) -> str:
    out = []
    for word in text.split(" "):
        if not word:
            continue
        out.append(f"{escape(word[0].upper())}<font size='{size * 0.8:.1f}'>{escape(word[1:].upper())}</font>")
    return " ".join(out)


def _trusted(url: str, domain: str, default: str) -> str:
    from urllib.parse import urlsplit

    parsed = urlsplit((url or "").strip())
    host = (parsed.hostname or "").lower()
    if parsed.scheme == "https" and (host == domain or host.endswith("." + domain)):
        return url.strip()
    return default


def _short(url: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", url).rstrip("/")


def build_jake_pdf(text: str, focus: str = "", linkedin_url: str = "", github_url: str = "") -> bytes | None:
    """Jake's layout, shrunk a little at a time until the resume fits on one page."""
    if not _register_fonts():
        return None
    data = parse_resume_text(text)
    if not data:
        return None
    if not any("nachitram" in p["title"].lower() for p in data["projects"]):
        data["projects"].append(dict(NACHITRAM, bullets=list(NACHITRAM["bullets"])))
    from pypdf import PdfReader

    data = _rewrite(data)
    # One page while the type stays readable, otherwise two pages at Jake's own size.
    for scale in (1.0, 0.98, 0.96, 0.94, 0.92):
        result = _render(data, focus, linkedin_url, github_url, scale)
        if len(PdfReader(BytesIO(result)).pages) == 1:
            return result
    return _render(data, focus, linkedin_url, github_url, 1.08)


def _render(data: dict, focus: str, linkedin_url: str, github_url: str, scale: float) -> bytes:
    def PS(name, parent=None, **kw):
        for key in ("fontSize", "leading", "spaceBefore", "spaceAfter", "leftIndent", "firstLineIndent"):
            if key in kw:
                kw[key] = kw[key] * scale
        return ParagraphStyle(name, parent=parent, **kw)

    terms = _focus_terms(focus)
    for job in data["experience"]:
        job["bullets"].sort(key=lambda b: _score(b, terms), reverse=True)
    data["experience"].sort(key=lambda j: _score(" ".join(j["bullets"]), terms), reverse=True) if terms else None
    data["projects"].sort(key=lambda p: _score(p["title"] + p["tech"] + " ".join(p["bullets"]), terms), reverse=True)

    body = PS("body", fontName=REGULAR, fontSize=10, leading=10.9, textColor=colors.black)
    bullet = PS("bullet", parent=body, leftIndent=0.3 * inch, firstLineIndent=-0.12 * inch, spaceAfter=1)
    name_style = PS("name", parent=body, fontName=BOLD, fontSize=24, leading=26, alignment=TA_CENTER)
    contact = PS("contact", parent=body, alignment=TA_CENTER, fontSize=10, leading=12)
    head = PS("head", parent=body, fontSize=12, leading=14, spaceBefore=3)
    left_bold = PS("lb", parent=body, fontName=BOLD, fontSize=11, leading=13)
    left_small = PS("ls", parent=body, fontName=ITALIC, fontSize=9.5, leading=11)
    right = PS("r", parent=body, alignment=TA_RIGHT, fontSize=11, leading=13)
    right_small = PS("rs", parent=left_small, alignment=TA_RIGHT)

    width = LETTER[0] - 0.9 * inch
    link_color = "black"
    linkedin = _trusted(linkedin_url, "linkedin.com", DEFAULT_LINKEDIN)
    github = _trusted(github_url, "github.com", DEFAULT_GITHUB)

    def two_cols(left_cells, right_cells) -> Table:
        table = Table([[left_cells, right_cells]], colWidths=[width * 0.72, width * 0.28])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        return table

    def section(name: str) -> list:
        return [
            Paragraph(_small_caps(TITLES[name], 12 * scale), head),
            HRFlowable(width="100%", thickness=0.5, color=colors.black, spaceBefore=0, spaceAfter=2.5),
        ]

    def bullets(items: list[str]) -> list:
        return [Paragraph(f"•&nbsp;&nbsp;{_bold_label(item)}", bullet) for item in items]

    story: list = []
    story.append(Paragraph(_small_caps(data["header"][0], 24 * scale), name_style))
    first = [p.strip() for p in (data["header"][1] if len(data["header"]) > 1 else "").split("|") if p.strip()]
    parts = []
    for piece in first:
        if "@" in piece:
            parts.append(f'<link href="mailto:{escape(piece)}"><u>{escape(piece)}</u></link>')
        else:
            parts.append(escape(piece))
    if parts:
        story.append(Paragraph(" | ".join(parts), contact))
    def icon_link(font: str, glyph: str, label: str, url: str) -> str:
        return (
            f'<link href="{escape(url)}"><font name="{font}" size="{9.5 * scale:.1f}">{glyph}</font>'
            f'&nbsp;<u>{escape(label)}</u></link>'
        )

    story.append(Paragraph(
        "&nbsp;&nbsp;|&nbsp;&nbsp;".join([
            icon_link(ICONS_BRANDS, "&#xf09b;", "GitHub", github),
            icon_link(ICONS_BRANDS, "&#xf08c;", "LinkedIn", linkedin),
            icon_link(ICONS_SOLID, "&#xf544;", "Chikki", SITE),
        ]),
        contact,
    ))

    for name in ORDER:
        content = data.get(name)
        if not content:
            continue
        story.extend(section(name))
        if name == "summary":
            story.append(Paragraph(escape(content), body))
        elif name in ("experience", "education"):
            for job in content:
                block = [
                    Spacer(1, 1),
                    two_cols(Paragraph(escape(job["org"]), left_bold), Paragraph(escape(job["place"]), right)),
                    two_cols(Paragraph(escape(job["role"]), left_small), Paragraph(escape(job["date"]), right_small)),
                    Spacer(1, 1),
                ]
                items = bullets(job["bullets"])
                story.append(KeepTogether(block + items[:1]))
                story.extend(items[1:])
        elif name == "projects":
            for project in content:
                title = f"<b>{escape(project['title'])}</b>"
                if project["tech"]:
                    title += f" | <i>{escape(project['tech'])}</i>"
                url = project.get("url") or next((u for key, u in APP_LINKS.items() if key in project["title"].lower()), SITE)
                label = f'<link href="{url}"><u>{escape(project["link"])}</u></link>' if project["link"] else ""
                block = [
                    Spacer(1, 1),
                    two_cols(Paragraph(title, PS("pt", parent=body, fontSize=9.5, leading=11.5)),
                             Paragraph(label, PS("pl", parent=right, fontSize=9.5, leading=11.5))),
                    Spacer(1, 1),
                ]
                items = bullets(project["bullets"])
                story.append(KeepTogether(block + items))
        else:  # skills, certifications & leadership
            for label, value in content:
                story.append(Paragraph(f"<b>{escape(label)}</b>: {escape(value)}", PS(
                    "lab", parent=body, leftIndent=0.15 * inch, spaceAfter=1.5)))

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer, pagesize=LETTER, leftMargin=0.45 * inch, rightMargin=0.45 * inch,
        topMargin=0.32 * inch, bottomMargin=0.3 * inch,
        title="Akash Bhalshankar Resume", author="Akash Bhalshankar",
    ).build(story)
    return buffer.getvalue()
