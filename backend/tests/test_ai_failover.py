

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
