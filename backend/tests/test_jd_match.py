import json

import pytest
from fastapi.testclient import TestClient

import jd_match
import main
import security

GOOD = {
    "fit_score": 150,
    "fit_summary": "Strong overlap on LLM apps.",
    "matching_skills": ["FastAPI", "LangGraph"],
    "gaps": ["Kubernetes"],
    "talking_points": ["Built Chikki"],
    "keywords": ["RAG", "FastAPI"],
}
JD = "We need an AI engineer with FastAPI, RAG and Kubernetes experience for LLM products. " * 2


def test_extract_json_handles_code_fences():
    assert jd_match._extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(ValueError):
        jd_match._extract_json("no json here")


def test_normalize_clamps_and_builds_focus():
    result = jd_match.normalize_result(GOOD)
    assert result["fit_score"] == 100
    assert "RAG" in result["resume_focus"] and "LangGraph" in result["resume_focus"]
    assert jd_match.normalize_result({"fit_score": "x"})["fit_score"] == 0


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setattr(main, "match_limiter", security.RateLimiter(100, 3600))
    monkeypatch.setattr(jd_match, "get_resume_context", lambda: "Resume: FastAPI, LangGraph")
    return TestClient(main.app)


def test_match_endpoint_success_and_validation(client, monkeypatch):
    monkeypatch.setattr(jd_match, "complete_text", lambda *a, **k: json.dumps(GOOD))
    ok = client.post("/match", json={"job_description": JD})
    assert ok.status_code == 200 and ok.json()["gaps"] == ["Kubernetes"]
    assert client.post("/match", json={"job_description": "short"}).status_code == 422


def test_match_bad_model_output_returns_502(client, monkeypatch):
    monkeypatch.setattr(jd_match, "complete_text", lambda *a, **k: "sorry, cannot")
    assert client.post("/match", json={"job_description": JD}).status_code == 502


def test_match_rate_limited(client, monkeypatch):
    monkeypatch.setattr(main, "match_limiter", security.RateLimiter(1, 3600))
    monkeypatch.setattr(jd_match, "complete_text", lambda *a, **k: json.dumps(GOOD))
    assert client.post("/match", json={"job_description": JD}).status_code == 200
    assert client.post("/match", json={"job_description": JD}).status_code == 429
