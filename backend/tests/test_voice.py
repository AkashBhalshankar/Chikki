import asyncio

import pytest

import tts
from tts import apply_pronunciations, clean_for_speech, speech_language


@pytest.mark.parametrize("text,ui_language,expected", [
    ("Akash builds FastAPI services.", "te-IN", "en"),       # English reply while the UI is Telugu
    ("ఆకాశ్ ఫాస్ట్ ఏపీఐ సేవలు నిర్మిస్తాడు", "en-IN", "te"),    # Telugu reply while the UI is English
    ("आकाश बैकएंड बनाता है", "en-IN", "hi"),
    ("ఆకాశ్ builds FastAPI services", "en-IN", "te"),          # mixed: the native script wins
    ("42 !!", "hi-IN", "hi"),                                 # no signal: fall back to the UI language
])
def test_speech_language_follows_the_words(text, ui_language, expected):
    assert speech_language(text, ui_language) == expected


def test_pronunciations_only_change_audio_text():
    caption = clean_for_speech("Akash built Chikki with FastAPI, RAG and LLM APIs.")
    assert "FastAPI" in caption  # captions keep the real spelling
    spoken = apply_pronunciations(caption)
    assert "Fast A P I" in spoken and "R A G" in spoken and "L L M" in spoken and "A P Is" in spoken
    assert apply_pronunciations("capital rage") == "capital rage"  # no partial-word changes


def test_synthesize_uses_matching_voice_and_spoken_text(monkeypatch):
    captured = {}

    class FakeCommunicate:
        def __init__(self, text, voice, rate, pitch):
            captured.update(text=text, voice=voice)

        async def stream(self):
            yield {"type": "audio", "data": b"audio"}

    monkeypatch.setattr(tts.edge_tts, "Communicate", FakeCommunicate)
    audio = asyncio.run(tts.synthesize_speech("Akash uses FastAPI.", language="te-IN"))
    assert audio == b"audio"
    assert captured["voice"] == "en-IN-NeerjaNeural"
    assert captured["text"] == "Akash uses Fast A P I."


def test_tts_failure_is_classified_and_pauses_voice(monkeypatch):
    import asyncio as aio

    class Rejected(Exception):
        status = 403

    kind, fix = tts.classify_tts_error(Rejected("403"))
    assert kind == "rejected" and "edge-tts" in fix
    assert tts.classify_tts_error(aio.TimeoutError())[0] == "timeout"

    health = tts.TtsHealth()
    for _ in range(tts.TTS_PAUSE_AFTER_FAILURES):
        health.record_failure(Rejected("403"))
    assert health.paused and health.snapshot()["last_error_kind"] == "rejected"
    health.record_ok()
    assert not health.paused


def test_synthesize_times_out_instead_of_hanging(monkeypatch):
    import asyncio as aio

    async def hang(*args, **kwargs):
        await aio.sleep(30)

    monkeypatch.setattr(tts, "_synthesize_once", hang)
    monkeypatch.setattr(tts, "TTS_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(tts, "TTS_RETRIES", 0)
    monkeypatch.setattr(tts, "tts_health", tts.TtsHealth())
    import pytest
    with pytest.raises(Exception):
        aio.run(tts.synthesize_speech("hello"))
    assert tts.tts_health.last_error[0] == "timeout"


def test_stt_filters_phantom_phrases_and_endpoint_guards(monkeypatch):
    import stt
    from fastapi.testclient import TestClient
    import main

    assert stt.is_phantom("Thank you.", 0.5, -1.0)
    assert stt.is_phantom("", 0.0, 0.0)
    assert not stt.is_phantom("Tell me about LangGraph", 0.05, -0.2)

    client = TestClient(main.app)
    monkeypatch.setattr(stt, "configured", lambda: False)
    assert client.post("/stt", content=b"abc").status_code == 503
    monkeypatch.setattr(stt, "configured", lambda: True)
    assert client.post("/stt", content=b"").status_code == 400
    monkeypatch.setattr(stt, "transcribe", lambda *a, **k: {"text": "hello", "confident": True})
    response = client.post("/stt?language=en-IN", content=b"abc", headers={"content-type": "audio/webm"})
    assert response.json() == {"text": "hello", "confident": True}


def test_early_phrase_speaks_first_clause_only_once_long_enough():
    from grounding import pop_early_phrase

    assert pop_early_phrase("Akash is an AI engineer")[0] == ""
    assert pop_early_phrase("Well, yes")[0] == ""  # clause too short to be worth speaking alone
    phrase, rest = pop_early_phrase("Akash is an AI engineer at UBS, where he builds agents")
    assert phrase == "Akash is an AI engineer at UBS, " and rest == "where he builds agents"
    assert pop_early_phrase("Version 1.5 of the platform shipped without any delay")[0] == ""


def test_audio_cache_serves_repeats_and_survives_service_failure(monkeypatch):
    import asyncio as aio

    calls = []

    async def fake(text, voice=None, tone="natural", language=None, **kwargs):
        calls.append(text)
        return b"AUDIO"

    monkeypatch.setattr(tts, "_synthesize_once", fake)
    tts._cache.clear()
    assert aio.run(tts.synthesize_speech("Hello there", language="en-IN")) == b"AUDIO"
    assert aio.run(tts.synthesize_speech("Hello there", language="en-IN")) == b"AUDIO"
    assert calls == ["Hello there"]

    async def broken(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr(tts, "_synthesize_once", broken)
    assert aio.run(tts.synthesize_speech("Hello there", language="en-IN")) == b"AUDIO"


def test_backend_greetings_match_the_frontend():
    from pathlib import Path

    source = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "App.jsx").read_text(encoding="utf-8")
    for lines in tts.WAKE_GREETINGS.values():
        for line in lines:
            assert line in source


def test_voice_metrics_endpoint_feeds_analytics(feedback_db, monkeypatch):
    from fastapi.testclient import TestClient
    import main
    import security
    from analytics_store import summary

    monkeypatch.setattr(main, "feedback_limiter", security.RateLimiter(100, 60))
    client = TestClient(main.app)
    assert client.post("/analytics/voice", json={"outcome": "ok", "first_audio_ms": 900, "language": "en-IN"}).status_code == 200
    assert client.post("/analytics/voice", json={"outcome": "tts_fallback", "language": "en-IN"}).status_code == 200
    assert client.post("/analytics/voice", json={"outcome": "bogus"}).status_code == 422
    voice = summary(7)["voice"]
    assert voice["turns"] == 2 and voice["first_audio_p50_ms"] == 900 and voice["issues"] == {"tts_fallback": 1}
