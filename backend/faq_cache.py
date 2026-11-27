"""Instant answers for the questions visitors ask most.

The starter questions on the start screen and the interview-mode questions are asked again and again.
The first time one is answered, the model's full reply is kept (including its hidden mood, action and
follow-up tags) and played back for later visitors without calling a model, so it appears at once and
costs no AI quota. A stored reply is dropped when the resume changes, and after a few hours.

Nothing is stored for jokes, for "tell me more" requests or for any question that is not on the list.
Replies that the resume check had to edit are never stored.
"""

import hashlib
import re
import threading
import time

TTL_SECONDS = 6 * 60 * 60
MAX_ENTRIES = 200

# Keep identical to QUICK_PROMPTS in frontend/src/App.jsx and the questions in frontend/src/interview.js
# (a test checks that every line here appears in those files). Jokes are left out on purpose.
FAQ_QUESTIONS = [
    # start-screen chips
    "Tell me about Akash's strongest AI project.",
    "Why should a company hire Akash?",
    "Explain Akash's technical skills simply.",
    "ఆకాశ్ ప్రాజెక్ట్స్ గురించి చెప్పు.",
    "కంపెనీలు ఆకాశ్‌ను ఎందుకు హైర్ చేసుకోవాలి?",
    "ఆకాశ్ టెక్నికల్ స్కిల్స్ వివరించు.",
    "आकाश के सबसे अच्छे AI प्रोजेक्ट के बारे में बताओ।",
    "कंपनियों को आकाश को क्यों हायर करना चाहिए?",
    "आकाश की टेक्निकल स्किल्स बताओ।",
    # interview mode
    "What backend systems has Akash built?",
    "How does he design real-time APIs with FastAPI and WebSockets?",
    "How does he handle security and reliability?",
    "What databases and data pipelines has he worked with?",
    "How does he test and monitor services?",
    "What full-stack projects has Akash built?",
    "How does he build React front ends?",
    "How does he connect a front end to an AI back end?",
    "Tell me about a project he shipped end to end.",
    "How does he approach performance and user experience?",
    "What is Akash's QA and test automation experience?",
    "How has he used Selenium and BDD?",
    "How did he validate ETL data pipelines?",
    "How does he use AI to speed up testing?",
    "What impact did his automation work have?",
    "How does he build and evaluate LLM agents?",
    "What was the hardest problem he solved with LangGraph?",
    "How does he keep AI answers reliable and grounded?",
    "How does he work with cloud and enterprise systems?",
]


def normalize(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower()).strip(" ?!.।")


_FAQ_KEYS = {normalize(q) for q in FAQ_QUESTIONS}


def is_faq(question: str) -> bool:
    return normalize(question) in _FAQ_KEYS


def resume_fingerprint(resume_text: str) -> str:
    return hashlib.sha1(resume_text.encode("utf-8")).hexdigest()[:12]


class FaqCache:
    def __init__(self, ttl: float = TTL_SECONDS, max_entries: int = MAX_ENTRIES, clock=time.monotonic):
        self._items: dict[tuple, tuple[float, str]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl
        self._max = max_entries
        self._clock = clock
        self.hits = 0
        self.misses = 0

    @staticmethod
    def _key(question: str, language: str, voice_mode: bool, fingerprint: str) -> tuple:
        return (normalize(question), language, bool(voice_mode), fingerprint)

    def get(self, question: str, language: str, voice_mode: bool, fingerprint: str) -> str | None:
        if not is_faq(question):
            return None
        key = self._key(question, language, voice_mode, fingerprint)
        with self._lock:
            entry = self._items.get(key)
            if entry and self._clock() - entry[0] <= self._ttl:
                self.hits += 1
                return entry[1]
            if entry:
                del self._items[key]
            self.misses += 1
        return None

    def put(self, question: str, language: str, voice_mode: bool, fingerprint: str, raw_reply: str) -> bool:
        reply = raw_reply.strip()
        # A reply cut off mid-sentence (a provider dropping the stream) must never be kept.
        if not is_faq(question) or len(reply) < 20 or reply[-1] not in ".!?।॥]|)\"'":
            return False
        key = self._key(question, language, voice_mode, fingerprint)
        with self._lock:
            if len(self._items) >= self._max:
                oldest = min(self._items, key=lambda k: self._items[k][0])
                del self._items[oldest]
            self._items[key] = (self._clock(), raw_reply)
        return True

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


faq_cache = FaqCache()


def replay_chunks(text: str, size: int = 28):
    """Splits a stored reply into small pieces, as if it were streaming from a model."""
    for start in range(0, len(text), size):
        yield text[start:start + size]
