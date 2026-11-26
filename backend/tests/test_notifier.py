import pytest
from fastapi.testclient import TestClient

import contact_store
import main
import notifier

ALL_VARS = (
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY", "Resend_API_KEY",
    "CONTACT_TO", "CONTACT_FROM", "CONTACT_WEBHOOK_URL",
)


class FakeResponse:
    def __init__(self, ok=True, status_code=200, text=""):
        self.ok, self.status_code, self.text = ok, status_code, text

    def raise_for_status(self):
        if not self.ok:
            raise notifier.requests.HTTPError(f"{self.status_code}")


@pytest.fixture
def clean_env(monkeypatch):
    for name in ALL_VARS:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


@pytest.fixture
def calls(clean_env):
    recorded = []

    def fake_post(url, **kwargs):
        recorded.append({"url": url, **kwargs})
        return FakeResponse()

    clean_env.setattr(notifier.requests, "post", fake_post)
    return recorded


def test_nothing_configured(clean_env):
    assert not notifier.channels_configured()
    assert notifier.send_all("hi") == {}
    assert notifier.send_notification("hi") is False


def test_resend_key_accepts_either_spelling(clean_env):
    clean_env.setenv("Resend_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    assert notifier.email_configured()


def test_email_needs_both_key_and_recipient(clean_env):
    clean_env.setenv("RESEND_API_KEY", "re_key")
    assert not notifier.email_configured()
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    assert notifier.email_configured()


def test_email_payload(calls, clean_env):
    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "a@example.com, b@example.com")
    clean_env.setenv("CONTACT_FROM", "Chikki <chikki@mydomain.com>")
    assert notifier.send_all("Body text", subject="Subject", reply_to="visitor@acme.com") == {"email": True}
    sent = calls[0]
    assert sent["url"] == notifier.RESEND_URL
    assert sent["headers"] == {"Authorization": "Bearer re_key"}
    assert sent["json"] == {
        "from": "Chikki <chikki@mydomain.com>",
        "to": ["a@example.com", "b@example.com"],
        "subject": "Subject",
        "text": "Body text",
        "reply_to": "visitor@acme.com",
    }


def test_email_uses_default_sender_and_omits_reply_to(calls, clean_env):
    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    notifier.send_all("x")
    assert calls[0]["json"]["from"] == notifier.DEFAULT_FROM
    assert "reply_to" not in calls[0]["json"]


def test_failed_email_is_reported_without_raising(clean_env):
    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    clean_env.setattr(notifier.requests, "post", lambda *a, **k: FakeResponse(False, 403, "only your own email"))
    assert notifier.send_all("x") == {"email": False}


def test_one_failing_channel_does_not_block_the_others(clean_env):
    clean_env.setenv("TELEGRAM_BOT_TOKEN", "t")
    clean_env.setenv("TELEGRAM_CHAT_ID", "1")
    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")

    def fake_post(url, **kwargs):
        return FakeResponse(False, 500) if "telegram" in url else FakeResponse()

    clean_env.setattr(notifier.requests, "post", fake_post)
    assert notifier.send_all("x") == {"telegram": False, "email": True}
    assert notifier.send_notification("x") is True


def test_contact_message_emails_with_reply_to_visitor(calls, feedback_db, clean_env):
    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    entry = contact_store.save_contact("Priya", "priya@acme.com", "Acme", "Let's talk", "RAG")
    assert contact_store.notify_contact(entry) is True
    payload = calls[0]["json"]
    assert payload["reply_to"] == "priya@acme.com"
    assert payload["subject"] == "New message for Akash from Priya"
    assert "Let's talk" in payload["text"] and "Acme" in payload["text"]
    assert contact_store.read_contacts()[0]["notified"] == 1


def test_notify_test_endpoint(calls, feedback_db, clean_env):
    clean_env.setenv("ADMIN_TOKEN", "tok")
    client = TestClient(main.app)
    assert client.post("/notify/test").status_code == 401

    nothing = client.post("/notify/test", headers={"X-Admin-Token": "tok"}).json()
    assert nothing == {"configured": [], "delivered": {}, "ok": False}

    clean_env.setenv("RESEND_API_KEY", "re_key")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    body = client.post("/notify/test", headers={"X-Admin-Token": "tok"}).json()
    assert body == {"configured": ["email"], "delivered": {"email": True}, "ok": True}
