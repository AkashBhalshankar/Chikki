"""Request guards: admin authentication, rate limiting, and input caps."""

import hmac
import logging
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request, WebSocket

logger = logging.getLogger("chikki.security")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# Input size caps (characters).
MAX_MESSAGE_CHARS = _int_env("MAX_MESSAGE_CHARS", 1000)
MAX_TTS_CHARS = _int_env("MAX_TTS_CHARS", 1500)
MAX_HISTORY_TURNS = 12
MAX_HISTORY_TURN_CHARS = 2000
MAX_JOKE_HISTORY = 10
MAX_JOKE_CHARS = 300
MAX_WS_CONNECTIONS_PER_IP = _int_env("MAX_WS_CONNECTIONS_PER_IP", 3)


class RateLimiter:
    """In-memory sliding-window limiter keyed by client identifier.

    Suitable for a single backend instance (the Render deployment). Counters
    reset on restart, which is acceptable for abuse protection.
    """

    def __init__(self, limit: int, window_seconds: float, clock=time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            if len(self._hits) > 10_000:
                self._prune(now)
            return True

    def _prune(self, now: float) -> None:
        stale = [key for key, hits in self._hits.items() if not hits or now - hits[-1] >= self.window]
        for key in stale:
            del self._hits[key]


# Per-IP limits. Tunable through environment variables.
chat_limiter = RateLimiter(_int_env("RATE_LIMIT_CHAT_PER_MIN", 20), 60)
tts_limiter = RateLimiter(_int_env("RATE_LIMIT_TTS_PER_MIN", 30), 60)
resume_limiter = RateLimiter(_int_env("RATE_LIMIT_RESUME_PER_MIN", 6), 60)
feedback_limiter = RateLimiter(_int_env("RATE_LIMIT_FEEDBACK_PER_MIN", 20), 60)
match_limiter = RateLimiter(_int_env("RATE_LIMIT_MATCH_PER_HOUR", 6), 3600)
contact_limiter = RateLimiter(_int_env("RATE_LIMIT_CONTACT_PER_HOUR", 5), 3600)


class ConnectionTracker:
    """Caps concurrent WebSocket connections per client IP."""

    def __init__(self, max_per_key: int):
        self.max_per_key = max_per_key
        self._counts: dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    def acquire(self, key: str) -> bool:
        with self._lock:
            if self._counts[key] >= self.max_per_key:
                return False
            self._counts[key] += 1
            return True

    def release(self, key: str) -> None:
        with self._lock:
            self._counts[key] -= 1
            if self._counts[key] <= 0:
                self._counts.pop(key, None)


ws_connections = ConnectionTracker(MAX_WS_CONNECTIONS_PER_IP)


def client_ip(conn: Request | WebSocket) -> str:
    """Best-effort client IP. Render terminates TLS at a proxy and sets X-Forwarded-For."""
    forwarded = conn.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return conn.client.host if conn.client else "unknown"


def enforce_rate_limit(limiter: RateLimiter, request: Request) -> None:
    ip = client_ip(request)
    if not limiter.allow(ip):
        logger.warning("Rate limit exceeded for %s on %s", ip, request.url.path)
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """Protects admin-only routes. Fails closed when ADMIN_TOKEN is not configured."""
    expected = os.getenv("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Admin access is not configured on this server.")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing admin token.")


def sanitize_history(incoming: object) -> list[dict]:
    if not isinstance(incoming, list):
        return []
    cleaned = [
        {"role": turn["role"], "content": turn["content"].strip()[:MAX_HISTORY_TURN_CHARS]}
        for turn in incoming[-MAX_HISTORY_TURNS * 2:]
        if isinstance(turn, dict)
        and turn.get("role") in {"user", "assistant"}
        and isinstance(turn.get("content"), str)
        and turn["content"].strip()
    ]
    return cleaned[-MAX_HISTORY_TURNS:]


def sanitize_jokes(incoming: object) -> list[str]:
    if not isinstance(incoming, list):
        return []
    return [
        joke.strip()[:MAX_JOKE_CHARS]
        for joke in incoming[-MAX_JOKE_HISTORY:]
        if isinstance(joke, str) and joke.strip()
    ]
