"""Weekly owner digest and operational health check."""

import logging
import os
from datetime import datetime, timedelta, timezone

from ai import PROVIDERS
from analytics_store import summary
from contact_store import read_contacts
from feedback_store import read_feedback
from notifier import send_notification
from resume_loader import sync_drive_resume

logger = logging.getLogger("chikki.digest")


def build_digest(days: int = 7) -> str:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    data = summary(days)
    totals = data["totals"]

    feedback = [f for f in read_feedback(limit=500) if f["at"] >= since]
    liked = sum(1 for f in feedback if f["value"] == "helpful")
    contacts = [c for c in read_contacts(limit=200) if c["at"] >= since]

    lines = [f"Chikki weekly digest (last {days} days)", ""]
    if not totals["turns"] and not contacts:
        lines.append("No visitor activity this period.")
        return "\n".join(lines)

    lines += [
        f"Questions asked: {totals['turns']} (failed: {totals['failed_turns']})",
        f"Messages left for you: {len(contacts)}",
        f"Role-fit checks: {totals['jd_matches']}",
        f"Resume downloads: {totals['resume_downloads']}",
    ]
    if feedback:
        lines.append(f"Feedback: {liked} helpful, {len(feedback) - liked} needs improvement")
    latency = data["latency_ms"]["p50"]
    if latency is not None:
        lines.append(f"Median reply time: {latency / 1000:.1f}s")

    if data["top_questions"]:
        lines += ["", "Top questions:"] + [f"- {q['question']} ({q['count']})" for q in data["top_questions"][:3]]
    if data["knowledge_gaps"]:
        lines += ["", "Knowledge gaps (add these to backend/knowledge):"]
        lines += [f"- {q['question']} ({q['count']})" for q in data["knowledge_gaps"][:3]]
    if contacts:
        lines += ["", "New messages:"] + [
            f"- {c['name']}{' (' + c['company'] + ')' if c['company'] else ''}: {c['email']}" for c in contacts[:5]
        ]
    return "\n".join(lines)


def send_digest(days: int = 7) -> tuple[str, bool]:
    text = build_digest(days)
    return text, send_notification(text, subject=f"Chikki weekly digest (last {days} days)", event="digest")


def check_health() -> list[str]:
    """Returns a list of problems (empty when healthy). Refreshes the Drive resume cache."""
    problems = []
    if not any(cfg.get("api_key") for cfg in PROVIDERS.values()):
        problems.append("No LLM provider API key is configured; Chikki cannot answer.")

    drive_configured = any(
        os.getenv(name) for name in ("GOOGLE_DRIVE_RESUME_URL", "GOOGLE_DRIVE_FILE_ID", "DRIVE_RESUME_URL")
    )
    if drive_configured and not sync_drive_resume():
        problems.append(
            "Google Drive resume could not be fetched; Chikki is using the bundled resume.json. "
            "Check the file is shared as 'Anyone with the link can view'."
        )
    return problems


def run_ops_check() -> tuple[list[str], bool]:
    problems = check_health()
    alerted = False
    if problems:
        logger.warning("Ops check found problems: %s", problems)
        alerted = send_notification(
            "Chikki alert\n" + "\n".join(f"- {p}" for p in problems), subject="Chikki alert: action needed", event="alert"
        )
    return problems, alerted
