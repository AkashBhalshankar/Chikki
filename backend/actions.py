"""In-app actions Chikki can offer, emitted by the model as hidden tags.

The model ends a reply with e.g. [[action:contact]] when the visitor clearly
asks for it. The tag is removed from the text stream (so it is never shown or
spoken) and returned as structured data; the UI renders a button the visitor
confirms. This works with every provider, needs no extra model call, and the
model can never run anything by itself.
"""

import re

ALLOWED_ACTIONS = ("contact", "resume", "role_fit", "booking")
MAX_ACTIONS = 2

PREFIXES = ("[[action:", "[[mood:")
TAG_RE = re.compile(r"\[\[(action|mood):(\w+)\]\]")

# Moods the model may choose; the page maps each to a face. Anything else is ignored.
ALLOWED_MOODS = (
    "neutral", "happy", "joyful", "excited", "proud", "confident", "focused", "curious", "playful",
    "laughing", "shy", "grateful", "love", "surprised", "skeptical", "determined", "relieved",
    "apologetic", "concerned", "sad", "wink", "encouraging",
)

# The model decides, but a button is only shown when the visitor's own message
# plausibly asks for it. This keeps stray tags from weaker or fallback models
# from showing buttons nobody asked for. English, Hindi and Telugu keywords.
INTENT_PATTERNS = {
    "contact": re.compile(
        r"\b(contact|reach|e-?mail|message|hire|hiring|get in touch|talk to|connect with|phone)\b"
        r"|संपर्क|ईमेल|संदेश|भर्ती|సంప్రదించ|ఈమెయిల్|సందేశ|నియమించ|హైర్",
        re.IGNORECASE,
    ),
    "resume": re.compile(
        r"\b(resume|r\u00e9sum\u00e9|cv|curriculum vitae)\b|रिज्यूमे|रेज़्यूमे|रिज़्यूमे|बायोडाटा|రెజ్యూమ్|రెస్యూమ్|సీవీ",
        re.IGNORECASE,
    ),
    "role_fit": re.compile(
        r"job description|job posting|\bjd\b|hiring for|(?:we are|we're) looking for|requirements?:"
        r"|\b(?:fit|suit|suitable|match)\b.{0,40}\b(?:role|job|position|team|opening)\b"
        r"|\b(?:role|job|position|team|opening)\b.{0,40}\b(?:fit|suit|suitable|match)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    "booking": re.compile(
        r"\b(schedule|book|booking|meeting|call|interview|calendar|appointment|slot)\b"
        r"|मीटिंग|कॉल|इंटरव्यू|मुलाकात|మీటింగ్|కాల్|ఇంటర్వ్యూ",
        re.IGNORECASE,
    ),
}


def filter_actions(actions: list[str], user_message: str) -> list[str]:
    """Keeps only the actions the visitor's message plausibly asked for."""
    return [name for name in actions if INTENT_PATTERNS[name].search(user_message)]


PROMPT_SECTION = """==================================================
APP ACTIONS (HIDDEN TAGS)
==================================================
The app can show the visitor a button. Add a tag ONLY when the visitor's message is itself a request for that exact thing, then answer briefly and end your reply with exactly one tag:
- [[action:contact]] : they ask how to contact, message, email, or hire Akash.
- [[action:resume]] : they ask to get, download, send, or see the resume or CV file.
- [[action:role_fit]] : they share or mention a specific job description or posting, or ask whether Akash would fit a particular role or job.
- [[action:booking]] : they ask to schedule a call, meeting, or interview.
Rules: the default is NO tag, and most replies must not have one. When you do add one, it goes at the very end, at most one per reply, and you never mention or describe it.
Questions about Akash's experience, employers, skills, projects, education, or about how Chikki works are NOT requests for a button: answer them normally with NO tag. For example "Did Akash work at Google?", "What happens if a provider goes down?" and "Tell me about his projects" get no tag.

==================================================
MOOD TAG (HIDDEN, FIRST THING IN EVERY REPLY)
==================================================
Start every reply with exactly one mood tag that matches how your answer feels, like [[mood:proud]]. It sets Chikki's face. Never mention it. Pick the closest:
- proud : Akash's projects, achievements, results.  - confident : skills, strengths, why hire him.
- focused : a technical explanation.  - excited : something impressive or a big win.  - happy : friendly, positive, a warm hello.
- joyful : very good news or a celebration.  - curious : you ask a clarifying question.  - neutral : plain facts.
- apologetic : the detail is not in the resume or you cannot help.  - skeptical : the visitor assumes something false or tests you.
- determined : a hard or challenging question.  - relieved : you settle a worry.  - concerned : a problem or an unclear request.
- grateful : thanks.  - shy : a compliment.  - laughing : a joke.  - playful : light banter.  - love : something heartfelt.
- surprised : something unexpected.  - sad : bad news or a setback.  - wink : a fun aside.  - encouraging : motivating the visitor.

"""


class ActionTagFilter:
    """Removes [[action:x]] and [[mood:x]] tags from a token stream and collects them."""

    def __init__(self):
        self.buffer = ""
        self.actions: list[str] = []
        self.mood: str | None = None

    @staticmethod
    def _could_become_tag(text: str) -> bool:
        for prefix in PREFIXES:
            if len(text) <= len(prefix):
                if prefix.startswith(text):
                    return True
            elif text.startswith(prefix) and re.fullmatch(r"\w*\]?", text[len(prefix):]) is not None:
                return True
        return False

    def _record(self, kind: str, name: str) -> None:
        if kind == "mood":
            if self.mood is None and name in ALLOWED_MOODS:
                self.mood = name
        elif name in ALLOWED_ACTIONS and name not in self.actions and len(self.actions) < MAX_ACTIONS:
            self.actions.append(name)

    def feed(self, delta: str) -> str:
        self.buffer += delta
        output = ""
        while True:
            index = self.buffer.find("[")
            if index < 0:
                output += self.buffer
                self.buffer = ""
                return output
            output += self.buffer[:index]
            self.buffer = self.buffer[index:]
            match = TAG_RE.match(self.buffer)
            if match:
                self._record(match.group(1), match.group(2))
                self.buffer = self.buffer[match.end():]
                continue
            if self._could_become_tag(self.buffer):
                return output
            output += self.buffer[0]
            self.buffer = self.buffer[1:]

    def finish(self) -> str:
        """Flush held text. An unfinished tag is dropped instead of leaking."""
        remaining, self.buffer = self.buffer, ""
        return "" if self._could_become_tag(remaining) else remaining
