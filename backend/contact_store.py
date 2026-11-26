"""Visitor contact messages ("Leave a message for Akash").

Messages are stored in the same SQLite database as feedback. Optional
notifications are sent to:
  * Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
  * Any webhook: CONTACT_WEBHOOK_URL (JSON body with "text" and "content",
    which covers Slack- and Discord-style incoming webhooks)
"""

import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests

from feedback_store import get_connection
from notifier import channels_configured, send_notification

logger = logging.getLogger("chikki.contact")

CONTACT_COLUMNS = ("id", "at", "name", "email", "company", "message", "topics", "notified")


def save_contact(name: str, email: str, company: str, message: str, topics: str) -> Dict[str, Any]:
    entry = {
        "id": f"ct_{uuid.uuid4().hex}",
        "at": datetime.now(timezone.utc).isoformat(),
        "name": name.strip(),
        "email": email.strip(),
        "company": company.strip() or None,
        "message": message.strip(),
        "topics": topics.strip() or None,
        "notified": 0,
    }
    with get_connection() as conn:
        conn.execute(
            f"INSERT INTO contacts ({', '.join(CONTACT_COLUMNS)}) VALUES ({', '.join('?' * len(CONTACT_COLUMNS))})",
            tuple(entry[column] for column in CONTACT_COLUMNS),
        )
    return entry


def read_contacts(limit: int = 50) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            rows = conn.execute(
                f"SELECT {', '.join(CONTACT_COLUMNS)} FROM contacts ORDER BY at DESC LIMIT ?", (limit,)
            )
            return [dict(row) for row in rows]
    except sqlite3.Error:
        logger.exception("Failed to read contact messages")
        return []


def _format_notification(entry: Dict[str, Any]) -> str:
    lines = [
        "New message for Akash via Chikki",
        f"From: {entry['name']} <{entry['email']}>",
    ]
    if entry.get("company"):
        lines.append(f"Company: {entry['company']}")
    if entry.get("topics"):
        lines.append(f"Asked about: {entry['topics']}")
    lines += ["", entry["message"]]
    return "\n".join(lines)


def notify_contact(entry: Dict[str, Any]) -> bool:
    """Sends the notification. Runs as a background task; never raises."""
    delivered = send_notification(
        _format_notification(entry),
        subject=f"New message for Akash from {entry['name']}",
        reply_to=entry["email"],
    )
    if delivered:
        try:
            with get_connection() as conn:
                conn.execute("UPDATE contacts SET notified = 1 WHERE id = ?", (entry["id"],))
        except sqlite3.Error:
            logger.exception("Failed to mark contact as notified")
    elif channels_configured():
        logger.warning("Contact %s stored but no notification was delivered", entry["id"])
    return delivered
