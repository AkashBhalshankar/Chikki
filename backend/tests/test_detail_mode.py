import pytest

import ai
from ai import _prepare_message, detail_max_tokens, is_detail_request


@pytest.mark.parametrize("message", [
    "Tell me more about that.",
    "Explain his skills in detail",
    "can you elaborate?",
    "इसके बारे में विस्तार से बताओ।",
    "దీని గురించి వివరంగా చెప్పు.",
])
def test_detail_requests_detected(message):
    assert is_detail_request(message)


@pytest.mark.parametrize("message", [
    "What are his skills?",
    "ఆకాశ్ టెక్నికల్ స్కిల్స్ వివరించు.",
    "Why should we hire him?",
])
def test_normal_questions_not_detail(message):
    assert not is_detail_request(message)


def test_prepare_message_length_rules():
    assert "at most 2 punchy sentences" in _prepare_message("hi")
    voice = _prepare_message("hi", detail=True, voice_mode=True)
    text = _prepare_message("hi", detail=True, voice_mode=False)
    assert "4 to 5" in voice and "about 150 words" in text
    short = _prepare_message("hi", voice_mode=False)
    assert "40 words" in short and "**bold**" in short and "at most 2 punchy" not in short


def test_detail_token_budget():
    assert detail_max_tokens("en-IN", True) < detail_max_tokens("en-IN", False)
    assert detail_max_tokens("hi-IN", False) == 2 * detail_max_tokens("en-IN", False)


def test_stream_uses_detail_budget(monkeypatch):
    for name in ai.PROVIDERS:
        monkeypatch.setitem(ai.PROVIDERS[name], "api_key", None)
    monkeypatch.setitem(ai.PROVIDERS["groq"], "api_key", "k")
    monkeypatch.setattr(ai, "circuit_breaker", ai.CircuitBreaker())
    monkeypatch.setattr(ai, "build_system_prompt", lambda: "system")
    seen = {}

    def fake_stream(provider, system, history, message, language, **kwargs):
        seen.update(kwargs, message=message)
        yield "ok", ""

    monkeypatch.setattr(ai, "_stream_provider", fake_stream)
    list(ai.stream_chikki("Tell me more", [], detail=True, voice_mode=False))
    assert seen["max_tokens_override"] == detail_max_tokens("en-IN", False)
    assert "about 150 words" in seen["message"]

    seen.clear()
    list(ai.stream_chikki("What does he do?", []))
    assert seen["max_tokens_override"] is None
