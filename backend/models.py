from typing import List, Literal, Optional

from pydantic import BaseModel, Field


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
