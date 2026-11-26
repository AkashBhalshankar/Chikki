from datetime import date

from resume import calculate_live_experience
from tts import clean_for_speech, detect_language


def test_clean_for_speech_strips_markdown_and_urls():
    text = "**Akash** built `Chikki` — see https://example.com\n- FastAPI\n# Heading"
    cleaned = clean_for_speech(text, "en-IN")
    assert "*" not in cleaned and "`" not in cleaned and "#" not in cleaned
    assert "https" not in cleaned
    assert "Akash built Chikki" in cleaned


def test_clean_for_speech_expands_experience_decimals():
    assert "one point five years" in clean_for_speech("He has 1.5 years of experience", "en-IN")


def test_detect_language():
    assert detect_language("నమస్కారం") == "te"
    assert detect_language("नमस्ते") == "hi"
    assert detect_language("Hello there") == "en"


def test_calculate_live_experience_uses_earliest_role_and_current_marker():
    resume_text = (
        "Experience\n"
        "AI Engineer | Acme | Jan 2025 - Present\n"
        "Intern | Beta | Jul 2024 - Dec 2024\n"
        "Education\n"
        "B.Tech | Some College | Jun 2020 - May 2024\n"
    )
    years, current = calculate_live_experience(resume_text, today=date(2026, 1, 1))
    assert years == "approximately 1.5 years"
    assert current == ["AI Engineer at Acme"]


def test_calculate_live_experience_without_dates():
    assert calculate_live_experience("No dated roles here") == (None, [])
