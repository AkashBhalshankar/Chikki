from pathlib import Path

import pytest

from faq_cache import FAQ_QUESTIONS, FaqCache, is_faq, normalize, replay_chunks, resume_fingerprint

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"


def test_every_faq_question_exists_in_the_frontend():
    source = (FRONTEND / "App.jsx").read_text(encoding="utf-8") + (FRONTEND / "interview.js").read_text(encoding="utf-8")
    for question in FAQ_QUESTIONS:
        assert question in source, question


def test_matching_ignores_case_spacing_and_punctuation():
    assert is_faq("  why should a company hire akash ?? ")
    assert not is_faq("Tell me a developer joke.")
    assert not is_faq("Tell me more about that.")
    assert normalize("Hello,  World!") == "hello,  world".replace("  ", " ")


def test_cache_returns_stored_reply_until_resume_changes_or_it_expires():
    now = [0.0]
    cache = FaqCache(ttl=100, clock=lambda: now[0])
    q = "Why should a company hire Akash?"
    reply = "[[mood:confident]] Akash builds agents at UBS. [[next:A?|B?]]"
    assert cache.get(q, "en-IN", False, "fp1") is None
    assert cache.put(q, "en-IN", False, "fp1", reply)
    assert cache.get(q, "en-IN", False, "fp1") == reply
    assert cache.get(q, "en-IN", True, "fp1") is None  # voice replies are different
    assert cache.get(q, "hi-IN", False, "fp1") is None
    assert cache.get(q, "en-IN", False, "fp2") is None  # the resume changed
    now[0] = 101
    assert cache.get(q, "en-IN", False, "fp1") is None  # expired


def test_only_listed_questions_with_real_replies_are_stored():
    cache = FaqCache()
    assert not cache.put("What is the weather?", "en-IN", False, "fp", "A long enough reply about nothing.")
    assert not cache.put("Why should a company hire Akash?", "en-IN", False, "fp", "short")
    assert not cache.put("Why should a company hire Akash?", "en-IN", False, "fp", "Akash builds multi-agent platforms and then he")  # cut off


def test_replay_reassembles_the_reply_exactly():
    text = "[[mood:proud]] He built **Chikki**. " * 5
    assert "".join(replay_chunks(text)) == text


def test_resume_fingerprint_changes_with_the_text():
    assert resume_fingerprint("a") != resume_fingerprint("b") and resume_fingerprint("a") == resume_fingerprint("a")


def test_second_ask_is_answered_without_calling_a_model(feedback_db, monkeypatch):
    from fastapi.testclient import TestClient

    import main
    from faq_cache import faq_cache

    faq_cache.clear()
    calls = []
    reply = "[[mood:confident]]Akash engineers multi-agent platforms at UBS using LangGraph.\n\n[[next:What did he build at UBS?|Which tools does he use?]]"

    def fake_stream(*args, **kwargs):
        calls.append(1)
        kwargs["meta"]["provider"] = "fake"
        yield reply, "trace1"

    monkeypatch.setattr(main, "stream_chikki", fake_stream)
    monkeypatch.setenv("GROUNDING_MODE", "off")
    client = TestClient(main.app)

    def ask():
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"message": "Why should a company hire Akash?", "voice": False, "language": "en-IN", "turn_id": "t1", "session_id": "s1"})
            tokens = []
            while True:
                data = ws.receive_json()
                if data["type"] == "token":
                    tokens.append(data["token"])
                if data["type"] == "text":
                    return "".join(tokens), data["meta"]

    text1, meta1 = ask()
    text2, meta2 = ask()
    assert len(calls) == 1, "the second ask must not call the model"
    assert text1 == text2 and "UBS" in text2 and "[[" not in text2
    assert meta2["suggestions"] == ["What did he build at UBS?", "Which tools does he use?"] and meta2["mood"] == "confident"
    faq_cache.clear()
