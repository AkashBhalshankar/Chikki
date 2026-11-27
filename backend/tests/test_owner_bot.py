import pytest

import owner_bot as ob
from analytics_store import record_event


@pytest.fixture
def bot(feedback_db, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "42")
    monkeypatch.setattr("knowledge.knowledge_base.refresh", lambda: None)
    return ob.OwnerBot()


def seed():
    for _ in range(2):
        record_event("turn", "Does he know Rust?", "en-IN", "text", "groq", 100, 50, True, None, 0, False, 0, "AAAA")
    record_event("turn", "Does he speak German?", "en-IN", "text", "groq", 100, 50, True, None, 0, False, 0, "BBBB")


def test_help_and_unknown_commands(bot):
    assert "/gaps" in bot.handle_command("/help")
    assert "/gaps" in bot.handle_command("/start")
    assert "did not understand" in bot.handle_command("/nonsense")


def test_stats_reports_numbers(bot):
    seed()
    text = bot.handle_command("/stats 30")
    assert "Last 30 days" in text and "Questions: 3" in text


def test_gaps_then_answer_flow(bot):
    seed()
    listing = bot.handle_command("/gaps")
    assert "1. Does he know Rust? (asked 2x)" in listing and "2. Does he speak German?" in listing
    assert "Saved" in bot.handle_command("/answer 1 He has not used Rust professionally.")
    again = bot.handle_command("/gaps")
    assert "Rust" not in again and "German" in again  # the answered one is gone


def test_answer_needs_a_valid_number_and_text(bot):
    seed()
    assert "Use:" in bot.handle_command("/answer")
    assert "Use:" in bot.handle_command("/answer x something")
    assert "do not have that number" in bot.handle_command("/answer 1 some text")  # no /gaps sent yet
    bot.handle_command("/gaps")
    assert "do not have that number" in bot.handle_command("/answer 9 some text")


def test_only_the_owner_chat_is_answered(bot):
    sent = []
    bot.process_update({"update_id": 10, "message": {"chat": {"id": 999}, "text": "/stats"}}, sent.append)
    bot.process_update({"update_id": 11, "message": {"chat": {"id": 42}, "text": "hello there"}}, sent.append)
    assert sent == []
    bot.process_update({"update_id": 12, "message": {"chat": {"id": 42}, "text": "/help"}}, sent.append)
    assert len(sent) == 1 and bot._offset == 13


def test_bot_is_off_without_credentials_or_when_disabled(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert not ob.OwnerBot.enabled()
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "1:a")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "1")
    assert not ob.OwnerBot.enabled()  # opt-in: a second server listening would fight the first
    monkeypatch.setenv("TELEGRAM_COMMANDS", "on")
    assert ob.OwnerBot.enabled()
    monkeypatch.setenv("TELEGRAM_COMMANDS", "off")
    assert not ob.OwnerBot.enabled()
