import os

import pytest

# Keep tests offline and deterministic: no provider keys, no Drive fetches, no tracing.
for key in (
    "GROQ_API_KEY", "GEMINI_API_KEY", "NVIDIA_API_KEY", "OPENROUTER_API_KEY",
    "GOOGLE_DRIVE_RESUME_URL", "GOOGLE_DRIVE_FILE_ID",
    "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY",
    # Never send real Telegram messages or emails from tests, even when a local .env has them.
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY", "Resend_API_KEY",
    "CONTACT_TO", "CONTACT_FROM", "CONTACT_WEBHOOK_URL", "GITHUB_USERNAME",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
    "NOTIFY_CONTACT", "NOTIFY_CONVERSATION", "NOTIFY_CONVERSATIONS", "NOTIFY_DIGEST", "NOTIFY_ALERT", "NOTIFY_TEST",
):
    os.environ[key] = ""


@pytest.fixture
def feedback_db(tmp_path, monkeypatch):
    import feedback_store

    monkeypatch.setenv("FEEDBACK_DB_PATH", str(tmp_path / "feedback.db"))
    monkeypatch.setattr(feedback_store, "LEGACY_JSONL", tmp_path / "missing.jsonl")
    return feedback_store
