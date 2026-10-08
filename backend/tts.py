import html
import os
import re

import edge_tts


# Strictly Female Neural Voices Only
FEMALE_VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",  # Indian English (Female)
    "hi": "hi-IN-SwaraNeural",   # Hindi (Female)
    "te": "te-IN-ShrutiNeural",  # Telugu (Female)
}

DEFAULT_FEMALE_VOICE = "en-IN-NeerjaNeural"

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


async def synthesize_speech(
    text: str,
    voice: str = None,
    tone: str = "natural",
    language: str = None,
) -> bytes:
    """
    Synthesizes speech using strictly female neural voices (Neerja, Swara, Shruti).
    """
    clean_text = clean_for_speech(text)
    if not clean_text:
        return b""

    # Detect language and guarantee a female voice selection
    lang = language.split("-")[0].lower() if language else detect_language(clean_text)
    selected_voice = voice or FEMALE_VOICE_MAP.get(lang, DEFAULT_FEMALE_VOICE)

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
        clean_text,
        selected_voice,
        rate=config["rate"],
        pitch=config["pitch"],
    )

    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    return b"".join(audio_chunks)