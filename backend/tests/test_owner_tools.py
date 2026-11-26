import pytest
from fastapi.testclient import TestClient

import digest
import github_activity
import main
import notifier

ADMIN = {"X-Admin-Token": "tok"}


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "tok")
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "CONTACT_WEBHOOK_URL"):
        monkeypatch.delenv(key, raising=False)
    return TestClient(main.app)


def test_digest_with_no_activity(feedback_db):
    assert "No visitor activity" in digest.build_digest()


def test_digest_summarises_activity(feedback_db):
    import analytics_store as analytics
    import contact_store

    analytics.record_event("turn", "What is LangGraph?", "en-IN", "text", "groq", 900, 300, True, None, 2)
    analytics.record_event("turn", "Does he know Kubernetes?", "en-IN", "text", "groq", 700, 200, True, None, 0)
    feedback_db.record_feedback("helpful", question="q")
    contact_store.save_contact("Priya", "p@acme.com", "Acme", "Hi", "")

    text = digest.build_digest()
    assert "Questions asked: 2" in text and "Messages left for you: 1" in text
    assert "Priya (Acme)" in text and "does he know kubernetes" in text
    assert "Feedback: 1 helpful, 0 needs improvement" in text


def test_digest_and_ops_endpoints_require_admin(client):
    for method, path in (("get", "/digest/preview"), ("post", "/digest/send"), ("post", "/ops/check")):
        assert getattr(client, method)(path).status_code == 401


def test_digest_send_reports_delivery(client, monkeypatch):
    monkeypatch.setattr(digest, "send_notification", lambda text, **kw: True)
    body = client.post("/digest/send", headers=ADMIN).json()
    assert body["sent"] is True and "Chikki weekly digest" in body["text"]


def test_ops_check_alerts_when_drive_fails(client, monkeypatch):
    sent = []
    monkeypatch.setenv("GOOGLE_DRIVE_RESUME_URL", "https://drive.example/x")
    monkeypatch.setattr(digest, "sync_drive_resume", lambda: "")
    monkeypatch.setattr(digest, "send_notification", lambda text, **kw: sent.append(text) or True)
    monkeypatch.setitem(digest.PROVIDERS["groq"], "api_key", "k")
    body = client.post("/ops/check", headers=ADMIN).json()
    assert body["ok"] is False and body["alerted"] is True
    assert "Google Drive" in body["problems"][0] and "Drive" in sent[0]


def test_ops_check_healthy_sends_nothing(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_DRIVE_RESUME_URL", "https://drive.example/x")
    monkeypatch.setattr(digest, "sync_drive_resume", lambda: "resume text")
    monkeypatch.setattr(digest, "send_notification", lambda text, **kw: pytest.fail("should not alert"))
    monkeypatch.setitem(digest.PROVIDERS["groq"], "api_key", "k")
    assert client.post("/ops/check", headers=ADMIN).json() == {"ok": True, "problems": [], "alerted": False}


def test_notifier_without_channels_returns_false(monkeypatch):
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "CONTACT_WEBHOOK_URL"):
        monkeypatch.delenv(key, raising=False)
    assert notifier.send_notification("hi") is False and not notifier.channels_configured()


def test_github_question_detection():
    assert github_activity.is_github_question("What has he built recently on GitHub?")
    assert github_activity.is_github_question("Is he into open source?")
    assert not github_activity.is_github_question("What are his skills?")


def test_github_context(monkeypatch):
    monkeypatch.setenv("GITHUB_USERNAME", "someone")
    monkeypatch.setattr(
        github_activity,
        "recent_repos",
        lambda username, limit=5: [
            {"name": "Chikki", "description": "Voice assistant", "language": "Python", "pushed_at": "2026-11-20", "url": "u"}
        ],
    )
    block = github_activity.github_context("Show me his GitHub repos")
    assert "Chikki (Python): Voice assistant" in block and "2026-11-20" in block
    assert github_activity.github_context("What are his skills?") == ""
    monkeypatch.delenv("GITHUB_USERNAME")
    assert github_activity.github_context("Show me his GitHub repos") == ""


def test_recent_repos_filters_forks_and_caches(monkeypatch):
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [
                {"name": "a", "html_url": "u1", "pushed_at": "2026-01-02T00:00:00Z", "fork": False, "archived": False},
                {"name": "forked", "html_url": "u2", "fork": True},
                {"name": "old", "html_url": "u3", "archived": True},
            ]

    monkeypatch.setattr(github_activity.requests, "get", lambda *a, **k: calls.append(1) or FakeResponse())
    github_activity._cache.clear()
    assert [r["name"] for r in github_activity.recent_repos("u")] == ["a"]
    github_activity.recent_repos("u")
    assert len(calls) == 1
