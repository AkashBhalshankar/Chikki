import pytest
from fastapi.testclient import TestClient

import contact_store
import main
import notifier

ALL_VARS = (
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY", "Resend_API_KEY",
    "CONTACT_TO", "CONTACT_FROM", "CONTACT_WEBHOOK_URL",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
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


class FakeSMTP:
    instances = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.tls, self.login_args, self.sent = host, port, False, None, []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.tls = True

    def login(self, user, password):
        self.login_args = (user, password)

    def send_message(self, message):
        self.sent.append(message)


@pytest.fixture
def smtp_env(clean_env):
    FakeSMTP.instances.clear()
    clean_env.setenv("SMTP_HOST", "smtp.example.com")
    clean_env.setenv("SMTP_PORT", "587")
    clean_env.setenv("SMTP_USER", "me@example.com")
    clean_env.setenv("SMTP_PASS", "app-password")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    clean_env.setattr(notifier.smtplib, "SMTP", FakeSMTP)
    return clean_env


def test_smtp_needs_all_settings(clean_env):
    clean_env.setenv("SMTP_HOST", "smtp.example.com")
    clean_env.setenv("SMTP_USER", "me@example.com")
    clean_env.setenv("CONTACT_TO", "owner@example.com")
    assert not notifier.smtp_configured()  # no password yet
    clean_env.setenv("SMTP_PASS", "pw")
    assert notifier.smtp_configured() and notifier.email_configured()


def test_smtp_email_message(smtp_env):
    assert notifier.send_all("Hello body", subject="Hi", reply_to="visitor@acme.com") == {"email": True}
    server = FakeSMTP.instances[0]
    assert server.tls and server.login_args == ("me@example.com", "app-password")
    message = server.sent[0]
    assert message["To"] == "owner@example.com" and message["Reply-To"] == "visitor@acme.com"
    assert message["Subject"] == "Hi" and message["From"] == "Chikki <me@example.com>"
    assert "Hello body" in message.get_content()


def test_smtp_is_the_fallback_when_resend_fails(smtp_env, monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_key")
    monkeypatch.setattr(notifier.requests, "post", lambda *a, **k: FakeResponse(False, 403, "domain not verified"))
    assert notifier.send_all("x") == {"email": True}
    assert len(FakeSMTP.instances) == 1


def test_smtp_not_used_when_resend_succeeds(smtp_env, monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_key")
    monkeypatch.setattr(notifier.requests, "post", lambda *a, **k: FakeResponse())
    assert notifier.send_all("x") == {"email": True}
    assert FakeSMTP.instances == []


def test_smtp_failures_are_reported_without_raising(smtp_env, monkeypatch):
    def broken(*args, **kwargs):
        raise OSError("network unreachable")

    monkeypatch.setattr(notifier.smtplib, "SMTP", broken)
    assert notifier.send_all("x") == {"email": False}


def test_smtp_bad_login_is_reported(smtp_env, monkeypatch):
    class RejectingSMTP(FakeSMTP):
        def login(self, user, password):
            raise notifier.smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(notifier.smtplib, "SMTP", RejectingSMTP)
    assert notifier.send_all("x") == {"email": False}


def test_smtp_port_465_uses_ssl(smtp_env, monkeypatch):
    smtp_env.setenv("SMTP_PORT", "465")
    seen = []
    monkeypatch.setattr(notifier.smtplib, "SMTP_SSL", lambda host, port, timeout=None: seen.append(port) or FakeSMTP(host, port))
    assert notifier.send_all("x") == {"email": True} and seen == [465]
