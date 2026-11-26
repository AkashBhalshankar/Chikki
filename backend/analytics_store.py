"""Usage analytics: one row per conversation turn (and resume download).

Stores the question text (truncated) but no IP address or other identity.
"""

import logging
import sqlite3
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from feedback_store import get_connection
from knowledge import tokenize

logger = logging.getLogger("chikki.analytics")

TOPIC_STOP = {"know", "tell", "give", "explain", "show", "get", "like", "also", "using", "work", "worked"}


def init_events_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            at TEXT NOT NULL,
            type TEXT NOT NULL,
            question TEXT,
            language TEXT,
            mode TEXT,
            provider TEXT,
            latency_ms INTEGER,
            first_token_ms INTEGER,
            ok INTEGER NOT NULL DEFAULT 1,
            error_kind TEXT,
            source_count INTEGER NOT NULL DEFAULT 0,
            is_joke INTEGER NOT NULL DEFAULT 0,
            blocked INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    try:  # databases created before the guard existed
        conn.execute("ALTER TABLE events ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_at ON events(at)")


def record_event(
    event_type: str,
    question: str = "",
    language: Optional[str] = None,
    mode: Optional[str] = None,
    provider: Optional[str] = None,
    latency_ms: Optional[int] = None,
    first_token_ms: Optional[int] = None,
    ok: bool = True,
    error_kind: Optional[str] = None,
    source_count: int = 0,
    is_joke: bool = False,
    blocked: int = 0,
) -> None:
    try:
        with get_connection() as conn:
            init_events_table(conn)
            conn.execute(
                "INSERT INTO events (id, at, type, question, language, mode, provider, latency_ms, "
                "first_token_ms, ok, error_kind, source_count, is_joke, blocked) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    f"ev_{uuid.uuid4().hex}",
                    datetime.now(timezone.utc).isoformat(),
                    event_type,
                    question.strip()[:300],
                    language,
                    mode,
                    provider,
                    latency_ms,
                    first_token_ms,
                    int(ok),
                    error_kind,
                    source_count,
                    int(is_joke),
                    blocked,
                ),
            )
    except sqlite3.Error:
        logger.exception("Failed to record analytics event")


def _percentile(values: list[int], pct: float) -> Optional[int]:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(pct * (len(ordered) - 1))))]


def _normalize(question: str) -> str:
    return " ".join(question.lower().strip(" ?!.").split())


def summary(days: int = 30) -> Dict[str, Any]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        with get_connection() as conn:
            init_events_table(conn)
            rows = [dict(r) for r in conn.execute("SELECT * FROM events WHERE at >= ? ORDER BY at", (since,))]
            contacts = conn.execute("SELECT COUNT(*) FROM contacts WHERE at >= ?", (since,)).fetchone()[0]
    except sqlite3.Error:
        logger.exception("Failed to compute analytics")
        rows, contacts = [], 0

    turns = [r for r in rows if r["type"] == "turn"]
    downloads = [r for r in rows if r["type"] == "resume_download"]
    matches = [r for r in rows if r["type"] == "jd_match" and r["ok"]]
    ok_turns = [r for r in turns if r["ok"]]
    latencies = [r["latency_ms"] for r in ok_turns if r["latency_ms"] is not None]
    first_tokens = [r["first_token_ms"] for r in ok_turns if r["first_token_ms"] is not None]

    per_day = Counter(r["at"][:10] for r in turns)
    start = datetime.now(timezone.utc).date() - timedelta(days=days - 1)
    daily = [
        {"date": (start + timedelta(days=i)).isoformat(), "turns": per_day.get((start + timedelta(days=i)).isoformat(), 0)}
        for i in range(days)
    ]

    questions = [r for r in turns if r["question"] and not r["is_joke"]]
    top_questions = Counter(_normalize(r["question"]) for r in questions).most_common(10)
    topics = Counter(
        token for r in questions for token in set(tokenize(r["question"])) if token not in TOPIC_STOP and len(token) > 2
    ).most_common(12)
    gaps = Counter(_normalize(r["question"]) for r in questions if r["ok"] and r["source_count"] == 0).most_common(10)

    return {
        "days": days,
        "totals": {
            "turns": len(turns),
            "failed_turns": len(turns) - len(ok_turns),
            "resume_downloads": len(downloads),
            "jd_matches": len(matches),
            "contact_messages": contacts,
            "jokes": sum(1 for r in turns if r["is_joke"]),
            "blocked_claims": sum(r["blocked"] for r in turns),
        },
        "latency_ms": {
            "avg": int(sum(latencies) / len(latencies)) if latencies else None,
            "p50": _percentile(latencies, 0.5),
            "p95": _percentile(latencies, 0.95),
            "first_token_p50": _percentile(first_tokens, 0.5),
        },
        "daily": daily,
        "languages": dict(Counter(r["language"] or "unknown" for r in turns)),
        "modes": dict(Counter(r["mode"] or "unknown" for r in turns)),
        "providers": dict(Counter(r["provider"] for r in ok_turns if r["provider"])),
        "failures": dict(Counter(r["error_kind"] or "unknown" for r in turns if not r["ok"])),
        "top_questions": [{"question": q, "count": c} for q, c in top_questions],
        "top_topics": [{"topic": t, "count": c} for t, c in topics],
        "knowledge_gaps": [{"question": q, "count": c} for q, c in gaps],
    }
