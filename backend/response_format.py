"""Chooses how a text-chat reply should be laid out, based on what the visitor asked.

Different questions deserve different shapes: skills read best as grouped points, a
yes/no question as a one-line verdict, a "how does it work" question as short one-line
paragraphs. The chosen layout is given to the model as part of the instruction. Voice
replies never use this (they are spoken, so they stay plain sentences).
"""

import re

SHAPES = {
    "list": re.compile(
        r"\b(skills?|tech(?:nolog(?:y|ies))?|tech stack|stack|tools?|languages?|frameworks?|libraries|expertise|"
        r"certifications?|strengths?|technologies)\b",
        re.IGNORECASE,
    ),
    "experience": re.compile(
        r"\b(experience|companies|employers?|worked|work history|career|roles?|internships?|background|education|"
        r"degree|studied|projects?|built|portfolio)\b",
        re.IGNORECASE,
    ),
    "verdict": re.compile(
        r"^\s*(?:does|did|is|has|have|can|could|will|would|was|are|do)\b|\b(?:why should|should we|worth hiring|good fit)\b",
        re.IGNORECASE,
    ),
    "explain": re.compile(
        r"\b(how (?:does|do|did|is|are|it)|how .* work|explain|architecture|why did|difference|what happens|"
        r"walk me through|design)\b",
        re.IGNORECASE,
    ),
    "compare": re.compile(
        r"\b(compare|comparison|versus|vs\.?|difference between|differences between|better than|which is better)\b",
        re.IGNORECASE,
    ),
    "contact": re.compile(r"\b(contact|reach|email|hire|schedule|book|call|meeting|resume|cv)\b", re.IGNORECASE),
}

WHY_SHOULD = re.compile(r"(?<![a-z])(why should|worth hiring|good fit)(?![a-z])", re.IGNORECASE)

LAYOUTS = {
    "list": (
        "Layout: one short line that names the headline, then a blank line, then up to 4 bullets. Group related "
        "items per bullet (for example \"- **AI and agents:** LangGraph, LangChain, RAG\"). No closing line."
    ),
    "experience": (
        "Layout: one bullet per company, project or role (up to 6 bullets, never drop one the visitor asked for), each as \"- **Name** (role or type): one concrete "
        "result or technology\". For projects, list the ones that have a public live link in the notes first and "
        "make each of those names a markdown link like [Name](https://...), then the work projects at UBS or other "
        "employers. Otherwise lead with the most relevant. A short lead-in line is optional. No closing line."
    ),
    "verdict": (
        "Layout: the first line is the verdict (yes, no, or not in the resume) in a few words. Then a blank "
        "line and at most one supporting line of evidence from the resume. Nothing else."
    ),
    "explain": (
        "Layout: 2 or 3 very short paragraphs, each exactly ONE sentence on its own line, with a blank line "
        "between them, like: Core idea.<blank line>How it works.<blank line>Why it matters. Never join them into "
        "one paragraph. No bullets unless there are steps."
    ),
    "compare": (
        "Layout: one short lead-in line, then a small markdown table with a header row and a separator row, 2 or "
        "3 columns (the aspect, then one column per thing compared) and at most 4 rows. Put **bold** on the named "
        "technologies and companies inside the cells. No text after the table."
    ),
    "pitch": (
        "Layout: one line with the core pitch, then a blank line, then up to 3 bullets of concrete reasons taken "
        "from the resume (each \"- **Strength:** evidence\"). No closing line."
    ),
    "contact": (
        "Layout: one line that tells them how, in this app (the contact form, resume download or booking "
        "button). Nothing else."
    ),
    "default": (
        "Layout: one direct line answering the question, then if useful a blank line and one short supporting "
        "line. Use bullets only if you are naming three or more things."
    ),
}


def classify(message: str) -> str:
    """Returns the layout name for a visitor's question."""
    text = message.strip()
    if WHY_SHOULD.search(text):
        return "pitch"
    # Order matters: a contact request or a yes/no question beats the topic words inside it.
    for shape in ("compare", "contact", "verdict", "explain", "list", "experience"):
        if SHAPES[shape].search(text):
            return shape
    return "default"


def layout_hint(message: str) -> str:
    return LAYOUTS[classify(message)]
