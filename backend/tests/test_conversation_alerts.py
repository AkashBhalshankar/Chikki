from datetime import datetime

import pytest
from fastapi.testclient import TestClient

import conversation_alerts as ca
import main

NOW = datetime(2026, 11, 27, 12, 41, tzinfo=ca.IST)


def test_visitor_code_is_short_stable_and_anonymous():
    code = ca.visitor_code("session_abc")
    assert code == ca.visitor_code("session_abc") and len(code) == 4 and code == code.upper()
    assert code != ca.visitor_code("session_other")


def test_one_line_answer():
    assert ca.one_line_answer("First sentence here. Second one follows.") == "First sentence here."
    assert ca.one_line_answer("Line one\nstill the first sentence.\n\nNext.") == "Line one still the first sentence."
    assert ca.one_line_answer("x" * 300).endswith("…") and len(ca.one_line_answer("x" * 300)) == ca.MAX_ANSWER_CHARS
    assert ca.one_line_answer("") == ""


def test_message_structure_first_visitor_message():
    text = ca.format_message(
        "A3F9", 1, "Does he know LangGraph and have production experience?", "Yes. He built agents.",
        "en-IN", "voice", 1800, gap=False, now=NOW,
    )
    assert text.splitlines() == [
        "🆕 New visitor #A3F9",
        "Q (voice · English): Does he know LangGraph and have production experience?",
        "A: Yes.",
        "27 Nov, 12:41 IST · ⏱ 1.8s",
    ]


def test_full_question_is_never_shortened_like_the_answer():
    question = "word " * 150  # 750 characters
    text = ca.format_message("A3F9", 2, question, "Ok.", "en-IN", "text", None, False, now=NOW)
    assert question.strip() in text
    assert text.splitlines()[0] == "💬 #A3F9 · turn 2"


def test_gap_error_and_suppressed_lines():
    gap = ca.format_message("A3F9", 2, "q", "a", "te-IN", "text", 900, True, suppressed=4, now=NOW)
    assert "Telugu" in gap and "⚠️ Knowledge gap" in gap and "(+4 messages skipped" in gap
    failed = ca.format_message("A3F9", 1, "q", "", "en-IN", "text", 9000, False, error_kind="timeout", now=NOW)
    assert "A: (Chikki could not answer: timeout)" in failed


class Recorder:
    def __init__(self):
        self.sent = []

    def __call__(self, text, **kwargs):
        self.sent.append((text, kwargs))
        return True


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("NOTIFY_CONVERSATIONS", "true")


def make(clock=None):
    recorder = Recorder()
    now = [1000.0]
    alerts = ca.ConversationAlerts(sender=recorder, clock=clock or (lambda: now[0]), sleep=lambda s: None)
    return alerts, recorder, now


def flush(alerts):
    alerts._pool.shutdown(wait=True)


def test_disabled_by_default():
    alerts, recorder, _ = make()
    alerts.notify_turn("s1", "Hello?", "Hi.")
    flush(alerts)
    assert recorder.sent == []


def test_first_message_makes_sound_and_later_ones_are_silent(enabled):
    alerts, recorder, _ = make()
    alerts.notify_turn("s1", "first question", "Answer one.")
    alerts.notify_turn("s1", "second question", "Answer two.")
    alerts.notify_turn("s2", "another visitor", "Answer three.")
    flush(alerts)
    (t1, k1), (t2, k2), (t3, k3) = recorder.sent
    assert t1.startswith("🆕") and k1["silent"] is False and k1["event"] == "conversation"
    assert "turn 2" in t2 and k2["silent"] is True
    assert t3.startswith("🆕") and k3["silent"] is False  # a different visitor
    assert ca.visitor_code("s1") in t1 and ca.visitor_code("s2") in t3


def test_blank_questions_are_ignored(enabled):
    alerts, recorder, _ = make()
    alerts.notify_turn("s1", "   ", "x")
    flush(alerts)
    assert recorder.sent == []


def test_hourly_cap_sends_one_notice_then_reports_skipped_count(enabled, monkeypatch):
    monkeypatch.setenv("NOTIFY_CONVERSATIONS_PER_HOUR", "2")
    alerts, recorder, now = make()
    for i in range(5):
        alerts.notify_turn("s1", f"question {i}", "Answer.")
    flush(alerts)
    texts = [t for t, _ in recorder.sent]
    assert len(texts) == 3  # two messages and a single "paused" notice
    assert "Conversation alerts paused" in texts[2]

    alerts2, recorder2, now2 = make()
    monkeypatch.setenv("NOTIFY_CONVERSATIONS_PER_HOUR", "1")
    alerts2.notify_turn("s1", "q1", "a")
    alerts2.notify_turn("s1", "q2", "a")
    alerts2.notify_turn("s1", "q3", "a")
    now2[0] += 3601  # next hour
    alerts2.notify_turn("s1", "q4", "a")
    flush(alerts2)
    assert "(+2 messages skipped" in recorder2.sent[-1][0]


def test_sender_errors_never_escape(enabled):
    def boom(text, **kwargs):
        raise RuntimeError("telegram down")

    alerts = ca.ConversationAlerts(sender=boom, sleep=lambda s: None)
    alerts.notify_turn("s1", "hello", "hi")
    flush(alerts)  # must not raise


def test_sends_are_spaced_out(enabled):
    sleeps = []
    clock = [0.0]
    alerts = ca.ConversationAlerts(sender=Recorder(), clock=lambda: clock[0], sleep=sleeps.append)
    alerts.notify_turn("s1", "one", "a")
    alerts.notify_turn("s1", "two", "a")
    flush(alerts)
    assert sleeps and sleeps[0] > 0


# ---- integration through the real WebSocket handler ----

class Spy:
    def __init__(self):
        self.calls = []

    def notify_turn(self, *args, **kwargs):
        self.calls.append((args, kwargs))


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setattr(main, "sync_drive_resume", lambda: "")
    return TestClient(main.app)


def test_turn_reports_full_question_session_and_gap(client, monkeypatch):
    spy = Spy()
    monkeypatch.setattr(main, "conversation_alerts", spy)

    def fake_stream(message, history, language, previous_jokes=None, knowledge_context="", meta=None, **kwargs):
        yield "A short reply.", ""

    monkeypatch.setattr(main, "stream_chikki", fake_stream)
    question = "zzqq xxww vvbb kkjj qqpp"
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": question, "voice": False, "turn_id": "t1", "session_id": "sess-42", "language": "hi-IN"})
        while ws.receive_json()["type"] != "text":
            pass
    (args, kwargs), = spy.calls
    assert args[:3] == ("sess-42", question, "A short reply.")
    assert args[3:5] == ("hi-IN", "text")
    assert kwargs["gap"] is True and kwargs["error_kind"] is None


def test_failed_turn_is_reported(client, monkeypatch):
    spy = Spy()
    monkeypatch.setattr(main, "conversation_alerts", spy)

    def broken(*args, **kwargs):
        raise main.ChikkiAIError("down", kind="timeout")
        yield  # pragma: no cover

    monkeypatch.setattr(main, "stream_chikki", broken)
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": "What is his strongest skill?", "voice": False, "turn_id": "t2", "session_id": "s"})
        while ws.receive_json()["type"] != "text":
            pass
    (args, kwargs), = spy.calls
    assert kwargs["error_kind"] == "timeout" and kwargs["gap"] is False
