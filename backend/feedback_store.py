"""Feedback (and contact message) persistence backed by SQLite.

The database path comes from FEEDBACK_DB_PATH. On Render, point it at a
mounted persistent disk (for example /var/data/feedback.db); otherwise the
file lives on the instance's ephemeral disk and is reset on redeploy.

On first start, any legacy feedback_log.jsonl entries are imported once.
"""

import json
import logging
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("chikki.feedback")

BACKEND_DIR = Path(__file__).parent
LEGACY_JSONL = BACKEND_DIR / "feedback_log.jsonl"
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "feedback.db"

_lock = threading.Lock()
_initialized_paths: set[str] = set()

COLUMNS = ("id", "at", "value", "question", "reply", "mode", "user_comment", "trace_id", "session_id")


def _db_path() -> Path:
    return Path(os.getenv("FEEDBACK_DB_PATH") or DEFAULT_DB_PATH)


def get_connection() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5)
    conn.row_factory = sqlite3.Row
    key = str(path.resolve())
    if key not in _initialized_paths:
        with _lock:
            if key not in _initialized_paths:
                _init_schema(conn)
                _initialized_paths.add(key)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            at TEXT NOT NULL,
            value TEXT NOT NULL,
            question TEXT,
            reply TEXT,
            mode TEXT,
            user_comment TEXT,
            trace_id TEXT,
            session_id TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_at ON feedback(at)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            at TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT,
            message TEXT NOT NULL,
            topics TEXT,
            notified INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()
    _import_legacy_jsonl(conn)


def _import_legacy_jsonl(conn: sqlite3.Connection) -> None:
    if not LEGACY_JSONL.exists():
        return
    if conn.execute("SELECT COUNT(*) FROM feedback").fetchone()[0] > 0:
        return
    imported = 0
    try:
        with open(LEGACY_JSONL, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if data.get("value") not in {"helpful", "needs-improvement"}:
                    continue
                conn.execute(
                    f"INSERT OR IGNORE INTO feedback ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
                    (
                        data.get("id") or f"fb_{uuid.uuid4().hex}",
                        data.get("at") or datetime.now(timezone.utc).isoformat(),
                        data["value"],
                        data.get("question") or "",
                        data.get("reply") or "",
                        data.get("mode") or "voice",
                        (data.get("user_comment") or "").strip() or None,
                        data.get("trace_id"),
                        data.get("session_id"),
                    ),
                )
                imported += 1
        conn.commit()
        if imported:
            logger.info("Imported %d legacy feedback entries from %s", imported, LEGACY_JSONL.name)
    except OSError as error:
        logger.warning("Could not import legacy feedback log: %s", error)


def record_feedback(
    value: str,
    question: str = "",
    reply: str = "",
    mode: str = "voice",
    user_comment: Optional[str] = None,
    trace_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    entry = {
        "id": f"fb_{uuid.uuid4().hex}",
        "at": datetime.now(timezone.utc).isoformat(),
        "value": value,
        "question": question,
        "reply": reply,
        "mode": mode,
        "user_comment": user_comment.strip() if user_comment and user_comment.strip() else None,
        "trace_id": trace_id,
        "session_id": session_id,
    }
    try:
        with get_connection() as conn:
            conn.execute(
                f"INSERT INTO feedback ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
                tuple(entry[column] for column in COLUMNS),
            )
    except sqlite3.Error:
        logger.exception("Failed to store feedback")
    return entry


def read_feedback(limit: int = 50, filter_value: Optional[str] = None) -> List[Dict[str, Any]]:
    query = f"SELECT {', '.join(COLUMNS)} FROM feedback"
    params: list[Any] = []
    if filter_value:
        query += " WHERE value = ?"
        params.append(filter_value)
    query += " ORDER BY at DESC LIMIT ?"
    params.append(limit)
    try:
        with get_connection() as conn:
            return [dict(row) for row in conn.execute(query, params)]
    except sqlite3.Error:
        logger.exception("Failed to read feedback")
        return []


def feedback_analytics() -> Dict[str, Any]:
    try:
        with get_connection() as conn:
            row = conn.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(value = 'helpful'), 0) AS helpful,
                    COALESCE(SUM(value = 'needs-improvement'), 0) AS needs_improvement
                FROM feedback
                """
            ).fetchone()
    except sqlite3.Error:
        logger.exception("Failed to compute feedback analytics")
        row = {"total": 0, "helpful": 0, "needs_improvement": 0}

    total, helpful = row["total"], row["helpful"]
    return {
        "total": total,
        "helpful": helpful,
        "needs_improvement": row["needs_improvement"],
        "satisfaction_rate": f"{int((helpful / total) * 100)}%" if total else "0%",
    }
