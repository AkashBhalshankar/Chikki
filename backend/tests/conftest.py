import os

import pytest

# Keep tests offline and deterministic: no provider keys, no Drive fetches, no tracing.
for key in (
    "GROQ_API_KEY", "GEMINI_API_KEY", "NVIDIA_API_KEY", "OPENROUTER_API_KEY",
    "GOOGLE_DRIVE_RESUME_URL", "GOOGLE_DRIVE_FILE_ID",
    "LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY",
):
    os.environ[key] = ""


@pytest.fixture
def feedback_db(tmp_path, monkeypatch):
    import feedback_store

    monkeypatch.setenv("FEEDBACK_DB_PATH", str(tmp_path / "feedback.db"))
    monkeypatch.setattr(feedback_store, "LEGACY_JSONL", tmp_path / "missing.jsonl")
    return feedback_store
