"""Answer-quality evaluation: run known questions through Chikki and check the replies.

Usage (needs provider keys in .env; makes real model calls):
    uv run python evals.py            # run every case
    uv run python evals.py --id rag   # run one case
    uv run python evals.py --json     # machine-readable output

The checks are deliberately simple and deterministic: expected keywords, banned
claims, required actions, reply script and length, plus format rules that keep
replies clean for text-to-speech (no markdown, no emoji, no leaked action tags).
"""

import json
import re
import sys
import time
from pathlib import Path

CASES_PATH = Path(__file__).parent / "evals" / "cases.json"
MAX_WORDS_CONCISE = 90
SCRIPTS = {"te": r"[ఀ-౿]", "hi": r"[ऀ-ॿ]"}
EMOJI = re.compile(r"[\U0001F300-\U0001FAFF☀-➿]")


def load_cases(path: Path = CASES_PATH) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate(case: dict, reply: str, actions: list[str]) -> list[str]:
    """Returns a list of failure messages (empty means the case passed)."""
    failures = []
    text = reply.strip()
    lowered = text.lower()
    words = len(text.split())

    if not text:
        return ["empty reply"]
    if re.search(r"\*\*|```|^\s*#|\[\[|^\s*[-*]\s", text, re.MULTILINE):
        failures.append("contains markdown or a leaked action tag")
    if EMOJI.search(text):
        failures.append("contains emoji")

    if case.get("any_of") and not any(term.lower() in lowered for term in case["any_of"]):
        failures.append(f"none of the expected terms found: {case['any_of']}")
    for term in case.get("none_of", []):
        if term.lower() in lowered:
            failures.append(f"contains banned claim: {term!r}")
    if case.get("expects_action") and case["expects_action"] not in actions:
        failures.append(f"expected action {case['expects_action']!r}, got {actions}")
    if "expects_action" not in case and actions:
        failures.append(f"unexpected action offered: {actions}")
    if case.get("script") and not re.search(SCRIPTS[case["script"]], text):
        failures.append(f"reply is not in {case['script']} script")

    minimum = case.get("min_words")
    if minimum and words < minimum:
        failures.append(f"too short: {words} words, expected at least {minimum}")
    if not case.get("detail") and not case.get("script") and words > MAX_WORDS_CONCISE:
        failures.append(f"too long for a spoken answer: {words} words")
    return failures


def answer(case: dict) -> tuple[str, list[str]]:
    """Runs the case through the same path as a live chat turn."""
    from actions import ActionTagFilter, filter_actions
    from ai import stream_chikki
    from knowledge import TOP_K, format_context, knowledge_base

    detail = bool(case.get("detail"))
    language = case.get("language", "en-IN")
    context = format_context(knowledge_base.retrieve(case["question"], 5 if detail else TOP_K))

    tag_filter = ActionTagFilter()
    pieces = [
        tag_filter.feed(delta)
        for delta, _ in stream_chikki(
            case["question"], [], language, knowledge_context=context, detail=detail, voice_mode=not detail
        )
    ]
    pieces.append(tag_filter.finish())
    return "".join(pieces), filter_actions(tag_filter.actions, case["question"])


def run(cases: list[dict], responder=answer, delay: float = 0.0) -> list[dict]:
    results = []
    for index, case in enumerate(cases):
        if delay and index:
            time.sleep(delay)  # stay under provider tokens-per-minute limits
        try:
            reply, actions = responder(case)
            failures = evaluate(case, reply, actions)
        except Exception as error:  # a provider outage should fail the case, not the whole run
            reply, actions, failures = "", [], [f"error: {type(error).__name__}: {error}"]
        results.append({"id": case["id"], "passed": not failures, "failures": failures, "reply": reply})
    return results


def main(argv: list[str]) -> int:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    cases = load_cases()
    if "--id" in argv:
        wanted = argv[argv.index("--id") + 1]
        cases = [case for case in cases if case["id"] == wanted]
        if not cases:
            print(f"No case with id {wanted!r}")
            return 2

    results = run(cases, delay=3.0)
    if "--json" in argv:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        for result in results:
            print(f"{'PASS' if result['passed'] else 'FAIL'}  {result['id']}")
            for failure in result["failures"]:
                print(f"      - {failure}")
            if not result["passed"]:
                print(f"      reply: {result['reply'][:200]!r}")
        passed = sum(r["passed"] for r in results)
        print(f"\n{passed}/{len(results)} passed")
    return 0 if all(r["passed"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
