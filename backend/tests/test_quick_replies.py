import random

from quick_replies import quick_reply


def test_plain_thanks_greeting_and_goodbye_get_an_instant_polite_reply():
    reply = quick_reply("thank you so much!").lower()
    assert "welcome" in reply or "happy to help" in reply
    assert quick_reply("Thanks Chikki").startswith("[[mood:grateful]]")
    assert quick_reply("hello").startswith("[[mood:happy]]")
    assert quick_reply("good night").startswith("[[mood:happy]]")
    assert quick_reply("okay thanks") is not None


def test_a_real_question_is_never_swallowed():
    assert quick_reply("thanks, now tell me about his projects") is None
    assert quick_reply("hi, what skills does he have?") is None
    assert quick_reply("Why should we hire him?") is None
    assert quick_reply("") is None


def test_replies_follow_the_language():
    assert "ధన్య" in quick_reply("ధన్యవాదాలు", "te-IN") or "సంతోషం" in quick_reply("ధన్యవాదాలు", "te-IN")
    assert "स्वागत" in quick_reply("धन्यवाद", "hi-IN")
    assert quick_reply("hello", "te-IN") is not None


def test_a_reply_is_one_of_the_prepared_ones():
    assert quick_reply("thanks", rng=random.Random(1)) in {
        f"[[mood:grateful]] {text}" for text in __import__("quick_replies").KINDS["thanks"][2]["en-IN"]
    }


def test_thanks_over_the_socket_is_answered_without_calling_a_model(monkeypatch):
    from fastapi.testclient import TestClient

    import main

    def no_model(*args, **kwargs):
        raise AssertionError("a model was called for a plain thank-you")

    monkeypatch.setattr(main, "stream_chikki", no_model)
    with TestClient(main.app).websocket_connect("/ws") as ws:
        ws.send_json({"message": "thank you so much", "voice": False, "turn_id": "q1"})
        seen = []
        while True:
            event = ws.receive_json()
            seen.append(event)
            if event["type"] == "done" or event.get("meta") is not None:
                break
    reply = "".join(e.get("token", "") for e in seen if e["type"] == "token")
    assert "welcome" in reply.lower() or "help" in reply.lower()
    assert any(e["type"] == "mood" and e["mood"] == "grateful" for e in seen)


def test_a_visitor_who_hits_the_daily_ceiling_gets_a_kind_message_with_the_contact_option(monkeypatch):
    from fastapi.testclient import TestClient

    import main
    import security

    monkeypatch.setattr(main, "chat_daily_limiter", security.RateLimiter(1, 86400))
    monkeypatch.setattr(main, "stream_chikki", lambda *a, **k: iter(()))
    with TestClient(main.app).websocket_connect("/ws") as ws:
        for turn in ("d1", "d2"):
            ws.send_json({"message": "thank you", "voice": False, "turn_id": turn})
            events = []
            while True:
                event = ws.receive_json()
                events.append(event)
                if event["type"] == "done" or event.get("meta") is not None:
                    break
        last = events[-1]
    assert last["meta"]["kind"] == "daily_limit" and "Contact" in last["reply"]
