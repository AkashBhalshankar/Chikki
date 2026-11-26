import base64
import asyncio
import time
import logging
import os
import re
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ai import ChikkiAIError, _is_joke_request, is_detail_request, stream_chikki
from actions import ActionTagFilter
from analytics_store import record_event, summary as analytics_summary
from jd_match import analyze_job
from digest import run_ops_check, send_digest, build_digest
from github_activity import github_context
from contact_store import notify_contact, read_contacts, save_contact
from feedback_store import feedback_analytics, read_feedback, record_feedback
from generate_resume_pdf import build_resume_pdf
from knowledge import TOP_K, format_context, knowledge_base, sources_for
from models import ContactRequest, FeedbackRequest, JobMatchRequest
from resume import sync_resume as sync_resume_profile
from resume_loader import sync_drive_resume
from security import (
    MAX_MESSAGE_CHARS,
    MAX_TTS_CHARS,
    chat_limiter,
    client_ip,
    contact_limiter,
    match_limiter,
    enforce_rate_limit,
    feedback_limiter,
    require_admin,
    resume_limiter,
    sanitize_history,
    sanitize_jokes,
    tts_limiter,
    ws_connections,
)
from tts import clean_for_speech, synthesize_speech, speech_tone

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("chikki")

APP_VERSION = "2.0.0"

def _safe_refresh_knowledge():
    try:
        knowledge_base.refresh()
    except Exception:
        logger.exception("Initial knowledge index build failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Build the retrieval index in the background so the first question is fast.
    asyncio.get_running_loop().run_in_executor(None, _safe_refresh_knowledge)
    yield


app = FastAPI(title="Chikki AI Assistant", version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "https://akashbhalshankar.com,https://www.akashbhalshankar.com,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SENTENCE_END = re.compile(r"([.!?।॥\n]+(?:\s+|$))")


class TTSRequest(BaseModel):
    text: str = Field(max_length=MAX_TTS_CHARS)
    voice: str | None = Field(default=None, max_length=60)
    language: str | None = Field(default=None, max_length=10)


class ResumeDownloadRequest(BaseModel):
    focus: str = Field(default="", max_length=2000)
    linkedin_url: str = Field(default="", max_length=300)
    github_url: str = Field(default="", max_length=300)


@app.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION}


@app.get("/digest/preview", dependencies=[Depends(require_admin)])
def digest_preview(days: int = Query(7, ge=1, le=90)):
    return {"text": build_digest(days)}


@app.post("/digest/send", dependencies=[Depends(require_admin)])
def digest_send(days: int = Query(7, ge=1, le=90)):
    text, sent = send_digest(days)
    return {"sent": sent, "text": text}


@app.post("/ops/check", dependencies=[Depends(require_admin)])
def ops_check():
    problems, alerted = run_ops_check()
    return {"ok": not problems, "problems": problems, "alerted": alerted}


@app.post("/knowledge/refresh", dependencies=[Depends(require_admin)])
def refresh_knowledge():
    knowledge_base.refresh()
    return {"status": "ok", "chunks": knowledge_base.chunk_count}


@app.post("/tts")
async def text_to_speech(req: TTSRequest, request: Request):
    enforce_rate_limit(tts_limiter, request)
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        tone = speech_tone(reply=text)
        audio_bytes = await synthesize_speech(
            text,
            voice=req.voice,
            tone=tone,
            language=req.language,
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as error:
        logger.exception("TTS endpoint failed")
        raise HTTPException(status_code=500, detail="Speech synthesis failed") from error


@app.post("/resume/sync", dependencies=[Depends(require_admin)])
def sync_resume_route():
    try:
        return {"status": "success", "data": sync_resume_profile()}
    except Exception as error:
        logger.exception("Resume sync failed")
        return {"status": "error", "message": str(error)}


@app.get("/resume")
def download_resume(request: Request, focus: str = "", linkedin_url: str = "", github_url: str = ""):
    enforce_rate_limit(resume_limiter, request)
    return _resume_pdf_response(focus, linkedin_url[:300], github_url[:300])


@app.post("/resume")
def download_resume_post(body: ResumeDownloadRequest, request: Request):
    enforce_rate_limit(resume_limiter, request)
    return _resume_pdf_response(body.focus, body.linkedin_url, body.github_url)


def _resume_pdf_response(focus: str, linkedin_url: str, github_url: str):
    try:
        record_event("resume_download", focus[-200:])
        pdf_bytes = build_resume_pdf(
            focus=focus[-500:].strip(),
            linkedin_url=linkedin_url,
            github_url=github_url,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="akash-bhalshankar-resume.pdf"'},
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        logger.exception("Resume generation failed")
        raise HTTPException(status_code=500, detail="Resume generation failed") from error


@app.post("/feedback")
def create_feedback(body: FeedbackRequest, request: Request):
    enforce_rate_limit(feedback_limiter, request)
    return record_feedback(
        value=body.value,
        question=body.question or "",
        reply=body.reply or "",
        mode=body.mode or "voice",
        user_comment=body.user_comment,
        trace_id=body.trace_id,
        session_id=body.session_id,
    )


@app.get("/feedback/recent", dependencies=[Depends(require_admin)])
def recent_feedback(limit: int = Query(50, ge=1, le=200)):
    return read_feedback(limit=limit)


@app.get("/analytics/summary", dependencies=[Depends(require_admin)])
def analytics_summary_route(days: int = Query(30, ge=1, le=365)):
    return analytics_summary(days)


@app.get("/feedback/analytics", dependencies=[Depends(require_admin)])
def feedback_analytics_route():
    return feedback_analytics()


@app.post("/match")
async def match_job(body: JobMatchRequest, request: Request):
    enforce_rate_limit(match_limiter, request)
    try:
        result = await asyncio.to_thread(analyze_job, body.job_description)
    except ChikkiAIError as error:
        await asyncio.to_thread(record_event, "jd_match", "", None, None, None, None, None, False, error.kind)
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        await asyncio.to_thread(record_event, "jd_match", "", None, None, None, None, None, False, "bad_format")
        raise HTTPException(status_code=502, detail=str(error)) from error
    await asyncio.to_thread(record_event, "jd_match", "", None, None, None, None, None, True)
    return result


@app.post("/contact")
def create_contact(body: ContactRequest, request: Request, background_tasks: BackgroundTasks):
    enforce_rate_limit(contact_limiter, request)
    if body.website.strip():
        # Honeypot filled in: pretend success so bots do not retry.
        logger.info("Dropped contact submission caught by honeypot")
        return {"status": "received"}
    try:
        entry = save_contact(body.name, body.email, body.company, body.message, body.topics)
    except Exception as error:
        logger.exception("Failed to store contact message")
        raise HTTPException(status_code=500, detail="Could not send your message. Please try again.") from error
    background_tasks.add_task(notify_contact, entry)
    return {"status": "received"}


@app.get("/contact/recent", dependencies=[Depends(require_admin)])
def recent_contacts(limit: int = Query(50, ge=1, le=200)):
    return read_contacts(limit=limit)


async def synthesize_b64(
    text: str,
    voice: str | None = None,
    user_msg: str = "",
    language: str | None = None,
) -> str:
    try:
        tone = speech_tone(user_text=user_msg, reply=text)
        audio_bytes = await synthesize_speech(text, voice=voice, tone=tone, language=language)
        if not audio_bytes:
            logger.warning("TTS returned empty audio for: %s", text[:60])
            return ""
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as error:
        logger.warning("TTS error: %s: %s", type(error).__name__, error)
        return ""


async def process_chikki_turn(
    websocket: WebSocket,
    user_msg: str,
    voice_mode: bool,
    language: str,
    turn_id: str | None,
    conversation_history: list[dict],
    conversation_jokes: list[str],
    detail: bool = False,
):
    full_reply = []
    sentence_buffer = ""
    last_trace_id = ""
    token_queue = asyncio.Queue()
    event_loop = asyncio.get_running_loop()
    is_joke = _is_joke_request(user_msg)

    retrieved = []
    if not is_joke:
        # Include the previous question so follow-ups like "tell me more" still retrieve.
        previous_question = next(
            (turn["content"] for turn in reversed(conversation_history) if turn["role"] == "user"), ""
        )
        try:
            retrieved = await asyncio.to_thread(
                knowledge_base.retrieve,
                f"{user_msg}\n{previous_question[:300]}",
                5 if detail else TOP_K,
            )
        except Exception:
            logger.exception("Knowledge retrieval failed; answering without it")
    knowledge_context = format_context(retrieved)
    if not is_joke:
        try:
            knowledge_context += await asyncio.to_thread(github_context, user_msg)
        except Exception:
            logger.exception("GitHub context failed; answering without it")
    turn_started = time.monotonic()
    first_token_ms: int | None = None
    turn_meta: dict = {}
    tag_filter = ActionTagFilter()
    mode = "voice" if voice_mode else "text"

    async def log_turn(ok: bool, error_kind: str | None = None):
        await asyncio.to_thread(
            record_event,
            "turn",
            user_msg,
            language,
            mode,
            turn_meta.get("provider"),
            int((time.monotonic() - turn_started) * 1000),
            first_token_ms,
            ok,
            error_kind,
            len(retrieved),
            is_joke,
        )

    def pump_tokens():
        try:
            for token_pair in stream_chikki(
                user_msg,
                conversation_history,
                language,
                previous_jokes=conversation_jokes,
                knowledge_context=knowledge_context,
                meta=turn_meta,
                detail=detail,
                voice_mode=voice_mode,
            ):
                event_loop.call_soon_threadsafe(token_queue.put_nowait, ("token", token_pair))
        except Exception as stream_error:
            event_loop.call_soon_threadsafe(token_queue.put_nowait, ("error", stream_error))
        finally:
            event_loop.call_soon_threadsafe(token_queue.put_nowait, ("done", None))

    stream_task = asyncio.create_task(asyncio.to_thread(pump_tokens))
    try:
        while True:
            event_type, event_value = await token_queue.get()
            if event_type == "done":
                break
            if event_type == "error":
                raise event_value

            delta, trace_id = event_value
            if first_token_ms is None:
                first_token_ms = int((time.monotonic() - turn_started) * 1000)
            if trace_id:
                last_trace_id = trace_id
            delta = tag_filter.feed(delta)
            if not delta:
                continue
            full_reply.append(delta)
            sentence_buffer += delta

            await websocket.send_json({
                "type": "token",
                "token": delta,
                "trace_id": trace_id,
                "turn_id": turn_id,
            })

            splits = SENTENCE_END.split(sentence_buffer)
            if len(splits) > 1 and voice_mode:
                complete_sentence = "".join(splits[:-1]).strip()
                sentence_buffer = splits[-1]
                if complete_sentence:
                    b64_audio = await synthesize_b64(
                        complete_sentence,
                        user_msg=user_msg,
                        language=language,
                    )
                    if b64_audio:
                        await websocket.send_json({
                            "type": "audio_chunk",
                            "data": b64_audio,
                            "mime": "audio/mpeg",
                            "text": clean_for_speech(complete_sentence, language),
                            "trace_id": trace_id,
                            "turn_id": turn_id,
                        })

        await stream_task

        tail = tag_filter.finish()
        if tail:
            full_reply.append(tail)
            sentence_buffer += tail
            await websocket.send_json({
                "type": "token",
                "token": tail,
                "trace_id": last_trace_id,
                "turn_id": turn_id,
            })

        if sentence_buffer.strip() and voice_mode:
            b64_audio = await synthesize_b64(
                sentence_buffer.strip(),
                user_msg=user_msg,
                language=language,
            )
            if b64_audio:
                await websocket.send_json({
                    "type": "audio_chunk",
                    "data": b64_audio,
                    "mime": "audio/mpeg",
                    "text": clean_for_speech(sentence_buffer.strip(), language),
                    "trace_id": last_trace_id,
                    "turn_id": turn_id,
                })

        final_text = "".join(full_reply)
        conversation_history.extend([
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": final_text},
        ])
        del conversation_history[:-12]
        if is_joke and final_text.strip():
            conversation_jokes.append(final_text.strip())
            del conversation_jokes[:-10]

        await websocket.send_json({
            "type": "text",
            "reply": final_text,
            "meta": {
                "trace_id": last_trace_id,
                "isError": False,
                "turn_id": turn_id,
                "kind": "joke" if is_joke else None,
                "sources": sources_for(retrieved),
                "actions": tag_filter.actions,
            },
            "turn_id": turn_id,
        })
        await log_turn(True)
    except asyncio.CancelledError:
        raise
    except ChikkiAIError as error:
        logger.warning("All providers failed (%s)", error.kind)
        await log_turn(False, error.kind)
        await websocket.send_json({
            "type": "text",
            "reply": str(error),
            "meta": {"isError": True, "kind": error.kind, "turn_id": turn_id},
            "turn_id": turn_id,
        })
    except WebSocketDisconnect:
        raise
    except Exception:
        # Never leave the visitor waiting on a turn that crashed unexpectedly.
        logger.exception("Conversation turn crashed")
        await log_turn(False, "internal")
        await _send_error(websocket, "Something went wrong on my side. Please try asking again.", "internal", turn_id)


async def _send_error(websocket: WebSocket, message: str, kind: str, turn_id: str | None) -> None:
    await websocket.send_json({
        "type": "text",
        "reply": message,
        "meta": {"isError": True, "kind": kind, "turn_id": turn_id},
        "turn_id": turn_id,
    })


async def handle_chikki_ws(websocket: WebSocket):
    ip = client_ip(websocket)
    if not ws_connections.acquire(ip):
        logger.warning("Rejected WebSocket from %s: too many open connections", ip)
        await websocket.close(code=1008, reason="Too many connections")
        return

    await websocket.accept()
    conversation_history = []
    conversation_jokes = []
    resume_refresh_task = asyncio.create_task(asyncio.to_thread(sync_drive_resume))
    active_turn_task = None
    receive_task = asyncio.create_task(websocket.receive_json())

    try:
        while True:
            wait_for = {receive_task}
            if active_turn_task is not None:
                wait_for.add(active_turn_task)
            completed, _ = await asyncio.wait(wait_for, return_when=asyncio.FIRST_COMPLETED)

            if active_turn_task is not None and active_turn_task in completed:
                try:
                    active_turn_task.result()
                except asyncio.CancelledError:
                    pass
                except Exception:
                    logger.exception("Conversation turn failed")
                active_turn_task = None

            if receive_task not in completed:
                continue

            data = receive_task.result()
            receive_task = asyncio.create_task(websocket.receive_json())

            if not isinstance(data, dict):
                continue

            if data.get("type") == "interrupt":
                if active_turn_task is not None:
                    active_turn_task.cancel()
                    try:
                        await active_turn_task
                    except asyncio.CancelledError:
                        pass
                    active_turn_task = None
                continue

            if data.get("type") == "sync":
                conversation_history = sanitize_history(data.get("history", []))
                conversation_jokes = sanitize_jokes(data.get("joke_history", []))
                continue

            user_msg = data.get("message") or data.get("text") or ""
            if not isinstance(user_msg, str) or not user_msg.strip():
                continue
            voice_mode = bool(data.get("voice", True))
            language = data.get("language", "en-IN")
            if language not in {"en-IN", "hi-IN", "te-IN"}:
                language = "en-IN"
            turn_id = data.get("turn_id")
            turn_id = turn_id[:100] if isinstance(turn_id, str) else None

            if len(user_msg) > MAX_MESSAGE_CHARS:
                await _send_error(
                    websocket,
                    f"That message is a bit long. Please keep it under {MAX_MESSAGE_CHARS} characters.",
                    "too_long",
                    turn_id,
                )
                continue

            if not chat_limiter.allow(ip):
                logger.warning("Chat rate limit exceeded for %s", ip)
                await _send_error(
                    websocket,
                    "You're asking faster than I can think! Please wait a moment and try again.",
                    "rate_limit",
                    turn_id,
                )
                continue

            if resume_refresh_task is not None:
                try:
                    await resume_refresh_task
                except Exception:
                    logger.exception("Background resume refresh failed")
                resume_refresh_task = None

            if active_turn_task is not None:
                active_turn_task.cancel()
                try:
                    await active_turn_task
                except asyncio.CancelledError:
                    pass

            active_turn_task = asyncio.create_task(process_chikki_turn(
                websocket,
                user_msg,
                voice_mode,
                language,
                turn_id,
                conversation_history,
                conversation_jokes,
                bool(data.get("detail")) or is_detail_request(user_msg),
            ))

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket session crashed for %s", ip)
    finally:
        ws_connections.release(ip)
        receive_task.cancel()
        if active_turn_task is not None:
            active_turn_task.cancel()
        if resume_refresh_task is not None:
            resume_refresh_task.cancel()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await handle_chikki_ws(websocket)


@app.websocket("/ws/voice")
async def ws_voice_endpoint(websocket: WebSocket):
    await handle_chikki_ws(websocket)
