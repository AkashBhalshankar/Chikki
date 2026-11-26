from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    trace_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    value: Literal["helpful", "needs-improvement"]
    question: Optional[str] = Field(default="", max_length=2000)
    reply: Optional[str] = Field(default="", max_length=4000)
    mode: Optional[str] = Field(default="voice", max_length=20)
    user_comment: Optional[str] = Field(default=None, max_length=1000)
    trace_id: Optional[str] = Field(default=None, max_length=100)
    session_id: Optional[str] = Field(default=None, max_length=100)


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    company: str = Field(default="", max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    topics: str = Field(default="", max_length=300)
    # Honeypot: hidden in the UI, so humans leave it empty and bots fill it in.
    website: str = Field(default="", max_length=200)

    @field_validator("name", "message")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value
