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
