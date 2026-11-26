"""Outbound notifications to the site owner.

Channels (each is used only when configured):
  Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
  Email:    RESEND_API_KEY + CONTACT_TO (comma separated), optional CONTACT_FROM
  Webhook:  CONTACT_WEBHOOK_URL (JSON body with "text" and "content", which
            covers Slack- and Discord-style incoming webhooks)

Resend only allows the default sender (onboarding@resend.dev) to email the
Resend account's own address. To send to anyone else, verify a domain in
Resend and set CONTACT_FROM to an address on it.
"""

import logging
import os

import requests

logger = logging.getLogger("chikki.notifier")

DEFAULT_FROM = "Chikki <onboarding@resend.dev>"
RESEND_URL = "https://api.resend.com/emails"


def _resend_key() -> str:
    # Accept both spellings: environment variable names are case-sensitive on Linux hosts.
    return os.getenv("RESEND_API_KEY") or os.getenv("Resend_API_KEY") or ""


def _recipients() -> list[str]:
    return [address.strip() for address in os.getenv("CONTACT_TO", "").split(",") if address.strip()]


def email_configured() -> bool:
    return bool(_resend_key() and _recipients())


def telegram_configured() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID"))


def channels_configured() -> bool:
    return bool(telegram_configured() or email_configured() or os.getenv("CONTACT_WEBHOOK_URL"))


def _send_telegram(text: str) -> bool:
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{os.getenv('TELEGRAM_BOT_TOKEN')}/sendMessage",
            json={"chat_id": os.getenv("TELEGRAM_CHAT_ID"), "text": text[:4000], "disable_web_page_preview": True},
            timeout=10,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as error:
        # Do not log the URL: it contains the bot token.
        logger.warning("Telegram notification failed: %s", type(error).__name__)
        return False


def _send_email(subject: str, text: str, reply_to: str | None) -> bool:
    payload = {
        "from": os.getenv("CONTACT_FROM") or DEFAULT_FROM,
        "to": _recipients(),
        "subject": subject[:200],
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = reply_to  # replying to the email goes straight to the visitor
    try:
        response = requests.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {_resend_key()}"},
            json=payload,
            timeout=10,
        )
        if not response.ok:
            logger.warning("Resend email failed (%s): %s", response.status_code, response.text[:200])
            return False
        return True
    except requests.RequestException as error:
        logger.warning("Resend email failed: %s", type(error).__name__)
        return False


def _send_webhook(text: str) -> bool:
    try:
        response = requests.post(
            os.getenv("CONTACT_WEBHOOK_URL", ""), json={"text": text, "content": text[:2000]}, timeout=10
        )
        response.raise_for_status()
        return True
    except requests.RequestException as error:
        logger.warning("Webhook notification failed: %s", type(error).__name__)
        return False


def send_all(text: str, subject: str = "Chikki notification", reply_to: str | None = None) -> dict[str, bool]:
    """Sends to every configured channel. Returns {channel: succeeded} for configured channels only. Never raises."""
    results: dict[str, bool] = {}
    if telegram_configured():
        results["telegram"] = _send_telegram(text)
    if email_configured():
        results["email"] = _send_email(subject, text, reply_to)
    if os.getenv("CONTACT_WEBHOOK_URL"):
        results["webhook"] = _send_webhook(text)
    return results


def send_notification(text: str, subject: str = "Chikki notification", reply_to: str | None = None) -> bool:
    """True if at least one channel delivered the message."""
    return any(send_all(text, subject, reply_to).values())
