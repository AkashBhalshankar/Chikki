import pytest

import ai
from ai import CircuitBreaker, ChikkiAIError, _classify_error, _is_joke_request, _is_repeated_joke


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_circuit_breaker_moves_failed_provider_to_the_back():
    clock = FakeClock()
    breaker = CircuitBreaker(clock=clock)
    breaker.record_failure("groq", "timeout")
    assert breaker.order(["groq", "gemini", "nvidia"]) == ["gemini", "nvidia", "groq"]

    clock.now += CircuitBreaker.DEFAULT_COOLDOWN + 1
    assert breaker.order(["groq", "gemini", "nvidia"]) == ["groq", "gemini", "nvidia"]


def test_circuit_breaker_uses_longer_cooldown_for_auth_and_resets_on_success():
    clock = FakeClock()
    breaker = CircuitBreaker(clock=clock)
    breaker.record_failure("groq", "auth")
    clock.now += CircuitBreaker.DEFAULT_COOLDOWN + 1
    assert breaker.is_open("groq")
    breaker.record_success("groq")
    assert not breaker.is_open("groq")


@pytest.mark.parametrize("message,kind", [
    ("Error 401 Unauthorized", "auth"),
    ("429 rate limit reached", "rate_limit"),
    ("Request timed out", "timeout"),
    ("model decommissioned", "model_retired"),
    ("connection reset", "network"),
    ("something odd", "unknown"),
])
def test_classify_error(message, kind):
    assert _classify_error(Exception(message)) == kind


def test_joke_detection_across_languages():
    assert _is_joke_request("Tell me a developer joke")
    assert _is_joke_request("ఒక మంచి జోక్ చెప్పు")
    assert _is_joke_request("एक चुटकुला सुनाओ")
    assert not _is_joke_request("What are Akash's skills?")


def test_repeated_joke_detection():
    told = ["Why did the developer go broke? They used up all their cache."]
    assert _is_repeated_joke("Why did the developer go broke? Because they used up all their cache!", told)
    assert not _is_repeated_joke("My code has no bugs, only undocumented features.", told)


def test_stream_falls_back_to_next_provider(monkeypatch):
    monkeypatch.setattr(ai, "circuit_breaker", CircuitBreaker(clock=FakeClock()))
    monkeypatch.setitem(ai.PROVIDERS["groq"], "api_key", "k")
    monkeypatch.setitem(ai.PROVIDERS["gemini"], "api_key", "k")
    monkeypatch.setitem(ai.PROVIDERS["nvidia"], "api_key", None)
    monkeypatch.setitem(ai.PROVIDERS["openrouter"], "api_key", None)
    monkeypatch.setattr(ai, "build_system_prompt", lambda: "system")

    def fake_stream(provider, *args, **kwargs):
        if provider == "groq":
            raise RuntimeError("429 rate limit")
        yield "Hello", ""
        yield " there", ""

    monkeypatch.setattr(ai, "_stream_provider", fake_stream)
    tokens = [token for token, _ in ai.stream_chikki("What does Akash do?", [])]
    assert "".join(tokens) == "Hello there"
    assert ai.circuit_breaker.is_open("groq")
    assert not ai.circuit_breaker.is_open("gemini")


def test_stream_raises_friendly_error_when_all_providers_fail(monkeypatch):
    monkeypatch.setattr(ai, "circuit_breaker", CircuitBreaker(clock=FakeClock()))
    for name in ai.PROVIDERS:
        monkeypatch.setitem(ai.PROVIDERS[name], "api_key", "k")
    monkeypatch.setattr(ai, "build_system_prompt", lambda: "system")

    def failing_stream(*args, **kwargs):
        raise RuntimeError("Request timed out")
        yield  # pragma: no cover

    monkeypatch.setattr(ai, "_stream_provider", failing_stream)
    with pytest.raises(ChikkiAIError) as error:
        list(ai.stream_chikki("hello", []))
    assert error.value.kind == "timeout"
