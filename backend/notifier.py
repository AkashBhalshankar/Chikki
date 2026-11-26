"""Outbound notifications to the site owner (Telegram and/or a webhook).

Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
Webhook:  CONTACT_WEBHOOK_URL (JSON body with "text" and "content", which
          covers Slack- and Discord-style incoming webhooks)
"""

import logging
import os

import requests

logger = logging.getLogger("chikki.notifier")


def channels_configured() -> bool:
    telegram = os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID")
    return bool(telegram or os.getenv("CONTACT_WEBHOOK_URL"))


def send_notification(text: str) -> bool:
    """Sends text to every configured channel. Never raises; True if any succeeded."""
    delivered = False

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    if bot_token and chat_id:
        try:
            response = requests.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text[:4000], "disable_web_page_preview": True},
                timeout=10,
            )
            response.raise_for_status()
            delivered = True
        except requests.RequestException as error:
            # Do not log the URL: it contains the bot token.
            logger.warning("Telegram notification failed: %s", type(error).__name__)

    webhook_url = os.getenv("CONTACT_WEBHOOK_URL", "")
    if webhook_url:
        try:
            response = requests.post(webhook_url, json={"text": text, "content": text[:2000]}, timeout=10)
            response.raise_for_status()
            delivered = True
        except requests.RequestException as error:
            logger.warning("Webhook notification failed: %s", type(error).__name__)

    return delivered
