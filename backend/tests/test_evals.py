import evals


def case(**overrides):
    return {"id": "t", "question": "q", **overrides}


def test_cases_file_is_valid():
    cases = evals.load_cases()
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)) >= 10
    assert all(c["question"].strip() for c in cases)


def test_passes_good_reply():
    assert evals.evaluate(case(any_of=["FastAPI"]), "Chikki uses FastAPI and React.", []) == []


def test_flags_missing_terms_and_banned_claims():
    failures = evals.evaluate(case(any_of=["Kubernetes"], none_of=["worked at Google"]), "He worked at Google.", [])
    assert any("expected terms" in f for f in failures) and any("banned claim" in f for f in failures)


def test_action_expectations():
    assert evals.evaluate(case(expects_action="contact"), "Use the form.", ["contact"]) == []
    assert evals.evaluate(case(expects_action="contact"), "Use the form.", [])
    assert evals.evaluate(case(), "A normal answer.", ["resume"])  # unexpected action


def test_format_rules():
    assert evals.evaluate(case(), "**Bold** answer", [])
    assert evals.evaluate(case(), "Nice \U0001F680", [])
    assert evals.evaluate(case(), "Leaked [[action:contact]]", [])
    assert evals.evaluate(case(), "", ["x"]) == ["empty reply"]


def test_length_and_script_rules():
    long_reply = " ".join(["word"] * 120)
    assert evals.evaluate(case(), long_reply, [])
    assert evals.evaluate(case(detail=True), long_reply, []) == []
    assert evals.evaluate(case(detail=True, min_words=200), long_reply, [])
    assert evals.evaluate(case(script="te"), "ఆకాశ్ ఒక ఇంజనీర్", []) == []
    assert evals.evaluate(case(script="te"), "Akash is an engineer", [])


def test_run_survives_provider_errors():
    def responder(c):
        if c["id"] == "bad":
            raise RuntimeError("provider down")
        return "Chikki uses FastAPI.", []

    results = evals.run([case(id="ok", any_of=["FastAPI"]), case(id="bad")], responder=responder)
    assert [r["passed"] for r in results] == [True, False]
    assert "provider down" in results[1]["failures"][0]
