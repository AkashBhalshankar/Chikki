

def test_rate_limit_cooldown_follows_the_providers_retry_hint():
    import ai

    assert ai.rate_limit_cooldown(Exception("Please retry in 23h20m58.7s.")) == ai.MAX_RATE_LIMIT_COOLDOWN
    assert 400 < ai.rate_limit_cooldown(Exception("429 try again in 7m12.5s")) < 450
    assert ai.rate_limit_cooldown(Exception("429 rate limit")) == ai.CircuitBreaker.DEFAULT_COOLDOWN
    assert ai.rate_limit_cooldown(Exception("try again in 12s")) == ai.CircuitBreaker.DEFAULT_COOLDOWN


def test_quickest_provider_is_tried_first_once_measured():
    import ai

    breaker = ai.CircuitBreaker()
    order = ["groq", "gemini", "nvidia", "openrouter"]
    assert breaker.order(order) == order  # nothing measured: configured priority
    breaker.record_latency("groq", 3.0)
    breaker.record_latency("nvidia", 0.5)
    breaker.record_latency("openrouter", 20.0)
    assert breaker.order(order)[0] == "nvidia"
    assert breaker.order(order)[-1] == "openrouter"
    breaker.record_failure("nvidia", "rate_limit")
    assert breaker.order(order)[-1] == "nvidia"  # cooling providers go last whatever their speed


def _fake(delay=0.0, tokens=("Hello ", "there."), error=None):
    import time

    def start(_provider):
        time.sleep(delay)
        if error:
            raise error
        for token in tokens:
            yield token, "t"

    return start


def test_hedge_uses_the_second_provider_when_the_first_is_slow():
    import ai

    ai.circuit_breaker = ai.CircuitBreaker()
    slow_then_fast = {"groq": _fake(delay=2.0, tokens=("slow ",)), "nvidia": _fake(delay=0.05, tokens=("fast ", "one."))}
    meta = {}
    words = "".join(t for t, _ in ai._hedged_stream(["groq", "nvidia"], lambda p: slow_then_fast[p](p), meta, hedge_delay=0.2))
    assert words == "fast one." and meta["provider"] == "nvidia"


def test_hedge_moves_on_at_once_when_the_first_provider_fails():
    import time
    import ai

    ai.circuit_breaker = ai.CircuitBreaker()
    providers = {"groq": _fake(error=RuntimeError("429 rate limit")), "nvidia": _fake()}
    started = time.monotonic()
    words = "".join(t for t, _ in ai._hedged_stream(["groq", "nvidia"], lambda p: providers[p](p), None, hedge_delay=5.0))
    assert words == "Hello there." and time.monotonic() - started < 1.0
    assert ai.circuit_breaker.is_open("groq")


def test_hedge_reports_when_every_provider_fails():
    import pytest
    import ai

    ai.circuit_breaker = ai.CircuitBreaker()
    boom = {"groq": _fake(error=RuntimeError("401 unauthorized")), "nvidia": _fake(error=RuntimeError("timeout"))}
    with pytest.raises(ai._AllProvidersFailed):
        list(ai._hedged_stream(["groq", "nvidia"], lambda p: boom[p](p), None, hedge_delay=0.1))
