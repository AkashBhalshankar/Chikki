"""Live Telegram feed of visitor conversations, so you can see what recruiters ask.

Off by default. Enable it on the deployed backend with NOTIFY_CONVERSATIONS=true
(leave it off locally so your own testing does not ping you).

Each turn sends one message with the visitor's full question and a one-line
answer. A visitor's first message makes a sound; later messages are silent.
Visitors are grouped by a short code derived from their browser session id; no
IP address or identity is used.

Sending happens on one background thread, at most about one message per second,
with an hourly cap (NOTIFY_CONVERSATIONS_PER_HOUR, default 60) so a bot cannot
flood your phone. When the cap is hit you get one notice and the count of
suppressed messages is shown on the next message.
"""

import hashlib
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from notifier import route_for, send_notification

logger = logging.getLogger("chikki.conversations")

IST = timezone(timedelta(hours=5, minutes=30), "IST")
LANGUAGES = {"en-IN": "English", "hi-IN": "Hindi", "te-IN": "Telugu"}
MAX_QUESTION_CHARS = 1500
MAX_ANSWER_CHARS = 160
MIN_SECONDS_BETWEEN_SENDS = 1.1
SESSION_TTL_SECONDS = 6 * 3600


def enabled() -> bool:
    return os.getenv("NOTIFY_CONVERSATIONS", "").strip().lower() in {"1", "true", "yes", "on"}


def visitor_code(session_id: str) -> str:
    """Short, stable, anonymous code for a browser session (for example A3F9)."""
    return hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:4].upper()


def one_line_answer(answer: str, limit: int = MAX_ANSWER_CHARS) -> str:
    """First sentence of the answer on a single line, cut to the limit."""
    text = re.sub(r"\s+", " ", answer or "").strip()
    if not text:
        return ""
    first = re.split(r"(?<=[.!?।॥])\s", text, maxsplit=1)[0]
    if len(first) > limit:
        first = first[: limit - 1].rstrip() + "…"
    return first


def format_message(
    code: str,
    turn: int,
    question: str,
    answer: str,
    language: str,
    mode: str,
    latency_ms: int | None,
    gap: bool,
    error_kind: str | None = None,
    suppressed: int = 0,
    now: datetime | None = None,
) -> str:
    when = (now or datetime.now(IST)).astimezone(IST).strftime("%d %b, %H:%M IST")
    header = f"🆕 New visitor #{code}" if turn == 1 else f"💬 #{code} · turn {turn}"
    label = f"{mode} · {LANGUAGES.get(language, language)}"
    lines = [header, f"Q ({label}): {question.strip()[:MAX_QUESTION_CHARS]}"]
    if error_kind:
        lines.append(f"A: (Chikki could not answer: {error_kind})")
    else:
        lines.append(f"A: {one_line_answer(answer) or '(empty)'}")
    meta = [when]
    if latency_ms is not None:
        meta.append(f"⏱ {latency_ms / 1000:.1f}s")
    lines.append(" · ".join(meta))
    if gap:
        lines.append("⚠️ Knowledge gap: nothing in the resume or write-ups matched this question")
    if suppressed:
        lines.append(f"(+{suppressed} messages skipped since the hourly limit was reached)")
    return "\n".join(lines)


class ConversationAlerts:
    def __init__(self, sender=send_notification, clock=time.monotonic, sleep=time.sleep):
        self._sender = sender
        self._clock = clock
        self._sleep = sleep
        self._lock = threading.Lock()
        self._sessions: dict[str, tuple[int, float]] = {}  # code -> (turns so far, last seen)
        self._window_start = clock()
        self._sent_in_window = 0
        self._suppressed = 0
        self._notified_cap = False
        self._last_send = 0.0
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chikki-alerts")

    @staticmethod
    def _limit() -> int:
        try:
            return int(os.getenv("NOTIFY_CONVERSATIONS_PER_HOUR", "60"))
        except ValueError:
            return 60

    def _next_turn(self, code: str) -> int:
        now = self._clock()
        for key in [k for k, (_, seen) in self._sessions.items() if now - seen > SESSION_TTL_SECONDS]:
            del self._sessions[key]
        turns = self._sessions.get(code, (0, 0.0))[0] + 1
        self._sessions[code] = (turns, now)
        return turns

    def _admit(self) -> tuple[bool, int, bool]:
        """Applies the hourly cap. Returns (allowed, suppressed_to_report, send_cap_notice)."""
        now = self._clock()
        if now - self._window_start >= 3600:
            self._window_start, self._sent_in_window, self._notified_cap = now, 0, False
        if self._sent_in_window >= self._limit():
            self._suppressed += 1
            notice = not self._notified_cap
            self._notified_cap = True
            return False, 0, notice
        self._sent_in_window += 1
        suppressed, self._suppressed = self._suppressed, 0
        return True, suppressed, False

    def notify_turn(
        self,
        session_id: str,
        question: str,
        answer: str,
        language: str = "en-IN",
        mode: str = "text",
        latency_ms: int | None = None,
        gap: bool = False,
        error_kind: str | None = None,
    ) -> None:
        """Queues a notification and returns immediately. Never raises."""
        if not enabled() or not question.strip():
            return
        try:
            with self._lock:
                code = visitor_code(session_id or "unknown")
                turn = self._next_turn(code)
                allowed, suppressed, cap_notice = self._admit()
            if not allowed:
                if cap_notice:
                    self._pool.submit(
                        self._deliver,
                        f"⚠️ Conversation alerts paused: more than {self._limit()} messages this hour. "
                        "They are still saved in the Usage tab.",
                        False,
                    )
                return
            text = format_message(code, turn, question, answer, language, mode, latency_ms, gap, error_kind, suppressed)
            self._pool.submit(self._deliver, text, turn > 1)
        except Exception:
            logger.exception("Could not queue a conversation alert")

    def _deliver(self, text: str, silent: bool) -> None:
        try:
            wait = MIN_SECONDS_BETWEEN_SENDS - (self._clock() - self._last_send)
            if wait > 0:
                self._sleep(wait)  # stay under Telegram's per-chat rate limit
            self._last_send = self._clock()
            if not self._sender(text, subject="Chikki conversation", event="conversation", silent=silent):
                logger.warning("Conversation alert was not delivered")
        except Exception:
            logger.exception("Conversation alert failed")


alerts = ConversationAlerts()
