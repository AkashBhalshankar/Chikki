import pytest
from fastapi.testclient import TestClient

import main
import security
from actions import ActionTagFilter
from grounding import GroundingGuard, strip_markdown
from response_format import classify


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "test-token")
    monkeypatch.setattr(main, "feedback_limiter", security.RateLimiter(100, 60))
    monkeypatch.setattr(main.knowledge_base, "refresh", lambda: None)
    return TestClient(main.app)


ADMIN = {"X-Admin-Token": "test-token"}


def test_next_question_tag_is_hidden_and_collected():
    tag_filter = ActionTagFilter()
    chunks = ["He is an engineer at UBS. [[nex", "t:What did he build at UBS?|", "Which tools does he use?]]"]
    text = "".join(tag_filter.feed(c) for c in chunks) + tag_filter.finish()
    assert text == "He is an engineer at UBS. "
    assert tag_filter.suggestions == ["What did he build at UBS?", "Which tools does he use?"]


def test_unfinished_next_tag_never_leaks():
    tag_filter = ActionTagFilter()
    text = tag_filter.feed("Done. [[next:Half a question") + tag_filter.finish()
    assert text == "Done. "


def test_compare_questions_get_a_table_layout():
    assert classify("Compare his two internships") == "compare"
    assert classify("What is the difference between UBS and MassMutual work?") == "compare"
    assert classify("What are his skills?") == "list"


def test_table_formatting_does_not_trip_the_guard():
    guard = GroundingGuard("Akash worked at UBS using LangGraph and at MassMutual using Selenium.")
    table = "| Aspect | **UBS** | **MassMutual** |\n|---|---|---|\n| Tool | **LangGraph** | **Selenium** |\n"
    assert "---" not in strip_markdown(table)
    ok, bad = guard.check_sentence(table)
    assert ok, bad
    ok, bad = guard.check_sentence("| Tool | **Kubernetes** | **Selenium** |")
    assert not ok and "Kubernetes" in bad


def test_gaps_inbox_roundtrip(client, feedback_db):
    from analytics_store import record_event

    for _ in range(2):
        record_event("turn", "Does he know Rust?", "en-IN", "text", "groq", 100, 50, True, None, 0, False, 0, "AAAA")
    record_event("turn", "Tell me about UBS", "en-IN", "text", "groq", 100, 50, True, None, 3, False, 0, "AAAA")

    assert client.get("/gaps").status_code == 401
    data = client.get("/gaps", headers=ADMIN).json()
    assert [g["question"] for g in data["gaps"]] == ["Does he know Rust?"] and data["gaps"][0]["count"] == 2

    assert client.post("/gaps/answer", headers=ADMIN, json={"question": "Does he know Rust?", "answer": "He has not used Rust professionally."}).status_code == 200
    data = client.get("/gaps", headers=ADMIN).json()
    assert data["gaps"] == [] and len(data["notes"]) == 1

    note_id = data["notes"][0]["id"]
    assert client.delete(f"/gaps/notes/{note_id}", headers=ADMIN).status_code == 200
    assert client.delete(f"/gaps/notes/{note_id}", headers=ADMIN).status_code == 404


def test_owner_notes_become_knowledge(feedback_db):
    from owner_notes import add_note, notes_markdown

    assert notes_markdown() == ""
    add_note("Does he speak German?", "Akash speaks English, Hindi and Telugu.")
    text = notes_markdown()
    assert "Does he speak German?" in text and "English, Hindi and Telugu" in text


def test_engaged_visitors_counted_by_session(feedback_db):
    from analytics_store import record_event, summary

    for _ in range(3):
        record_event("turn", "q", "en-IN", "text", "groq", 1, 1, True, None, 1, False, 0, "S1")
    record_event("turn", "q", "en-IN", "text", "groq", 1, 1, True, None, 1, False, 0, "S2")
    assert summary(7)["visitors"] == {"sessions": 2, "engaged": 1}


def test_speed_adjusts_the_voice_rate():
    import tts

    assert tts._rate_string("+4%", 1.0) == "+4%"
    assert tts._rate_string("+4%", 1.15) == "+19%"
    assert tts._rate_string("-6%", 0.9) == "-16%"
    assert tts._rate_string("+0%", 5) == "+30%"


def test_pitch_endpoint_validates_and_uses_the_drafter(client, monkeypatch):
    monkeypatch.setattr(main, "match_limiter", security.RateLimiter(100, 60))
    monkeypatch.setattr(main, "draft_pitch", lambda jd: {"cover_note": "Hello team.", "talking_points": ["One"]})
    assert client.post("/match/pitch", json={"job_description": "short"}).status_code == 422
    response = client.post("/match/pitch", json={"job_description": "We need an AI engineer with LangGraph and FastAPI experience for agents."})
    assert response.json()["cover_note"] == "Hello team."


def test_digest_reports_engaged_visitors(feedback_db):
    import digest
    from analytics_store import record_event

    for _ in range(3):
        record_event("turn", "q", "en-IN", "text", "groq", 1, 1, True, None, 1, False, 0, "S1")
    record_event("turn", "q", "en-IN", "text", "groq", 1, 1, True, None, 1, False, 0, "S2")
    assert "Engaged visitors (3+ questions): 1 of 2" in digest.build_digest(7)


def test_excerpt_is_one_line_and_cut_at_a_word():
    from knowledge import _excerpt

    text = "## Heading\n" + "word " * 200
    out = _excerpt(text)
    assert "\n" not in out and out.endswith("...") and len(out) <= 330 and not out.startswith("#")
    assert _excerpt("Short note.") == "Short note."


def test_visits_feed_the_funnel(feedback_db, monkeypatch):
    from fastapi.testclient import TestClient
    import main
    import security
    from analytics_store import record_event, summary

    monkeypatch.setattr(main, "feedback_limiter", security.RateLimiter(100, 60))
    client = TestClient(main.app)
    assert client.post("/analytics/visit", json={"session_id": "abc"}).status_code == 200
    assert client.post("/analytics/visit", json={"session_id": "def"}).status_code == 200
    assert client.post("/analytics/visit", json={}).status_code == 200  # no session: nothing recorded
    record_event("turn", "q", "en-IN", "text", "groq", 1, 1, True, None, 1, False, 0, main.visitor_code("abc"))
    funnel = summary(7)["funnel"]
    assert funnel["visitors"] == 2 and funnel["asked"] == 1 and funnel["resume_downloads"] == 0
