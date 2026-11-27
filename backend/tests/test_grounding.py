import pytest
from fastapi.testclient import TestClient

import grounding
import main
from grounding import GroundingGuard, NOTICES, pop_sentences, sanitize_text

RESUME = """
Akash Bhalshankar - AI Engineer
Experience
AI Engineer | UBS | Jan 2025 - Present
- Built multi-agent workflows with LangGraph and LangChain on Azure OpenAI using FastAPI and Pydantic.
- Cut manual review effort by 50% and reduced hallucination with RAG; deployed on Azure Container Apps.
QA Engineer | MassMutual | Jul 2023 - Dec 2024
- Automated testing with Selenium and Pytest.
Projects: Chikki, NavLearn. Skills: Python, React 18, Docker.
"""


def guard(extra=None, language="en-IN"):
    return GroundingGuard(RESUME, extra, language)


# ---------------------------------------------------------------- what is allowed
@pytest.mark.parametrize("sentence", [
    "Akash built multi-agent workflows with LangGraph and FastAPI at UBS.",
    "He cut manual review effort by 50% using RAG on Azure OpenAI.",
    "At MassMutual he automated tests with Selenium and Pytest.",
    "He works with Python, Docker and React 18.",
    "Honestly, Akash's strongest work is the LangGraph platform.",
    "Impressive! He is an AI Engineer.",          # a capitalised first word is not treated as a claim
    "Chikki is his personal project.",
    "That is a great question.",
])
def test_grounded_sentences_pass(sentence):
    ok, bad = guard().check_sentence(sentence)
    assert ok, bad


# ---------------------------------------------------------------- what is blocked
@pytest.mark.parametrize("sentence,term", [
    ("Akash has deep Kubernetes experience.", "Kubernetes"),
    ("He worked at Google as a staff engineer.", "Google"),
    ("He cut costs by 90% at UBS.", "90%"),
    ("He has 7 years of experience.", "7"),
    ("He is skilled in TensorFlow and PyTorch.", "TensorFlow"),
    ("He led a team at JPMorgan.", "JPMorgan"),
])
def test_ungrounded_claims_are_caught(sentence, term):
    ok, bad = guard().check_sentence(sentence)
    assert not ok and term in bad


def test_computed_tenure_is_allowed_because_the_prompt_provides_it():
    assert guard(extra=["approximately 1.5 years"]).check_sentence("He has about 1.5 years of experience.")[0]
    assert not guard().check_sentence("He has about 1.5 years of experience.")[0]


def test_number_words_in_documents_allow_their_digits():
    corpus_guard = GroundingGuard("It supports three languages and four providers.")
    assert corpus_guard.check_sentence("It supports 3 languages and 4 providers.")[0]
    assert not corpus_guard.check_sentence("It supports 9 languages.")[0]


def test_resume_only_is_stricter_than_resume_plus_write_ups():
    both = GroundingGuard(RESUME + "\nChikki uses BM25 retrieval.")
    resume_only = GroundingGuard(RESUME)
    sentence = "Chikki uses BM25 retrieval."
    assert both.check_sentence(sentence)[0] and not resume_only.check_sentence(sentence)[0]


def test_capital_after_sentence_punctuation_or_quotes_is_just_grammar():
    assert guard().check_sentence('He said: "Great work at UBS." Then he left!')[0]
    assert not guard().check_sentence("His stack is strong, with Kubernetes.")[0]


def test_abbreviations_are_accepted_only_when_the_long_form_is_in_the_documents():
    with_long_form = GroundingGuard("ShareInSync: Peer-to-Peer file sharing PWA built with React.")
    assert with_long_form.check_sentence("His P2P file sharing app uses React.")[0]
    without = GroundingGuard("ShareInSync: file sharing app built with React.")
    assert not without.check_sentence("His P2P file sharing app uses React.")[0]


def test_native_script_words_are_not_checked_but_latin_terms_are():
    assert guard().check_sentence("आकाश ने LangGraph और FastAPI से काम बनाया।")[0]
    assert not guard().check_sentence("आकाश ने Kubernetes से काम बनाया।")[0]


# ---------------------------------------------------------------- sentence splitting
def test_decimals_are_never_split():
    sentences, rest = pop_sentences("He has 1.5 years of experience. Next")
    assert sentences == ["He has 1.5 years of experience. "] and rest == "Next"
    assert pop_sentences("He has 1.")[0] == []  # waits for the next token instead of cutting at "1."


def test_newlines_end_a_sentence():
    assert pop_sentences("One\nTwo")[0] == ["One\n"]


# ---------------------------------------------------------------- whole replies
def test_sanitize_replaces_bad_sentences_with_one_notice():
    text = "Akash built agents with LangGraph. He is a Kubernetes expert. He also knows Terraform well. Great work at UBS."
    clean, blocked = sanitize_text(guard(), text)
    assert clean.count(NOTICES["en-IN"]) == 1
    assert "Kubernetes" not in clean and "Terraform" not in clean
    assert "LangGraph" in clean and "UBS" in clean
    assert blocked == ["Kubernetes", "Terraform"]


def test_notice_is_localised():
    clean, _ = sanitize_text(guard(language="hi-IN"), "He knows Kubernetes well.")
    assert clean == NOTICES["hi-IN"]


def test_modes(monkeypatch):
    text = "He knows Kubernetes well."
    monkeypatch.setenv("GROUNDING_MODE", "flag")
    clean, blocked = sanitize_text(guard(), text)
    assert clean == text and blocked == ["Kubernetes"]  # reported but not changed
    monkeypatch.setenv("GROUNDING_MODE", "off")
    assert sanitize_text(guard(), text) == (text, [])
    monkeypatch.setenv("GROUNDING_MODE", "nonsense")
    assert grounding.mode() == "block"


def test_sources_setting(monkeypatch):
    assert grounding.sources() == {"resume", "knowledge"}
    monkeypatch.setenv("GROUNDING_SOURCES", "resume")
    assert grounding.sources() == {"resume"}
    monkeypatch.setenv("GROUNDING_SOURCES", "bogus")
    assert grounding.sources() == {"resume", "knowledge"}


def test_build_guard_uses_the_configured_sources(monkeypatch):
    import resume

    monkeypatch.setattr(resume, "get_resume_context", lambda: RESUME)
    monkeypatch.setattr(main.knowledge_base, "all_text", lambda: "Chikki uses BM25 retrieval.")
    both = grounding.build_guard("", "en-IN")
    assert both.check_sentence("Chikki uses BM25 retrieval.")[0]
    monkeypatch.setenv("GROUNDING_SOURCES", "resume")
    strict = grounding.build_guard("", "en-IN")
    assert not strict.check_sentence("Chikki uses BM25 retrieval.")[0]
    assert strict.check_sentence("He built agents with LangGraph.")[0]
    monkeypatch.setenv("GROUNDING_MODE", "off")
    assert grounding.build_guard("", "en-IN") is None


# ---------------------------------------------------------------- through the real WebSocket handler
class Spy:
    def __init__(self):
        self.calls = []

    def notify_turn(self, *args, **kwargs):
        self.calls.append((args, kwargs))


@pytest.fixture
def client(feedback_db, monkeypatch):
    import resume

    monkeypatch.setattr(main, "sync_drive_resume", lambda: "")
    monkeypatch.setattr(resume, "get_resume_context", lambda: RESUME)
    monkeypatch.setattr(main.knowledge_base, "all_text", lambda: "")
    return TestClient(main.app)


def run_turn(client, monkeypatch, pieces, message="Tell me about his skills"):
    def fake_stream(message, history, language, previous_jokes=None, knowledge_context="", meta=None, **kwargs):
        for piece in pieces:
            yield piece, ""

    monkeypatch.setattr(main, "stream_chikki", fake_stream)
    tokens = []
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_json({"message": message, "voice": False, "turn_id": "t1", "session_id": "s1"})
        while True:
            data = ws.receive_json()
            if data["type"] == "token":
                tokens.append(data["token"])
            if data["type"] == "text":
                return tokens, data


def test_ungrounded_sentence_never_reaches_the_visitor(client, monkeypatch):
    spy = Spy()
    monkeypatch.setattr(main, "conversation_alerts", spy)
    pieces = ["He builds agents with Lang", "Graph at UBS. ", "He is also a Kubernetes ", "expert. ", "He cut review effort by 50%."]
    tokens, data = run_turn(client, monkeypatch, pieces)
    shown = "".join(tokens)
    assert "Kubernetes" not in shown and "Kubernetes" not in data["reply"]
    assert data["reply"] == f"He builds agents with LangGraph at UBS. {NOTICES['en-IN']} He cut review effort by 50%."
    (args, kwargs), = spy.calls
    assert kwargs["blocked"] == ["Kubernetes"]


def test_decimal_tenure_streams_without_being_cut(client, monkeypatch):
    # "1.5" arrives as separate tokens; the sentence must still be checked as a whole
    tokens, data = run_turn(client, monkeypatch, ["He has 1", ".", "5 years at UBS."])
    assert data["reply"].strip() == NOTICES["en-IN"]  # 1.5 is not in this resume, so it is blocked
    tokens, data = run_turn(client, monkeypatch, ["He cut effort by 50", "% at UBS."])
    assert data["reply"] == "He cut effort by 50% at UBS."


def test_jokes_skip_the_guard(client, monkeypatch):
    tokens, data = run_turn(client, monkeypatch, ["Why did Kubernetes cross the road? To scale."], message="Tell me a joke")
    assert "Kubernetes" in data["reply"]


def test_grounded_reply_is_untouched_and_history_keeps_guarded_text(client, monkeypatch):
    tokens, data = run_turn(client, monkeypatch, ["He works with Python and Docker."])
    assert data["reply"] == "He works with Python and Docker."
    assert data["meta"]["isError"] is False


def test_markdown_formatting_does_not_trigger_the_guard():
    from grounding import GroundingGuard, strip_markdown

    guard = GroundingGuard("Akash works at UBS and built LangGraph agents with FastAPI.")
    assert strip_markdown("- **UBS** and `FastAPI`").replace("\u2063", "") == "UBS and FastAPI"
    ok, bad = guard.check_sentence("- Strong **LangGraph** skills at **UBS**\n- Built agents with **FastAPI**")
    assert ok, bad
    ok, bad = guard.check_sentence("- Also uses **Kubernetes** daily")
    assert not ok and "Kubernetes" in bad


def test_unsupported_bullet_is_dropped_and_rest_of_list_kept():
    from grounding import GroundingGuard, pop_sentences

    guard = GroundingGuard("Akash uses Python and FastAPI at UBS.")
    sentences, rest = pop_sentences("- **Python** and **FastAPI**\n- **Kubernetes** clusters\n- Works at **UBS**\n")
    verdicts = [guard.check_sentence(s)[0] for s in sentences + ([rest] if rest.strip() else [])]
    assert verdicts == [True, False, True]
