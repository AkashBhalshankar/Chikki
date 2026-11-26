import asyncio
import html
import logging
import os
import re
import time
from collections import OrderedDict
from importlib import metadata

import edge_tts

logger = logging.getLogger("chikki")

TTS_TIMEOUT_SECONDS = float(os.getenv("TTS_TIMEOUT_SECONDS", "8"))
TTS_RETRIES = int(os.getenv("TTS_RETRIES", "1"))
TTS_PAUSE_AFTER_FAILURES = 3   # consecutive failures before voice is paused
TTS_PAUSE_SECONDS = 45         # while paused the browser voice speaks instead of stalling every turn


# Strictly Female Neural Voices Only
FEMALE_VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",  # Indian English (Female)
    "hi": "hi-IN-SwaraNeural",   # Hindi (Female)
    "te": "te-IN-ShrutiNeural",  # Telugu (Female)
}

DEFAULT_FEMALE_VOICE = "en-IN-NeerjaNeural"

# English voices the visitor can choose between (all female, to match Chikki). Hindi and Telugu keep their own voice.
VOICE_CHOICES = {
    "neerja": "en-IN-NeerjaNeural",
    "sonia": "en-GB-SoniaNeural",
    "jenny": "en-US-JennyNeural",
}

DECIMAL_WORDS = {
    "en": {
        "whole": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"],
        "point": "point",
        "digits": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
    },
    "te": {
        "whole": ["సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది", "పది", "పదకొండు", "పన్నెండు", "పదమూడు", "పద్నాలుగు", "పదిహేను", "పదహారు", "పదిహేడు", "పద్దెనిమిది", "పంతొమ్మిది", "ఇరవై"],
        "point": "పాయింట్",
        "digits": ["సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది"],
    },
    "hi": {
        "whole": ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस", "बीस"],
        "point": "दशमलव",
        "digits": ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ"],
    },
}


def detect_language(text: str) -> str:
    """
    Detects if the text contains Telugu script, Devanagari (Hindi) script,
    or common transliterated phrases.
    """
    if not text:
        return "en"

    # Telugu Unicode block: \u0C00-\u0C7F
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "te"

    # Devanagari Unicode block (Hindi): \u0900-\u097F
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"

    lower = text.lower()
    # Common Telugu transliterated words
    if re.search(r"\b(cheppandi|cheppu|namaskaram|ela|unnav|meeru|akash gurinchi|nenu|telugu|bagunnara)\b", lower):
        return "te"

    # Common Hindi transliterated words
    if re.search(r"\b(namaste|kaise|batao|kya|hai|karega|akash ke baare|shukriya|hindi|kripya)\b", lower):
        return "hi"

    return "en"


def speech_language(text: str, language: str | None = None) -> str:
    """Language whose voice should read this text.

    The voice follows the words actually being spoken, not just the UI language:
    a Telugu or Hindi voice reading English text (or an English voice reading
    Telugu script) sounds garbled. The UI language is only a fallback when the
    text gives no signal.
    """
    detected = detect_language(text)
    if detected != "en":
        return detected
    if re.search(r"[A-Za-z]{3}", text):
        return "en"
    return language.split("-")[0].lower() if language else "en"


# Respellings so the voice says technical terms the way people do. They are
# applied to the audio only; captions keep the original spelling.
PRONUNCIATIONS = [
    (r"\bFastAPI\b", "Fast A P I"),
    (r"\bLangGraph\b", "Lang Graph"),
    (r"\bLangChain\b", "Lang Chain"),
    (r"\bLangfuse\b", "Lang fuse"),
    (r"\bNavLearn\b", "Nav Learn"),
    (r"\bWebSockets?\b", "Web Sockets"),
    (r"\bEdge-TTS\b", "Edge T T S"),
    (r"\bOpenAI\b", "Open A I"),
    (r"\bGitHub\b", "Git Hub"),
    (r"\bSQLite\b", "S Q Lite"),
    (r"\bpytest\b", "pie test"),
    (r"\bGroq\b", "Grok"),
    (r"\bLLMs\b", "L L Ms"),
    (r"\bLLM\b", "L L M"),
    (r"\bAPIs\b", "A P Is"),
    (r"\bAPI\b", "A P I"),
    (r"\bRAG\b", "R A G"),
    (r"\bATS\b", "A T S"),
    (r"\bTTS\b", "T T S"),
    (r"\bPWA\b", "P W A"),
    (r"\bJSON\b", "Jay son"),
]


def apply_pronunciations(text: str) -> str:
    for pattern, spoken in PRONUNCIATIONS:
        text = re.sub(pattern, spoken, text)
    return text


def speech_tone(user_text: str = "", reply: str = "") -> str:
    """Infer vocal prosody and emotional delivery from conversational context."""
    combined = f"{user_text} {reply}".lower()

    if re.search(r"\b(joke|funny|laugh|hilarious|haha|hehe|lol|chuckle|ha\.\.ha|navvu|hasi)\b", combined):
        return "laughing"
    if re.search(r"\b(shy|blush|sweet|aww|thank you|shukriya|dhanyavadalu|compliment|kind of you)\b", combined):
        return "shy"
    if re.search(r"\b(hmm|let me think|well\.\.\.|chooddam|sochte)\b", combined):
        return "thinking"
    if re.search(r"\b(excited|amazing|incredible|awesome|thrilled|super cool|bagundi|badhiya)\b", combined):
        return "excited"
    if re.search(r"\b(why should|strengths|hire|expert|production|ubs|langgraph|impact)\b", combined):
        return "confident"
    if re.search(r"\b(sorry|apolog|sad|unfortunate|kshaminchandi|maaf)\b", combined):
        return "empathetic"
    return "natural"


def _expand_experience_decimals(text: str, language: str) -> str:
    words = DECIMAL_WORDS.get(language, DECIMAL_WORDS["en"])

    def replace(match: re.Match) -> str:
        whole = int(match.group("whole"))
        fraction = match.group("fraction")
        if whole >= len(words["whole"]):
            return match.group(0)
        spoken_number = f"{words['whole'][whole]} {words['point']} " + " ".join(
            words["digits"][int(digit)] for digit in fraction
        )
        return f"{spoken_number} {match.group('unit')}"

    return re.sub(
        r"(?P<whole>\d{1,2})\.(?P<fraction>\d+)\s*(?P<unit>years?|yrs?|సంవత్సర\w*|साल|वर्ष\w*)",
        replace,
        text,
        flags=re.IGNORECASE,
    )


def clean_for_speech(text: str, language: str | None = None) -> str:
    if not text:
        return ""

    text = html.unescape(text)
    lang = language.split("-")[0].lower() if language else detect_language(text)
    text = _expand_experience_decimals(text, lang)

    # Convert laugh indicators
    text = re.sub(r"\bha\.\.ha\.\.ha+[\.\!]*", "haha, ha! ", text, flags=re.IGNORECASE)
    text = re.sub(r"\bhaha+\b", "haha!", text, flags=re.IGNORECASE)
    text = re.sub(r"\bhehe+\b", "hehe!", text, flags=re.IGNORECASE)
    text = re.sub(r"\bhmm+(\.\.\.)?", "Hmm... ", text, flags=re.IGNORECASE)

    # Remove code fences and inline ticks
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)

    # Strip markdown emphasis and headers
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", text)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

    # Strip URLs
    text = re.sub(r"https?://\S+", "", text)

    # Strip non-speech brackets or symbols, keeping native scripts intact
    text = re.sub(r"[@#$%^&*_~|<>]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def _rate_string(base: str, speed: float) -> str:
    """Combines a tone's own rate (like "+4%") with the visitor's speed setting (0.8 to 1.3)."""
    percent = int(base.rstrip("%"))
    percent += int(round((max(0.8, min(1.3, speed)) - 1.0) * 100))
    return f"{percent:+d}%"


async def _synthesize_once(
    text: str,
    voice: str = None,
    tone: str = "natural",
    language: str = None,
    voice_pref: str = None,
    speed: float = 1.0,
) -> bytes:
    """
    Synthesizes speech using strictly female neural voices (Neerja, Swara, Shruti).
    """
    clean_text = clean_for_speech(text)
    if not clean_text:
        return b""

    # Pick the voice from the words actually spoken, so the audio matches the reply.
    lang = speech_language(clean_text, language)
    selected_voice = voice or FEMALE_VOICE_MAP.get(lang, DEFAULT_FEMALE_VOICE)
    if lang == "en" and not voice and voice_pref in VOICE_CHOICES:
        selected_voice = VOICE_CHOICES[voice_pref]
    spoken_text = apply_pronunciations(clean_text)

    # Female expressive vocal pitch and rate profiles
    tone_profiles = {
        "laughing": {"rate": "+10%", "pitch": "+6Hz"},
        "shy": {"rate": "-4%", "pitch": "+4Hz"},
        "thinking": {"rate": "-6%", "pitch": "-1Hz"},
        "excited": {"rate": "+8%", "pitch": "+5Hz"},
        "confident": {"rate": "+2%", "pitch": "+2Hz"},
        "empathetic": {"rate": "-5%", "pitch": "-2Hz"},
        "natural": {"rate": "+1%", "pitch": "+1Hz"},
    }

    config = tone_profiles.get(tone, tone_profiles["natural"])

    communicate = edge_tts.Communicate(
        spoken_text,
        selected_voice,
        rate=_rate_string(config["rate"], speed),
        pitch=config["pitch"],
    )

    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    return b"".join(audio_chunks)


def edge_tts_version() -> str:
    try:
        return metadata.version("edge-tts")
    except metadata.PackageNotFoundError:
        return "unknown"


def classify_tts_error(error: BaseException) -> tuple[str, str]:
    """Turns a text-to-speech failure into (kind, what to do about it)."""
    name = type(error).__name__
    text = str(error)
    status = getattr(error, "status", None)
    if isinstance(error, (asyncio.TimeoutError, TimeoutError)):
        return "timeout", "Microsoft's speech service did not answer in time. Usually a slow network or a service hiccup; it often clears by itself."
    if status in (401, 403) or "403" in text or "401" in text:
        return "rejected", (
            "Microsoft rejected the request (403/401). This is the classic sign that Microsoft changed its "
            f"speech service. Upgrade the library: `pip install -U edge-tts` (installed: {edge_tts_version()})."
        )
    if status in (404, 410) or "404" in text:
        return "endpoint_changed", f"The speech endpoint moved or was retired. Upgrade edge-tts (installed: {edge_tts_version()})."
    if name == "NoAudioReceived" or "No audio was received" in text:
        return "no_audio", "The service answered but sent no audio. The voice name may be retired, or the service changed. Try upgrading edge-tts."
    if "getaddrinfo" in text or "Cannot connect" in text or name in ("ClientConnectorError", "ClientConnectorDNSError"):
        return "network", "The server cannot reach Microsoft's speech service. Check the host's outbound network access."
    return "unknown", f"{name}: {text[:160]}"


class TtsHealth:
    """Tracks recent voice failures so a broken service cannot stall every reply."""

    def __init__(self):
        self.consecutive_failures = 0
        self.paused_until = 0.0
        self.last_error: tuple[str, str] | None = None
        self.last_ok_at: float | None = None

    @property
    def paused(self) -> bool:
        return time.monotonic() < self.paused_until

    def record_ok(self) -> None:
        self.consecutive_failures = 0
        self.paused_until = 0.0
        self.last_ok_at = time.time()

    def record_failure(self, error: BaseException) -> None:
        self.consecutive_failures += 1
        self.last_error = classify_tts_error(error)
        if self.consecutive_failures >= TTS_PAUSE_AFTER_FAILURES:
            self.paused_until = time.monotonic() + TTS_PAUSE_SECONDS

    def snapshot(self) -> dict:
        return {
            "ok": self.consecutive_failures == 0,
            "paused": self.paused,
            "consecutive_failures": self.consecutive_failures,
            "last_error_kind": self.last_error[0] if self.last_error else None,
            "last_error_fix": self.last_error[1] if self.last_error else None,
            "edge_tts_version": edge_tts_version(),
        }


tts_health = TtsHealth()


# Finished audio is kept so repeated lines (greetings, standard notices, repeated questions)
# play instantly and keep working even if Microsoft's service is down.
CACHE_MAX_ENTRIES = 300
CACHE_MAX_BYTES = 24 * 1024 * 1024
_cache: "OrderedDict[tuple, bytes]" = OrderedDict()
_cache_bytes = 0
cache_stats = {"hits": 0, "misses": 0}


def _cache_get(key: tuple) -> bytes | None:
    audio = _cache.get(key)
    if audio is not None:
        _cache.move_to_end(key)
        cache_stats["hits"] += 1
    return audio


def _cache_put(key: tuple, audio: bytes) -> None:
    global _cache_bytes
    if key in _cache or not audio or len(audio) > CACHE_MAX_BYTES // 4:
        return
    _cache[key] = audio
    _cache_bytes += len(audio)
    while _cache and (len(_cache) > CACHE_MAX_ENTRIES or _cache_bytes > CACHE_MAX_BYTES):
        _, evicted = _cache.popitem(last=False)
        _cache_bytes -= len(evicted)


async def synthesize_speech(
    text: str,
    voice: str = None,
    tone: str = "natural",
    language: str = None,
    voice_pref: str = None,
    speed: float = 1.0,
) -> bytes:
    """Speaks text with a cache, a timeout and a retry. Returns b"" when the voice service is
    down (the browser then reads the reply aloud), and never blocks a reply for long."""
    key = (text.strip(), voice, tone, (language or "").split("-")[0], voice_pref, round(speed, 2))
    cached = _cache_get(key)
    if cached is not None:
        return cached
    cache_stats["misses"] += 1
    if tts_health.paused:
        return b""
    last_error: BaseException | None = None
    for attempt in range(TTS_RETRIES + 1):
        try:
            audio = await asyncio.wait_for(
                _synthesize_once(text, voice=voice, tone=tone, language=language, voice_pref=voice_pref, speed=speed), TTS_TIMEOUT_SECONDS
            )
            if audio:
                tts_health.record_ok()
                _cache_put(key, audio)
            return audio
        except asyncio.CancelledError:
            raise
        except Exception as error:
            last_error = error
            logger.warning("TTS attempt %d failed: %s: %s", attempt + 1, type(error).__name__, error)
    tts_health.record_failure(last_error)
    kind, fix = tts_health.last_error
    logger.error("TTS failed (%s): %s", kind, fix)
    raise last_error


async def probe_tts() -> tuple[bool, str, str]:
    """Speaks one word to check the voice service. Returns (ok, kind, advice)."""
    try:
        audio = await asyncio.wait_for(_synthesize_once("Hello", language="en-IN"), TTS_TIMEOUT_SECONDS)
        if audio:
            tts_health.record_ok()
            return True, "ok", ""
        return False, "no_audio", classify_tts_error(Exception("No audio was received"))[1]
    except Exception as error:
        kind, fix = classify_tts_error(error)
        return False, kind, fix


# Fixed lines that are spoken often; they are prepared at startup so they play at once.
# Keep identical to WAKE_GREETINGS in frontend/src/App.jsx (a test checks this).
WAKE_GREETINGS = {
    "en-IN": [
        "Hey there! I'm Chikki. I'm here to help you learn about Akash - what would you like to know?",
        "Hi! Great to have you here. I'm Chikki, Akash's AI assistant. Ask me anything about him.",
        "Hey, I'm listening! I'm Chikki - happy to tell you about Akash's experience, skills, or projects.",
    ],
    "te-IN": [
        "నమస్కారం! నేను చిక్కీని. ఆకాశ్ అనుభవం, స్కిల్స్ లేదా ప్రాజెక్ట్‌ల గురించి మీరు నన్ను అడగవచ్చు.",
        "హలో! నేను చిక్కీ. ఆకాశ్ కెరీర్ మరియు ప్రాజెక్ట్స్ గురించి ఏం తెలుసుకోవాలనుకుంటున్నారు?",
    ],
    "hi-IN": [
        "नमस्ते! मैं चिक्की हूँ। आकाश के अनुभव, स्किल्स या प्रोजेक्ट्स के बारे में आप कुछ भी पूछ सकते हैं।",
        "हेलो! मैं चिक्की, आकाश की AI असिस्टेंट। बताइए मैं आपकी क्या मदद कर सकती हूँ?",
    ],
}


async def prewarm_cache() -> int:
    """Prepares the greeting audio in the background. Never raises; returns how many were stored."""
    stored = 0
    for language, lines in WAKE_GREETINGS.items():
        for line in lines:
            try:
                if await synthesize_speech(line, tone=speech_tone(reply=line), language=language):
                    stored += 1
            except Exception:
                logger.info("Could not prepare greeting audio for %s", language)
                return stored  # service is struggling; do not keep hammering it
    return stored
