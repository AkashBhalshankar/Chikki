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

PREFIX = "[[action:"
TAG_RE = re.compile(r"\[\[action:(\w+)\]\]")

PROMPT_SECTION = """==================================================
APP ACTIONS (HIDDEN TAGS)
==================================================
The app can show the visitor a button. When, and only when, the visitor clearly asks for one of these, answer briefly and end your reply with exactly one tag:
- [[action:contact]] : they want to contact, message, or hire Akash.
- [[action:resume]] : they want the resume or CV.
- [[action:role_fit]] : they mention a job description or ask how well Akash fits a role.
- [[action:booking]] : they want to schedule a call or meeting.
Rules: the tag goes at the very end, at most one per reply, never mention or describe the tag, and never add one when it was not asked for.

"""


class ActionTagFilter:
    """Removes [[action:x]] tags from a token stream and collects them."""

    def __init__(self):
        self.buffer = ""
        self.actions: list[str] = []

    @staticmethod
    def _could_become_tag(text: str) -> bool:
        if len(text) <= len(PREFIX):
            return PREFIX.startswith(text)
        return text.startswith(PREFIX) and re.fullmatch(r"\w*\]?", text[len(PREFIX):]) is not None

    def _record(self, name: str) -> None:
        if name in ALLOWED_ACTIONS and name not in self.actions and len(self.actions) < MAX_ACTIONS:
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
                self._record(match.group(1))
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
