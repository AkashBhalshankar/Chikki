"""Grounding guard: keeps Chikki's replies tied to the verified documents.

An AI model can always slip, so this does not rely on the model behaving. Each
sentence of a reply is checked before it is shown or spoken. Every number,
company name, technology or other proper term in it must appear in the allowed
sources: the Google Drive resume and, by default, Chikki's own project
write-ups in backend/knowledge. A sentence with anything unverified is replaced
with a short "that isn't in his resume" notice (once per reply).

Settings:
  GROUNDING_MODE     block (default) | flag (only report, show the sentence) | off
  GROUNDING_SOURCES  resume,knowledge (default) | resume   (resume only is strictest)

Known limits (it is a safety net, not a proof of truth): it checks numbers and
capitalised names/terms, not whether a sentence is logically accurate; a
capitalised plain word at the very start of a sentence is not checked.
"""

import logging
import os
import re
from datetime import date

logger = logging.getLogger("chikki.grounding")

NOTICES = {
    "en-IN": "I don't have that detail in Akash's resume.",
    "hi-IN": "आकाश के रिज्यूमे में मेरे पास यह जानकारी नहीं है।",
    "te-IN": "ఆకాశ్ రెజ్యూమ్‌లో ఆ వివరాలు నాకు లేవు.",
}

# Words that may appear without being in the documents: the people and app involved,
# the three languages offered, and calendar names (the current date is given to the model).
ALWAYS_ALLOWED = {
    "akash", "bhalshankar", "chikki", "i", "i'm", "ai", "english", "telugu", "hindi", "hinglish",
    "ok", "okay", "hi", "hello", "hey",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
    "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
    "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12", "fifteen": "15", "twenty": "20",
}

# An abbreviation is accepted when its long form is in the documents
# (the resume says "Peer-to-Peer", the model may say "P2P").
ALIASES = {
    "p2p": ["peer-to-peer", "peer to peer"],
    "ml": ["machine learning"],
    "nlp": ["natural language"],
    "llm": ["large language model", "language model"],
    "qa": ["quality assurance"],
    "ui": ["user interface"],
    "ux": ["user experience"],
    "ats": ["applicant tracking"],
    "rag": ["retrieval-augmented", "retrieval augmented"],
    "pwa": ["progressive web"],
    "ci": ["continuous integration"],
    "cd": ["continuous delivery", "continuous deployment"],
}

WORD = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-']*|\d+(?:[.,]\d+)*%?")
BOUNDARY = re.compile(r"[.!?।॥]+\s+|\n+")


def mode() -> str:
    value = os.getenv("GROUNDING_MODE", "block").strip().lower()
    return value if value in {"block", "flag", "off"} else "block"


def sources() -> set[str]:
    chosen = {part.strip().lower() for part in os.getenv("GROUNDING_SOURCES", "resume,knowledge").split(",")}
    chosen &= {"resume", "knowledge"}
    return chosen or {"resume", "knowledge"}


EARLY_MIN_WORDS = 6
CLAUSE_BREAK = re.compile(r"[,;:]\s+|\s[-–—]\s")


def pop_early_phrase(buffer: str) -> tuple[str, str]:
    """For voice: lets the first clause of a reply be spoken before its sentence ends.

    Returns (phrase, rest); phrase is "" until the buffer holds at least EARLY_MIN_WORDS
    words followed by a comma, colon or dash. Used once per reply, so speech starts sooner.
    """
    for match in CLAUSE_BREAK.finditer(buffer):
        if len(buffer[:match.start()].split()) >= EARLY_MIN_WORDS:
            return buffer[:match.end()], buffer[match.end():]
    return "", buffer


NAMED_MARK = "\u2063"


def strip_markdown(text: str) -> str:
    """Removes bullet dashes and backticks, and turns bold marks into an invisible marker.

    A bold term is something the reply is naming (a technology, a company), so it must be
    checked even at the start of a line, where a capital letter would otherwise be treated
    as ordinary grammar. The marker keeps it from looking like the start of a sentence.
    """
    text = re.sub(r"^[ \t]*[-*\u2022][ \t]+", "", text, flags=re.MULTILINE)
    return text.replace("**", NAMED_MARK).replace("`", "")


def pop_sentences(buffer: str) -> tuple[list[str], str]:
    """Splits finished sentences off a growing buffer.

    A sentence ends at ". " (punctuation followed by whitespace) or a newline, so a
    decimal such as 1.5 is never cut in half while it streams in.
    """
    sentences, start = [], 0
    for match in BOUNDARY.finditer(buffer):
        sentences.append(buffer[start:match.end()])
        start = match.end()
    return sentences, buffer[start:]


def _normalize(text: str) -> str:
    return text.replace("’", "'").replace("‘", "'")


def _clean(word: str) -> str:
    word = word.strip(".-'")
    return word[:-2] if word.lower().endswith("'s") else word


def _term_forms(term: str) -> set[str]:
    term = term.lower().strip(".-'")
    forms = {term, term.replace("-", "")}
    forms.update(part for part in re.split(r"[-.]", term) if len(part) > 1)
    return {form for form in forms if form}


def _starts_sentence(text: str, position: int) -> bool:
    """True when the word at this position opens a sentence, so its capital is just grammar."""
    before = text[:position].rstrip(" \t\"'(“”‘’")
    return not before or before[-1] in ".!?।॥:;\n—–"


def _number_form(token: str) -> str:
    return token.replace(",", "").rstrip("%").strip(".")


class GroundingGuard:
    def __init__(self, corpus: str, extra_allowed: list[str] | None = None, language: str = "en-IN"):
        self.language = language
        corpus = _normalize(corpus).lower()
        self._corpus = corpus
        self._terms: set[str] = set()
        self._numbers: set[str] = set()
        for token in re.findall(r"[a-z0-9][a-z0-9+#.\-']*", corpus):
            cleaned = _clean(token)
            if not cleaned:
                continue
            if cleaned[0].isdigit():
                self._numbers.add(_number_form(cleaned))
            else:
                self._terms |= _term_forms(cleaned)
        for word, digit in NUMBER_WORDS.items():
            if word in self._terms:
                self._numbers.add(digit)
        for extra in extra_allowed or []:
            for token in re.findall(r"\d+(?:[.,]\d+)?", extra):
                self._numbers.add(_number_form(token))
        today = date.today()
        self._numbers.update({str(today.year), str(today.day)})

    def _is_candidate(self, word: str, is_first: bool) -> bool:
        has_inner_capital = bool(re.search(r"[a-z][A-Z]", word))
        is_acronym = len(word) >= 2 and word.isupper()
        has_digit_and_letter = bool(re.search(r"\d", word)) and bool(re.search(r"[A-Za-z]", word))
        if has_inner_capital or is_acronym or has_digit_and_letter:
            return True
        return word[0].isupper() and not is_first

    def unsupported_terms(self, sentence: str) -> list[str]:
        """Numbers and proper terms in the sentence that are not in the allowed sources."""
        text = _normalize(sentence)
        found: list[str] = []
        for match in WORD.finditer(text):
            raw = match.group(0)
            if raw[0].isdigit():
                if _number_form(raw) not in self._numbers:
                    found.append(raw)
                continue
            word = _clean(raw)
            if not word or not self._is_candidate(word, is_first=_starts_sentence(text, match.start())):
                continue
            lowered = word.lower()
            if lowered in ALWAYS_ALLOWED or lowered in self._terms or lowered.replace("-", "") in self._terms:
                continue
            parts = [part for part in re.split(r"[-.]", lowered) if len(part) > 1]
            if len(parts) > 1 and all(part in self._terms or part in ALWAYS_ALLOWED for part in parts):
                continue
            if any(long_form in self._corpus for long_form in ALIASES.get(lowered, [])):
                continue
            found.append(word)
        return list(dict.fromkeys(found))

    def check_sentence(self, sentence: str) -> tuple[bool, list[str]]:
        bad = self.unsupported_terms(strip_markdown(sentence))
        return not bad, bad

    @property
    def notice(self) -> str:
        return NOTICES.get(self.language, NOTICES["en-IN"])


def sanitize_text(guard: GroundingGuard | None, text: str) -> tuple[str, list[str]]:
    """Applies the guard to a finished reply (used by the evals). Returns (text, blocked terms)."""
    if guard is None or mode() == "off":
        return text, []
    sentences, rest = pop_sentences(text)
    if rest.strip():
        sentences.append(rest)
    output, blocked, notice_given = [], [], False
    for sentence in sentences:
        ok, bad = guard.check_sentence(sentence)
        if ok or mode() == "flag":
            output.append(sentence)
            blocked.extend(bad)
            continue
        blocked.extend(bad)
        if not notice_given:
            notice_given = True
            output.append(guard.notice + " ")
    return "".join(output).strip(), list(dict.fromkeys(blocked))


def build_guard(knowledge_context: str = "", language: str = "en-IN") -> GroundingGuard | None:
    """Builds the guard for one turn from the allowed sources. None when the guard is off."""
    if mode() == "off":
        return None
    from knowledge import knowledge_base
    from resume import calculate_live_experience, get_resume_context

    chosen = sources()
    corpus_parts: list[str] = []
    extra: list[str] = []

    resume_text = get_resume_context()
    if "resume" in chosen:
        corpus_parts.append(resume_text)
    experience, _ = calculate_live_experience(resume_text)
    if experience:
        extra.append(experience)  # the prompt gives the model this computed tenure, so it is allowed

    if "knowledge" in chosen:
        corpus_parts.append(knowledge_base.all_text())
        corpus_parts.append(knowledge_context)
    return GroundingGuard("\n".join(corpus_parts), extra, language)
