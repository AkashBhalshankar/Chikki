from typing import List, Optional
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    trace_id: Optional[str] = None


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None


class FeedbackRequest(BaseModel):
    value: str
    question: Optional[str] = ""
    reply: Optional[str] = ""
    mode: Optional[str] = "voice"
    user_comment: Optional[str] = None
    trace_id: Optional[str] = None
    session_id: Optional[str] = None
    session_id: Optional[str] = None