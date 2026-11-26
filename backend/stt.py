"""Server-side speech-to-text (Groq Whisper) for accurate listening.

The browser's own recogniser is fast but unreliable, especially on phones and for
Indian English, Hindi and Telugu. The page records the utterance and sends it here;
if this is unavailable the page simply keeps the browser's transcript.
"""

import io
import logging
import os

from openai import OpenAI

logger = logging.getLogger("chikki")

STT_MODEL = os.getenv("STT_MODEL", "whisper-large-v3-turbo")
MAX_AUDIO_BYTES = int(os.getenv("MAX_STT_BYTES", str(2 * 1024 * 1024)))

# Names and terms Whisper otherwise mishears. Passed as a hint, not as an instruction.
VOCAB_HINT = (
    "Chikki, Akash Bhalshankar, UBS, MassMutual, LangGraph, LangChain, FastAPI, RAG, LLM, "
    "Python, React, WebSocket, Kubernetes, ETL, resume, role fit."
)

# Phrases Whisper invents from silence or noise.
PHANTOMS = {"thank you", "thanks for watching", "thank you for watching", "you", "bye", "thanks", "okay", "."}

_client: OpenAI | None = None


def configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("GROQ_API_KEY"), base_url="https://api.groq.com/openai/v1", timeout=12.0)
    return _client


def is_phantom(text: str, no_speech_prob: float, avg_logprob: float) -> bool:
    cleaned = text.strip().lower().strip(" .!?,")
    if not cleaned:
        return True
    if no_speech_prob > 0.6 and avg_logprob < -0.5:
        return True
    return cleaned in PHANTOMS and (no_speech_prob > 0.3 or avg_logprob < -0.8)


def transcribe(audio: bytes, content_type: str = "audio/webm", language: str | None = None) -> dict:
    """Returns {"text": str, "confident": bool}. Raises on provider failure."""
    extension = "mp4" if "mp4" in content_type or "aac" in content_type else "ogg" if "ogg" in content_type else "webm"
    upload = io.BytesIO(audio)
    upload.name = f"speech.{extension}"
    lang = (language or "").split("-")[0].lower() or None
    result = _get_client().audio.transcriptions.create(
        file=upload,
        model=STT_MODEL,
        language=lang if lang in {"en", "hi", "te"} else None,
        prompt=VOCAB_HINT,
        response_format="verbose_json",
        temperature=0,
    )
    text = (getattr(result, "text", "") or "").strip()
    segments = getattr(result, "segments", None) or []

    def field(segment, name, default):
        value = segment.get(name, default) if isinstance(segment, dict) else getattr(segment, name, default)
        return default if value is None else value

    no_speech = max((field(s, "no_speech_prob", 0.0) for s in segments), default=0.0)
    logprob = min((field(s, "avg_logprob", 0.0) for s in segments), default=0.0)
    if is_phantom(text, no_speech, logprob):
        return {"text": "", "confident": False}
    return {"text": text, "confident": logprob > -0.9}
