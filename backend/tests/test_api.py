import pytest
from fastapi.testclient import TestClient

import main
import security


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "test-token")
    monkeypatch.setattr(main, "feedback_limiter", security.RateLimiter(100, 60))
    monkeypatch.setattr(main, "record_feedback", feedback_db.record_feedback)
    monkeypatch.setattr(main, "read_feedback", feedback_db.read_feedback)
    monkeypatch.setattr(main, "feedback_analytics", feedback_db.feedback_analytics)
    return TestClient(main.app)


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == main.APP_VERSION


@pytest.mark.parametrize("method,path", [
    ("get", "/feedback/recent"),
    ("get", "/feedback/analytics"),
    ("post", "/resume/sync"),
])
def test_admin_routes_require_token(client, method, path):
    assert getattr(client, method)(path).status_code == 401
    assert getattr(client, method)(path, headers={"X-Admin-Token": "wrong"}).status_code == 401


def test_feedback_roundtrip_with_admin_token(client):
    created = client.post("/feedback", json={"value": "helpful", "question": "q", "reply": "r"})
    assert created.status_code == 200

    headers = {"X-Admin-Token": "test-token"}
    recent = client.get("/feedback/recent", headers=headers)
    assert recent.status_code == 200
    assert recent.json()[0]["question"] == "q"
    assert client.get("/feedback/analytics", headers=headers).json()["total"] == 1


def test_feedback_validation(client):
    assert client.post("/feedback", json={"value": "meh"}).status_code == 422
    assert client.post("/feedback", json={"value": "helpful", "user_comment": "x" * 5000}).status_code == 422


def test_feedback_rate_limit(client, monkeypatch):
    monkeypatch.setattr(main, "feedback_limiter", security.RateLimiter(1, 60))
    assert client.post("/feedback", json={"value": "helpful"}).status_code == 200
    assert client.post("/feedback", json={"value": "helpful"}).status_code == 429


def test_tts_rejects_oversized_text(client):
    response = client.post("/tts", json={"text": "x" * (security.MAX_TTS_CHARS + 1)})
    assert response.status_code == 422


def test_websocket_rejects_long_messages(client, monkeypatch):
    monkeypatch.setattr(main, "sync_drive_resume", lambda: "")
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": "x" * (security.MAX_MESSAGE_CHARS + 1), "turn_id": "t1"})
        reply = ws.receive_json()
    assert reply["meta"]["isError"] is True
    assert reply["meta"]["kind"] == "too_long"
