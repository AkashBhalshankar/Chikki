"""Weekly owner digest and operational health check."""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from ai import PROVIDERS, probe_providers
from analytics_store import summary
from contact_store import read_contacts
from feedback_store import read_feedback
from notifier import send_notification
from resume_loader import sync_drive_resume
from tts import probe_tts

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
    if totals["blocked_claims"]:
        lines.append(f"Unverified claims blocked by the resume guard: {totals['blocked_claims']}")
    if feedback:
        lines.append(f"Feedback: {liked} helpful, {len(feedback) - liked} needs improvement")
    latency = data["latency_ms"]["p50"]
    if latency is not None:
        lines.append(f"Median reply time: {latency / 1000:.1f}s")

    funnel = data.get("funnel", {})
    if funnel.get("visitors"):
        lines.append(
            f"Funnel: {funnel['visitors']} visitors, {funnel['asked']} asked a question, "
            f"{funnel['resume_downloads']} resume downloads, {funnel['messages']} messages"
        )

    visitors = data.get("visitors", {})
    if visitors.get("sessions"):
        lines.append(f"Engaged visitors (3+ questions): {visitors['engaged']} of {visitors['sessions']}")

    voice = data.get("voice", {})
    if voice.get("turns"):
        first = voice["first_audio_p50_ms"]
        lines.append(
            f"Voice: {voice['turns']} spoken turns"
            + (f", median {first / 1000:.1f}s to first sound" if first is not None else "")
            + (f", fallbacks: {sum(voice['issues'].values())}" if voice["issues"] else "")
        )

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

    # Config problems (bad key, retired model) always need action; an exhausted quota only
    # matters when no provider is left to answer.
    probes = probe_providers()
    working = [name for name, (ok, _) in probes.items() if ok]
    for name, (ok, kind) in probes.items():
        model = PROVIDERS[name]["model"]
        if kind == "model_retired":
            problems.append(f"{name}: the model '{model}' has been retired. Set a current model for it.")
        elif kind == "auth":
            problems.append(f"{name}: the API key was rejected. Check or replace the key.")
        elif not ok and not working:
            problems.append(f"{name}: not responding ({kind}).")
    if probes and not working:
        problems.append("No AI provider is answering right now, so Chikki cannot reply to visitors.")

    # Voice is the main feature, so a broken speech service is reported with its likely cause.
    tts_ok, tts_kind, tts_fix = asyncio.run(probe_tts())
    if not tts_ok:
        problems.append(f"Voice (text-to-speech) is failing [{tts_kind}]: {tts_fix}")

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
