from io import BytesIO

from pypdf import PdfReader

import jake_resume

SAMPLE = """Akash Bhalshankar
Hyderabad, India | +91 90000 00000 | a@example.com
LinkedIn | GitHub | example .com
Summary
Engineer with ∼2 years of experience.
Technical Skills
AI/LLM: LangChain , RAG
Professional Experience
UBS Hyderabad, India
AI Engineer Oct 2025 – Oct 2026
• Platform: Built a multi-agent platform
for enterprise applications.
Projects
Chikki — Voice Assistant | React, FastAPI Live Demo
• Built a voice assistant.
Education
KITS Karimnagar , Telangana
B.Tech (Aggregate: 75%) Sep 2020 – Jun 2024
"""


def test_parses_sections():
    data = jake_resume.parse_resume_text(SAMPLE)
    job = data["experience"][0]
    assert (job["org"], job["place"], job["role"]) == ("UBS", "Hyderabad, India", "AI Engineer")
    assert job["bullets"] == ["Platform: Built a multi-agent platform for enterprise applications."]
    assert data["projects"][0]["link"] == "Live Demo"
    assert data["skills"] == [("AI/LLM", "LangChain, RAG")]


def test_builds_one_page_pdf_with_text():
    pdf = jake_resume.build_jake_pdf(SAMPLE)
    reader = PdfReader(BytesIO(pdf))
    assert len(reader.pages) == 1
    assert "multi-agent platform" in reader.pages[0].extract_text()


def test_unreadable_text_returns_none():
    assert jake_resume.build_jake_pdf("just some words") is None


def test_a_pdf_it_made_reads_back_the_same():
    """Akash may save the downloaded PDF to Drive, so its own text must parse back to the same resume."""
    text = jake_resume.build_jake_pdf(SAMPLE)
    first = jake_resume.parse_resume_text(SAMPLE)
    reader = PdfReader(BytesIO(text))
    again = jake_resume.parse_resume_text("\n".join(page.extract_text() for page in reader.pages))
    assert again is not None
    job, original = again["experience"][0], first["experience"][0]
    assert (job["org"], job["place"], job["role"], job["date"]) == (original["org"], original["place"], original["role"], original["date"])
    assert len(job["bullets"]) == len(original["bullets"])
    assert again["projects"][0]["link"] == "Live Demo"
    assert again["education"][0]["org"] == "KITS"
