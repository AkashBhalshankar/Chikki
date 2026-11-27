import pytest
from fastapi.testclient import TestClient

import analytics_store as analytics
import main


def test_summary_aggregates_turns(feedback_db):
    analytics.record_event("turn", "What is LangGraph?", "en-IN", "text", "groq", 800, 300, True, None, 2)
    analytics.record_event("turn", "what is langgraph", "en-IN", "voice", "gemini", 1200, 400, True, None, 2)
    analytics.record_event("turn", "Does he know Kubernetes?", "hi-IN", "text", "groq", 600, 200, True, None, 0)
    analytics.record_event("turn", "Tell me a joke", "en-IN", "text", "groq", 500, 150, True, None, 0, True)
    analytics.record_event("turn", "hello", "en-IN", "text", None, 9000, None, False, "timeout", 0)
    analytics.record_event("resume_download", "rag")

    data = analytics.summary(days=7)
    assert data["totals"] == {"turns": 5, "failed_turns": 1, "resume_downloads": 1, "jd_matches": 0, "contact_messages": 0, "jokes": 1, "blocked_claims": 0}
    assert data["top_questions"][0] == {"question": "what is langgraph", "count": 2}
    assert data["languages"] == {"en-IN": 4, "hi-IN": 1}
    assert data["modes"] == {"text": 4, "voice": 1}
    assert data["providers"] == {"groq": 3, "gemini": 1}
    assert data["failures"] == {"timeout": 1}
    assert data["knowledge_gaps"][0]["question"] == "does he know kubernetes"
    assert data["latency_ms"]["p50"] in {800, 1200}
    assert len(data["daily"]) == 7 and data["daily"][-1]["turns"] == 5
    assert any(t["topic"] == "langgraph" for t in data["top_topics"])


def test_summary_empty(feedback_db):
    data = analytics.summary(days=3)
    assert data["totals"]["turns"] == 0 and data["latency_ms"]["avg"] is None


def test_summary_endpoint_requires_admin(feedback_db, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "tok")
    client = TestClient(main.app)
    assert client.get("/analytics/summary").status_code == 401
    ok = client.get("/analytics/summary?days=7", headers={"X-Admin-Token": "tok"})
    assert ok.status_code == 200 and ok.json()["days"] == 7
