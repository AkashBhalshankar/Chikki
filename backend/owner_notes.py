"""Answers the owner adds for questions Chikki could not answer.

They are stored in the database, included in the knowledge base (so retrieval and the
resume guard both allow them) and survive restarts wherever the database does.
"""

import logging
import sqlite3
import uuid
from datetime import datetime, timezone

from feedback_store import get_connection

logger = logging.getLogger("chikki.notes")


def _init(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS owner_notes (id TEXT PRIMARY KEY, at TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL)"
    )


def add_note(question: str, answer: str) -> dict:
    note = {
        "id": f"note_{uuid.uuid4().hex[:12]}",
        "at": datetime.now(timezone.utc).isoformat(),
        "question": question.strip()[:300],
        "answer": answer.strip()[:1500],
    }
    with get_connection() as conn:
        _init(conn)
        conn.execute("INSERT INTO owner_notes (id, at, question, answer) VALUES (?,?,?,?)", tuple(note.values()))
    return note


def list_notes() -> list[dict]:
    try:
        with get_connection() as conn:
            _init(conn)
            return [dict(r) for r in conn.execute("SELECT * FROM owner_notes ORDER BY at DESC")]
    except sqlite3.Error:
        logger.exception("Could not read owner notes")
        return []


def delete_note(note_id: str) -> bool:
    with get_connection() as conn:
        _init(conn)
        return conn.execute("DELETE FROM owner_notes WHERE id = ?", (note_id,)).rowcount > 0


def notes_markdown() -> str:
    """The notes as a knowledge document (one section per answer), or "" when there are none."""
    notes = list_notes()
    if not notes:
        return ""
    sections = [f"## {n['question']}\n{n['answer']}" for n in reversed(notes)]
    return "# Owner-added answers\nAnswers Akash added himself for questions visitors asked.\n\n" + "\n\n".join(sections)
