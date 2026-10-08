"""Convert the Chikki profile JSON into a recruiter-friendly PDF resume."""

from io import BytesIO
from copy import deepcopy
from pathlib import Path
import re
from xml.sax.saxutils import escape
from urllib.parse import urlsplit

from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.enums import TA_CENTER
from pypdf import PdfReader

from resume import load_resume


DEFAULT_RESUME_PATH = Path(__file__).parent / "resume.json"
DEFAULT_OUTPUT_PATH = Path(__file__).parent / "akash-bhalshankar-resume.pdf"
ACCENT = colors.HexColor("#174A63")
ACCENT_RULE = colors.HexColor("#4D9A9A")
MUTED_TEXT = colors.HexColor("#52636E")


def _trusted_profile_url(url: str, allowed_domain: str) -> str:
    parsed = urlsplit((url or "").strip())
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (host == allowed_domain or host.endswith(f".{allowed_domain}")):
        return ""
    return url.strip()
SECTION_HEADINGS = {
    "summary", "experience", "projects", "personal_projects", "skills", "certifications",
    "education", "leadership",
}
SECTION_ALIASES = {
    "professional experience": "experience",
    "work experience": "experience",
    "technical skills": "skills",
    "core skills": "skills",
    "professional summary": "summary",
    "personal projects": "personal_projects",
}


def _bundled_personal_projects() -> str:
    return "\n".join([
        "Chikki",
        "- Built a voice-first AI career assistant with React, Vite, Tailwind, Framer Motion, Python, FastAPI, WebSockets, browser speech recognition, Edge-TTS, and configurable Groq, Gemini, NVIDIA, and OpenRouter providers.",
        "- Engineered for change and failure with provider fallback, reconnect-safe conversation history, multilingual voice and text, synchronized captions, and Langfuse observability.",
        "- Fetches the current Google Drive PDF or Doc, parses it with pypdf, and uses recent recruiter questions to reorder verified content into a searchable ATS resume with ReportLab.",
    ])


def _exclude_existing_projects(projects: str, existing_text: str) -> str:
    lines = [line.strip() for line in projects.splitlines() if line.strip()]
    blocks = []
    current = []
    for line in lines:
        is_title = len(line.split()) <= 6 and not re.search(r"[.!?;,:]", line)
        if is_title and current:
            blocks.append(current)
            current = []
        current.append(line)
    if current:
        blocks.append(current)

    existing_lower = existing_text.lower()
    unique_blocks = [
        block for block in blocks
        if block[0].lower() not in existing_lower
    ]
    return "\n".join("\n".join(block) for block in unique_blocks)


def _resume_source_text() -> str:
    try:
        import resume_loader

        live_text = resume_loader.get_current_resume_text()
        if live_text and len(live_text.strip()) > 100:
            has_projects_section = re.search(
                r"(?im)^\s*(?:personal\s+)?projects\s*:?[ \t]*$",
                live_text,
            )
            if not has_projects_section:
                personal_projects = _exclude_existing_projects(
                    _bundled_personal_projects(),
                    live_text,
                )
                if personal_projects:
                    return f"{live_text.strip()}\n\nPersonal Projects\n{personal_projects}"
            return live_text.strip()
    except Exception as error:
        print(f"[resume] Live resume source unavailable: {error}")

    if DEFAULT_OUTPUT_PATH.exists():
        reader = PdfReader(str(DEFAULT_OUTPUT_PATH))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if len(text) > 100:
            return re.sub(r"(?im)^Projects\s*$", "Personal Projects", text, count=1)

    raise FileNotFoundError("No readable resume source is available")


def _focus_score(text: str, focus_terms: set[str]) -> int:
    lowered = text.lower()
    return sum(term in lowered for term in focus_terms)


def _source_resume_sections(text: str, focus: str) -> tuple[list[str], dict[str, list[str]]]:
    focus_terms = {
        term for term in re.findall(r"[\w+#.-]+", focus.lower())
        if len(term) > 2 and term not in {
            "about", "akash", "and", "for", "from", "how", "his", "the", "what", "with",
        }
    }
    lines = [line.strip() for line in text.replace("\r", "").split("\n")]
    header = []
    sections: dict[str, list[str]] = {}
    section = ""
    current_item = ""

    def flush_item() -> None:
        nonlocal current_item
        if current_item and section:
            sections.setdefault(section, []).append(current_item.strip())
        current_item = ""

    for line in lines:
        if not line:
            continue
        heading = re.sub(r"\s+", " ", line.lower().rstrip(":"))
        normalized_heading = SECTION_ALIASES.get(heading, heading)
        if normalized_heading in SECTION_HEADINGS:
            flush_item()
            section = normalized_heading
            sections.setdefault(section, [])
            continue
        if not section:
            header.append(line)
            continue

        if section == "experience":
            is_role = "|" in line and re.search(r"\b(19|20)\d{2}\b|present|current", line, re.I)
            is_project = re.match(r"^(?:bootcamp\s+)?project\s*\w*\s*:", line, re.I)
            is_bullet = line.startswith(("- ", "• ", "▪ "))
            if is_bullet or is_role or is_project:
                flush_item()
                current_item = line[2:].strip() if is_bullet else line
            elif current_item:
                current_item += " " + line
            else:
                current_item = line
        elif section in {"projects", "personal_projects"}:
            if section == "personal_projects" and line.startswith(("- ", "• ", "▪ ")):
                flush_item()
                current_item = line[2:].strip()
                continue
            title_like = (
                len(line.split()) <= 6
                and not re.search(r"[.!?;,:]", line)
                and not line.startswith("- ")
            )
            if title_like:
                flush_item()
                current_item = line
            elif current_item:
                current_item += " " + line
            else:
                current_item = line
        elif section == "skills":
            flush_item()
            current_item = line.split(":", 1)[-1].strip()
        elif section == "education":
            flush_item()
            current_item = line.removeprefix("• ").removeprefix("- ").strip()
        elif line.startswith(("- ", "• ", "▪ ")):
            flush_item()
            current_item = line[2:].strip()
        elif current_item:
            current_item += " " + line
        else:
            current_item = line
    flush_item()

    for name in ("experience", "projects", "personal_projects"):
        items = sections.get(name, [])
        if name == "experience":
            groups = []
            for item in items:
                if "|" in item and re.search(r"\b(19|20)\d{2}\b|present|current", item, re.I):
                    groups.append({"heading": item, "items": []})
                elif groups:
                    groups[-1]["items"].append(item)
                else:
                    groups.append({"heading": "", "items": [item]})
            for group in groups:
                items_in_group = group["items"]
                project_groups = []
                other_items = []
                for item in items_in_group:
                    if re.match(r"^(?:bootcamp\s+)?project\s*\w*\s*:", item, re.I):
                        project_groups.append([item])
                    elif project_groups:
                        project_groups[-1].append(item)
                    else:
                        other_items.append(item)
                other_items.sort(key=lambda item: _focus_score(item, focus_terms), reverse=True)
                project_groups.sort(
                    key=lambda project: _focus_score(" ".join(project), focus_terms),
                    reverse=True,
                )
                group["items"] = other_items + [item for project in project_groups for item in project]
            groups.sort(
                key=lambda group: _focus_score(group["heading"] + " " + " ".join(group["items"]), focus_terms),
                reverse=True,
            )
            sections[name] = groups
        elif name == "personal_projects":
            sections[name] = items
        else:
            sections[name] = sorted(
                items,
                key=lambda item: _focus_score(item, focus_terms),
                reverse=True,
            )

    if sections.get("skills"):
        skills = [skill.strip() for skill in ",".join(sections["skills"]).split(",") if skill.strip()]
        sections["skills"] = sorted(skills, key=lambda item: _focus_score(item, focus_terms), reverse=True)
    return header, sections


def _build_ats_pdf_from_text(
    text: str,
    focus: str = "",
    linkedin_url: str = "",
    github_url: str = "",
) -> bytes:
    header, sections = _source_resume_sections(text, focus)
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title="Akash Bhalshankar Resume",
        author="Akash Bhalshankar",
    )
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle(
        "ATSName", parent=styles["Heading1"], fontName="Helvetica-Bold",
        textColor=ACCENT, fontSize=18, leading=21, alignment=TA_CENTER, spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "ATSBody", parent=styles["BodyText"], fontName="Helvetica",
        textColor=colors.HexColor("#26343D"), fontSize=9, leading=11.7, spaceAfter=3,
    )
    contact_style = ParagraphStyle(
        "ATSContact", parent=body_style, textColor=MUTED_TEXT,
        fontSize=8.7, leading=11, alignment=TA_CENTER, spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "ATSSection", parent=styles["Heading2"], fontName="Helvetica-Bold",
        textColor=ACCENT, fontSize=10.5, leading=13, spaceBefore=8, spaceAfter=2,
    )
    role_style = ParagraphStyle(
        "ATSRole", parent=body_style, fontName="Helvetica",
        fontSize=9.2, leading=12, spaceBefore=5, spaceAfter=3,
    )
    bullet_style = ParagraphStyle(
        "ATSExperienceBullet", parent=body_style,
        leftIndent=12, firstLineIndent=-8, spaceAfter=2,
    )
    project_title_style = ParagraphStyle(
        "ATSProjectTitle", parent=body_style, fontName="Helvetica-Bold",
        textColor=ACCENT, fontSize=10, leading=12, spaceAfter=3,
    )
    story = []
    if header:
        story.append(Paragraph(escape(header[0]), name_style))
        for line in header[1:]:
            line = re.sub(r"\s*\|\s*LinkedIn\s*\|\s*GitHub\s*$", "", line, flags=re.IGNORECASE)
            story.append(Paragraph(escape(line), contact_style))
        profile_links = []
        safe_linkedin = _trusted_profile_url(linkedin_url, "linkedin.com")
        safe_github = _trusted_profile_url(github_url, "github.com")
        if safe_linkedin:
            profile_links.append(f'<link href="{escape(safe_linkedin)}"><u>LinkedIn</u></link>')
        if safe_github:
            profile_links.append(f'<link href="{escape(safe_github)}"><u>GitHub</u></link>')
        if profile_links:
            story.append(Paragraph(" | ".join(profile_links), contact_style))
        story.append(HRFlowable(width="100%", thickness=1.4, color=ACCENT_RULE, spaceBefore=4, spaceAfter=3))

    section_titles = {"personal_projects": "Personal Projects"}
    for name in ("summary", "experience", "projects", "personal_projects", "skills", "certifications", "education", "leadership"):
        items = sections.get(name, [])
        if not items:
            continue
        section_heading = Paragraph(section_titles.get(name, name.title()), section_style)
        section_rule = HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)
        if name == "personal_projects":
            project_story = [section_heading, section_rule]
            for index, item in enumerate(items):
                text_item = item if index == 0 else f"- {item}"
                style = project_title_style if index == 0 else body_style
                project_story.append(Paragraph(escape(text_item), style))
            story.append(KeepTogether(project_story))
            continue

        story.extend([section_heading, section_rule])
        if name == "experience":
            for group in items:
                heading_parts = group["heading"].split("|", 1)
                role_name = heading_parts[0].strip()
                company_and_dates = heading_parts[1].strip() if len(heading_parts) > 1 else ""
                date_match = re.search(
                    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
                    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
                    r"\s+\d{4}.*$",
                    company_and_dates,
                    re.IGNORECASE,
                )
                if date_match:
                    company_name = company_and_dates[:date_match.start()].strip()
                    date_label = company_and_dates[date_match.start():].strip()
                else:
                    company_name = company_and_dates
                    date_label = ""
                role_line = f"<b>{escape(role_name)}</b>"
                if company_name:
                    role_line += f" | <b>{escape(company_name)}</b>"
                if date_label:
                    role_line += f" {escape(date_label)}"
                story.append(Paragraph(role_line, role_style))

                for item in group["items"]:
                    project_match = re.match(
                        r"^(?:(?:Bootcamp\s+)?Project(?:\s+\w+)?\s*:\s*)(.+)$",
                        item,
                        re.IGNORECASE,
                    )
                    if project_match:
                        story.append(Paragraph(
                            f"<b>{escape(project_match.group(1).strip())}</b>",
                            project_title_style,
                        ))
                    else:
                        story.append(Paragraph(f"- {escape(item)}", bullet_style))
            continue

        for index, item in enumerate(items):
            if name == "experience" and "|" not in item and index > 0:
                text_item = f"- {item}"
            elif name in {"education", "leadership"}:
                text_item = f"- {item}"
            elif name == "skills":
                text_item = ", ".join(items)
                if index:
                    continue
            else:
                text_item = item
            story.append(Paragraph(escape(text_item), body_style))

    if not story:
        raise ValueError("Resume source did not contain readable content")
    document.build(story)
    return buffer.getvalue()


def tailor_resume(profile: dict, focus: str = "") -> dict:
    """Reorder verified profile content around a user's topic; never invents facts."""
    if not focus.strip():
        return profile

    ignored_terms = {
        "a", "about", "akasha", "and", "can", "explain", "for", "how",
        "i", "me", "my", "of", "please", "show", "tell", "the", "to",
        "what", "why", "with", "you",
    }
    terms = {
        term for term in focus.lower().replace("/", " ").replace(",", " ").split()
        if term not in ignored_terms and len(term) > 2
    }

    def score(text: str) -> int:
        words = set(text.lower().replace("/", " ").replace("-", " ").split())
        return sum(term in words or term in text.lower() for term in terms)

    tailored = deepcopy(profile)
    tailored["experience"] = sorted(
        tailored.get("experience", []),
        key=lambda item: score(" ".join(item.get("highlights", []))),
        reverse=True,
    )
    for item in tailored["experience"]:
        item["highlights"] = sorted(item.get("highlights", []), key=score, reverse=True)
    tailored["projects"] = sorted(
        tailored.get("projects", []),
        key=lambda item: score(f"{item.get('name', '')} {item.get('description', '')}"),
        reverse=True,
    )
    tailored["skills"] = dict(sorted(
        tailored.get("skills", {}).items(),
        key=lambda group: score(" ".join(group[1])),
        reverse=True,
    ))
    tailored["focus"] = focus.strip()
    return tailored


def build_resume_pdf(
    resume_path: Path = DEFAULT_RESUME_PATH,
    focus: str = "",
    linkedin_url: str = "",
    github_url: str = "",
) -> bytes:
    if not resume_path.exists():
        return _build_ats_pdf_from_text(_resume_source_text(), focus, linkedin_url, github_url)

    profile = load_resume(resume_path)
    profile = tailor_resume(profile, focus)

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=f"{profile.get('name', 'Akash Bhalshankar')} Resume",
        author=profile.get("name", "Akash Bhalshankar"),
    )
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle(
        "ResumeName",
        parent=styles["Title"],
        textColor=ACCENT,
        fontSize=16,
        leading=19,
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    contact_style = ParagraphStyle(
        "ResumeContact",
        parent=styles["Normal"],
        textColor=MUTED_TEXT,
        fontSize=9,
        leading=12,
        spaceAfter=2,
        alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "ResumeSection",
        parent=styles["Heading2"],
        textColor=ACCENT,
        fontSize=11,
        leading=14,
        spaceBefore=6,
        spaceAfter=4,
    )
    role_style = ParagraphStyle(
        "ResumeRole",
        parent=styles["Heading3"],
        textColor=ACCENT,
        fontSize=10,
        leading=13,
        spaceBefore=4,
        spaceAfter=2,
    )
    body_style = ParagraphStyle(
        "ResumeBody",
        parent=styles["BodyText"],
        fontSize=8.8,
        leading=11.5,
        textColor=colors.HexColor("#25313C"),
        spaceAfter=3,
    )
    bullet_style = ParagraphStyle(
        "ResumeBullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2,
    )
    education_style = ParagraphStyle(
        "ResumeEducation",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3,
    )
    phone = profile.get("phone", "")
    email = profile.get("email", "")
    contact_items = []
    if phone:
        contact_items.append(f'<link href="tel:{phone.replace(" ", "")}"><u>{escape(phone)}</u></link>')
    if email:
        contact_items.append(f'<link href="mailto:{escape(email)}"><u>{escape(email)}</u></link>')
    linkedin_url = linkedin_url or profile.get("linkedin_url", "")
    github_url = github_url or profile.get("github_url", "")
    safe_linkedin = _trusted_profile_url(linkedin_url, "linkedin.com")
    safe_github = _trusted_profile_url(github_url, "github.com")
    if safe_linkedin:
        contact_items.append(f'<link href="{escape(safe_linkedin)}"><u>LinkedIn</u></link>')
    if safe_github:
        contact_items.append(f'<link href="{escape(safe_github)}"><u>GitHub</u></link>')
    if profile.get("location"):
        contact_items.append(escape(profile["location"]))
    story = [
        Paragraph(escape(profile.get("name", "Akash Bhalshankar")), name_style),
        Paragraph(" | ".join(contact_items), contact_style),
        HRFlowable(width="100%", thickness=1.4, color=ACCENT_RULE, spaceBefore=5, spaceAfter=4),
        Paragraph("Summary", section_style),
        HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4),
        Paragraph(escape(profile.get("summary", "")), body_style),
    ]

    for section, heading in (("experience", "Experience"), ("projects", "Projects")):
        story.extend([Spacer(1, 5), Paragraph(heading, section_style), HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)])
        for item in profile.get(section, []):
            role = item.get("role") or item.get("name", "")
            repeated_designation = role == profile.get("title")
            title = item.get("company", "") if repeated_designation else role
            duration = item.get("duration", "").split("(", 1)[0].strip()
            details = " - ".join(filter(None, [
                None if repeated_designation else item.get("company"),
                duration,
                item.get("location"),
            ]))
            suffix = f" | {details}" if details else ""
            role_block = [Paragraph(f"<b>{escape(title)}</b>{escape(suffix)}", role_style)]
            if item.get("description"):
                role_block.append(Paragraph(escape(item["description"]), body_style))
            for highlight in item.get("highlights", []):
                role_block.append(Paragraph(f"- {escape(highlight)}", bullet_style))
            story.append(KeepTogether(role_block))

    skills = profile.get("skills", {})
    story.extend([Spacer(1, 5), Paragraph("Skills", section_style), HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)])
    all_skills = [skill for group in skills.values() for skill in group]
    story.append(Paragraph(escape(" | ".join(all_skills)), body_style))
    story.extend([Spacer(1, 5), Paragraph("Certifications", section_style), HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)])
    story.append(Paragraph(escape(", ".join(profile.get("certifications", []))), styles["BodyText"]))
    story.extend([Spacer(1, 5), Paragraph("Education", section_style), HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)])
    for education in profile.get("education", []):
        story.append(Paragraph(f"- {escape(education)}", education_style))
    if profile.get("leadership"):
        story.extend([Spacer(1, 5), Paragraph("Leadership", section_style), HRFlowable(width="100%", thickness=0.7, color=ACCENT_RULE, spaceAfter=4)])
        story.append(Paragraph(f"- {escape(profile['leadership'])}", bullet_style))

    document.build(story)
    return buffer.getvalue()


def write_resume_pdf(
    resume_path: Path = DEFAULT_RESUME_PATH,
    output_path: Path = DEFAULT_OUTPUT_PATH,
) -> Path:
    output_path.write_bytes(build_resume_pdf(resume_path))
    return output_path


if __name__ == "__main__":
    write_resume_pdf()
