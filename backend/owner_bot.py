"""Manage Chikki from Telegram, from your own chat only.

Commands:
  /stats [days]     the week's numbers (visitors, questions, resume downloads, messages)
  /gaps             questions Chikki could not answer, numbered
  /answer N text    save the true answer to gap number N; Chikki uses it from then on
  /health           run the health check now
  /help             this list

It polls Telegram for new messages (no public URL needed) and only ever answers the chat set in
TELEGRAM_CHAT_ID. It is off unless TELEGRAM_COMMANDS=on, and should be on for ONE server only (your
deployed backend): Telegram lets only one program listen to a bot at a time.
"""

import logging
import os
import threading
import time

import requests

logger = logging.getLogger("chikki.ownerbot")

HELP = (
    "Chikki owner commands:\n"
    "/stats [days] - the numbers for the last 7 days (or N days)\n"
    "/gaps - questions I could not answer, numbered\n"
    "/answer N your answer - teach me the answer to gap N\n"
    "/health - run the health check now\n"
    "/help - this list"
)


def open_gaps() -> list[dict]:
    """Questions Chikki could not answer, minus the ones the owner already answered."""
    from analytics_store import unanswered
    from owner_notes import list_notes

    answered = {" ".join(n["question"].lower().strip(" ?!.").split()) for n in list_notes()}
    return [gap for gap in unanswered() if gap["key"] not in answered]


def _stats_text(days: int) -> str:
    from analytics_store import summary

    data = summary(days)
    totals, funnel, latency = data["totals"], data.get("funnel", {}), data["latency_ms"]
    lines = [f"Last {days} days"]
    if funnel.get("visitors"):
        lines.append(f"Visitors: {funnel['visitors']} ({funnel['asked']} asked a question)")
    lines += [
        f"Questions: {totals['turns']} (failed {totals['failed_turns']})",
        f"Resume downloads: {totals['resume_downloads']}",
        f"Messages for you: {totals['contact_messages']}",
        f"Role-fit checks: {totals['jd_matches']}",
    ]
    if latency["p50"] is not None:
        lines.append(f"Median reply: {latency['p50'] / 1000:.1f}s")
    top = data["top_questions"][:3]
    if top:
        lines.append("Top questions:\n" + "\n".join(f"- {q['question']} ({q['count']})" for q in top))
    return "\n".join(lines)


class OwnerBot:
    def __init__(self):
        self._last_gaps: list[dict] = []
        self._offset = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------------ commands
    def handle_command(self, text: str) -> str:
        parts = text.strip().split(None, 2)
        command = parts[0].lower().split("@")[0] if parts else ""
        try:
            if command in ("/start", "/help"):
                return HELP
            if command == "/stats":
                days = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 7
                return _stats_text(max(1, min(days, 90)))
            if command == "/gaps":
                self._last_gaps = open_gaps()[:10]
                if not self._last_gaps:
                    return "Nothing waiting. I answered every question I was asked."
                body = "\n".join(f"{i}. {g['question']} (asked {g['count']}x)" for i, g in enumerate(self._last_gaps, 1))
                return f"Questions I could not answer:\n{body}\n\nReply with /answer N your answer"
            if command == "/answer":
                return self._answer(parts)
            if command == "/health":
                from digest import check_health

                problems = check_health()
                return "All good." if not problems else "Needs attention:\n" + "\n".join(f"- {p}" for p in problems)
        except Exception:
            logger.exception("Owner command failed: %s", command)
            return "That did not work. Check the server logs."
        return "I did not understand that. Send /help for the list."

    def _answer(self, parts: list[str]) -> str:
        if len(parts) < 3 or not parts[1].isdigit():
            return "Use: /answer N your answer (send /gaps first to see the numbers)."
        index = int(parts[1])
        if not (1 <= index <= len(self._last_gaps)):
            return "I do not have that number. Send /gaps to refresh the list."
        gap = self._last_gaps[index - 1]
        answer = parts[2].strip()
        if len(answer) < 3:
            return "That answer is too short."
        from knowledge import knowledge_base
        from owner_notes import add_note

        add_note(gap["question"], answer)
        knowledge_base.refresh()
        self._last_gaps.pop(index - 1)
        return f"Saved. From now on I will answer \"{gap['question']}\" with that."

    # ------------------------------------------------------------------ Telegram plumbing
    @staticmethod
    def enabled() -> bool:
        return bool(
            os.getenv("TELEGRAM_BOT_TOKEN")
            and os.getenv("TELEGRAM_CHAT_ID")
            and os.getenv("TELEGRAM_COMMANDS", "off").lower() in {"on", "true", "1"}
        )

    def process_update(self, update: dict, reply) -> None:
        """Handles one Telegram update. Messages from any chat other than the owner's are ignored."""
        self._offset = max(self._offset, int(update.get("update_id", 0)) + 1)
        message = update.get("message") or {}
        text = message.get("text") or ""
        if str(message.get("chat", {}).get("id")) != str(os.getenv("TELEGRAM_CHAT_ID")) or not text.startswith("/"):
            return
        reply(self.handle_command(text))

    def _send(self, text: str) -> None:
        try:
            requests.post(
                f"https://api.telegram.org/bot{os.getenv('TELEGRAM_BOT_TOKEN')}/sendMessage",
                json={"chat_id": os.getenv("TELEGRAM_CHAT_ID"), "text": text[:4000]},
                timeout=10,
            )
        except requests.RequestException:
            logger.warning("Could not send the Telegram reply")

    def _loop(self) -> None:
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        failures = 0
        while not self._stop.is_set():
            try:
                response = requests.get(
                    f"https://api.telegram.org/bot{token}/getUpdates",
                    params={"timeout": 25, "offset": self._offset, "allowed_updates": '["message"]'},
                    timeout=35,
                )
                if response.status_code == 409:
                    logger.warning("Telegram says another program is listening to this bot; will retry in a minute.")
                    self._stop.wait(60)
                    continue
                response.raise_for_status()
                failures = 0
                for update in response.json().get("result", []):
                    self.process_update(update, self._send)
            except (requests.RequestException, ValueError):
                failures += 1
                self._stop.wait(min(60, 2 ** min(failures, 6)))

    def start(self) -> bool:
        if not self.enabled() or (self._thread and self._thread.is_alive()):
            return False
        self._thread = threading.Thread(target=self._loop, name="owner-bot", daemon=True)
        self._thread.start()
        logger.info("Telegram owner commands are on (only your chat is answered).")
        return True

    def stop(self) -> None:
        self._stop.set()


owner_bot = OwnerBot()
