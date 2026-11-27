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


def test_text_mode_allows_formatting_but_not_leaked_tags():
    bullets = "- **LangGraph** agents\n- **FastAPI** services"
    assert evals.evaluate(case(mode="text"), bullets, []) == []
    assert evals.evaluate(case(), bullets, [])  # a spoken reply must stay plain
    assert evals.evaluate(case(mode="text"), "Fine. [[next:A?|B?]]", [])


def test_layout_regex_and_word_limits():
    skills = case(mode="text", regex=["^\s*[-\u2022]\s+\S.*\n\s*[-\u2022]\s+\S"])
    assert evals.evaluate(skills, "Headline\n\n- one\n- two", []) == []
    assert any("layout check" in f for f in evals.evaluate(skills, "Just a sentence.", []))
    table = case(mode="text", regex=["\|.+\|"])
    assert evals.evaluate(table, "| a | b |\n|---|---|\n| 1 | 2 |", []) == []
    assert evals.evaluate(case(mode="text", max_words=5), "one two three four five six seven", [])
    assert evals.evaluate(case(mode="text", none_regex=["TODO"]), "TODO later", [])


def test_new_cases_cover_layout_projects_and_nachitram():
    ids = {c["id"] for c in evals.load_cases()}
    assert {"layout-skills", "layout-compare-table", "projects-live-first", "nachitram-is-private"} <= ids
