import pytest
from fastapi.testclient import TestClient

import main
from actions import ActionTagFilter, filter_actions


def run(chunks):
    tag_filter = ActionTagFilter()
    text = "".join(tag_filter.feed(chunk) for chunk in chunks) + tag_filter.finish()
    return text, tag_filter.actions


def test_tag_is_removed_and_collected():
    assert run(["Sure, use the form. [[action:contact]]"]) == ("Sure, use the form. ", ["contact"])


def test_tag_split_across_tokens():
    text, actions = run(["Here you go. ", "[[", "action", ":res", "ume", "]]"])
    assert text == "Here you go. " and actions == ["resume"]


def test_unknown_duplicate_and_excess_actions():
    assert run(["[[action:hack]]ok"]) == ("ok", [])
    assert run(["[[action:contact]][[action:contact]]"])[1] == ["contact"]
    assert run(["[[action:contact]][[action:resume]][[action:booking]]"])[1] == ["contact", "resume"]


def test_normal_brackets_pass_through():
    assert run(["See [1] and [[note]] and a[0]"]) == ("See [1] and [[note]] and a[0]", [])


def test_incomplete_tag_at_end_is_dropped():
    assert run(["Done. [[action:cont"]) == ("Done. ", [])
    assert run(["Done. ["]) == ("Done. ", [])


@pytest.fixture
def client(feedback_db, monkeypatch):
    monkeypatch.setattr(main, "sync_drive_resume", lambda: "")
    return TestClient(main.app)


def test_websocket_returns_actions_and_hides_tag(client, monkeypatch):
    def fake_stream(message, history, language, previous_jokes=None, knowledge_context="", meta=None, **kwargs):
        for piece in ["You can message him ", "right here. ", "[[action:", "contact]]"]:
            yield piece, "trace"

    monkeypatch.setattr(main, "stream_chikki", fake_stream)
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": "How can I contact Akash?", "voice": False, "turn_id": "t1"})
        tokens = []
        while True:
            data = ws.receive_json()
            if data["type"] == "token":
                tokens.append(data["token"])
            if data["type"] == "text":
                break
    assert "[[" not in "".join(tokens) and "[[" not in data["reply"]
    assert data["reply"] == "You can message him right here. "
    assert data["meta"]["actions"] == ["contact"]


def test_unexpected_turn_error_still_replies(client, monkeypatch):
    def broken_stream(*args, **kwargs):
        raise RuntimeError("boom")
        yield  # pragma: no cover

    monkeypatch.setattr(main, "stream_chikki", broken_stream)
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": "What is his strongest skill?", "voice": False, "turn_id": "t9"})
        data = ws.receive_json()
    assert data["meta"]["isError"] is True and data["meta"]["kind"] == "internal"


@pytest.mark.parametrize("message,action,allowed", [
    ("How can I contact Akash?", "contact", True),
    ("I want to hire him", "contact", True),
    ("Can I get his resume?", "resume", True),
    ("send me the CV", "resume", True),
    ("Would Akash fit this role? Job description: ...", "role_fit", True),
    ("Can we schedule a call?", "booking", True),
    ("\u0906\u0915\u093e\u0936 \u0938\u0947 \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0948\u0938\u0947 \u0915\u0930\u0942\u0901?", "contact", True),
    ("What happens if a provider goes down?", "contact", False),
    ("Did Akash work at Google?", "resume", False),
    ("What security protections does Chikki have?", "resume", False),
    ("What was his role at UBS?", "role_fit", False),
    ("Tell me about his projects", "booking", False),
])
def test_actions_are_filtered_by_the_visitors_request(message, action, allowed):
    assert (filter_actions([action], message) == [action]) is allowed


def test_mood_tag_is_hidden_and_collected():
    from actions import ActionTagFilter

    tag_filter = ActionTagFilter()
    text = "".join(tag_filter.feed(c) for c in ["[[mo", "od:pro", "ud]] Akash built ", "agents. [[action:contact]]"]) + tag_filter.finish()
    assert text == " Akash built agents. "
    assert tag_filter.mood == "proud" and tag_filter.actions == ["contact"]


def test_unknown_mood_is_ignored_and_first_mood_wins():
    from actions import ActionTagFilter

    tag_filter = ActionTagFilter()
    text = tag_filter.feed("[[mood:bogus]]Hi [[mood:happy]]there") + tag_filter.finish()
    assert text == "Hi there" and tag_filter.mood == "happy"
