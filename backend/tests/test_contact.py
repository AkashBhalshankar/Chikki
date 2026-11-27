import pytest
from fastapi.testclient import TestClient

import contact_store
import main
import security

VALID = {"name": "Priya", "email": "priya@example.com", "company": "Acme", "message": "Let's talk about an AI role."}


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "test-token")
    monkeypatch.setattr(main, "contact_limiter", security.RateLimiter(100, 60))
    sent = []
    monkeypatch.setattr(main, "notify_contact", lambda entry: sent.append(entry))
    test_client = TestClient(main.app)
    test_client.sent = sent
    return test_client


def test_contact_is_stored_and_notified(client):
    response = client.post("/contact", json={**VALID, "topics": "LangGraph RAG"})
    assert response.status_code == 200
    assert len(client.sent) == 1

    stored = client.get("/contact/recent", headers={"X-Admin-Token": "test-token"}).json()
    assert stored[0]["email"] == "priya@example.com"
    assert stored[0]["topics"] == "LangGraph RAG"


def test_contact_list_requires_admin(client):
    assert client.get("/contact/recent").status_code == 401


@pytest.mark.parametrize("override", [
    {"email": "not-an-email"},
    {"name": "   "},
    {"message": ""},
    {"message": "x" * 2001},
])
def test_contact_validation(client, override):
    assert client.post("/contact", json={**VALID, **override}).status_code == 422


def test_honeypot_submissions_are_dropped(client):
    response = client.post("/contact", json={**VALID, "website": "http://spam.example"})
    assert response.status_code == 200
    assert client.sent == []
    assert client.get("/contact/recent", headers={"X-Admin-Token": "test-token"}).json() == []


def test_contact_rate_limit(client, monkeypatch):
    monkeypatch.setattr(main, "contact_limiter", security.RateLimiter(1, 3600))
    assert client.post("/contact", json=VALID).status_code == 200
    assert client.post("/contact", json=VALID).status_code == 429


def test_notify_without_channels_is_a_noop(feedback_db, monkeypatch):
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "CONTACT_WEBHOOK_URL"):
        monkeypatch.delenv(key, raising=False)
    entry = contact_store.save_contact("A", "a@b.co", "", "hi", "")
    assert contact_store.notify_contact(entry) is False


def test_notify_webhook_marks_contact_notified(feedback_db, monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.setenv("CONTACT_WEBHOOK_URL", "https://hooks.example/abc")
    posted = []

    class OkResponse:
        def raise_for_status(self):
            pass

    monkeypatch.setattr(contact_store.requests, "post", lambda url, json, timeout: posted.append(json) or OkResponse())
    entry = contact_store.save_contact("A", "a@b.co", "Acme", "hi there", "RAG")
    assert contact_store.notify_contact(entry) is True
    assert "a@b.co" in posted[0]["text"] and "RAG" in posted[0]["text"]
    assert contact_store.read_contacts()[0]["notified"] == 1
