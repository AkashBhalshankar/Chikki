import base64
import asyncio
import os
import re

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from ai import ChikkiAIError, _is_joke_request, ask_chikki, stream_chikki
from feedback_store import feedback_analytics, read_feedback, record_feedback
from generate_resume_pdf import build_resume_pdf
from models import FeedbackRequest
from resume import build_system_prompt, sync_resume as sync_resume_profile
from resume_loader import sync_drive_resume
from tts import clean_for_speech, synthesize_speech, speech_tone


app = FastAPI(title="Chikki AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SENTENCE_END = re.compile(r"([.!?।॥\n]+(?:\s+|$))")


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None
    language: str | None = None


class ResumeDownloadRequest(BaseModel):
    focus: str = ""
    linkedin_url: str = ""
    github_url: str = ""


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        # Routed through tts.py now - this cleans markdown/asterisks out of
        # the text and picks a tone-appropriate rate/pitch, instead of a
        # raw edge_tts call that skipped both.
        tone = speech_tone(reply=text)
        audio_bytes = await synthesize_speech(
            text,
            voice=req.voice,
            tone=tone,
            language=req.language,
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resume/sync")
def sync_resume_route():
    try:
        return {"status": "success", "data": sync_resume_profile()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/resume")
def download_resume(focus: str = "", linkedin_url: str = "", github_url: str = ""):
    return _resume_pdf_response(focus, linkedin_url, github_url)


@app.post("/resume")
def download_resume_post(request: ResumeDownloadRequest):
    return _resume_pdf_response(request.focus, request.linkedin_url, request.github_url)


def _resume_pdf_response(focus: str, linkedin_url: str, github_url: str):
    try:
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
        raise HTTPException(status_code=500, detail="Resume generation failed") from error


@app.post("/feedback")
def create_feedback(request: FeedbackRequest):
    if request.value not in {"helpful", "needs-improvement"}:
        raise HTTPException(status_code=422, detail="Feedback value must be helpful or needs-improvement")
    return record_feedback(
        value=request.value,
        question=request.question or "",
        reply=request.reply or "",
        mode=request.mode or "voice",
        user_comment=request.user_comment,
        trace_id=request.trace_id,
        session_id=request.session_id,
    )


@app.get("/feedback/recent")
def recent_feedback(limit: int = Query(50, ge=1, le=200)):
    return read_feedback(limit=limit)


@app.get("/feedback/analytics")
def feedback_analytics_route():
    return feedback_analytics()


async def synthesize_b64(
    text: str,
    voice: str | None = None,
    user_msg: str = "",
    language: str | None = None,
) -> str:
    """
    Synthesizes text to a base64 mp3 string so the frontend audio queue
    can play it instantly. Now goes through tts.py's synthesize_speech,
    which cleans the text for speech (strips markdown/asterisks/etc) AND
    applies speech_tone()'s rate/pitch profile - previously this function
    called edge_tts directly and skipped both of those entirely, which is
    why tone changes and text cleanup were never actually happening.
    """
    try:
        tone = speech_tone(user_text=user_msg, reply=text)
        audio_bytes = await synthesize_speech(text, voice=voice, tone=tone, language=language)
        if not audio_bytes:
            return ""
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception:
        return ""


async def process_chikki_turn(
    websocket: WebSocket,
    user_msg: str,
    voice_mode: bool,
    language: str,
    turn_id: str | None,
    conversation_history: list[dict],
    conversation_jokes: list[str],
):
    full_reply = []
    sentence_buffer = ""
    last_trace_id = ""
    token_queue = asyncio.Queue()
    event_loop = asyncio.get_running_loop()

    def pump_tokens():
        try:
            for token_pair in stream_chikki(
                user_msg,
                conversation_history,
                language,
                previous_jokes=conversation_jokes,
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
            full_reply.append(delta)
            sentence_buffer += delta
            if trace_id:
                last_trace_id = trace_id

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
        is_joke = _is_joke_request(user_msg)
        if is_joke and final_text.strip():
            conversation_jokes.append(final_text.strip())

        await websocket.send_json({
            "type": "text",
            "reply": final_text,
            "meta": {
                "trace_id": last_trace_id,
                "isError": False,
                "turn_id": turn_id,
                "kind": "joke" if is_joke else None,
            },
            "turn_id": turn_id,
        })
    except asyncio.CancelledError:
        raise
    except ChikkiAIError as error:
        await websocket.send_json({
            "type": "text",
            "reply": str(error),
            "meta": {"isError": True, "kind": error.kind, "turn_id": turn_id},
            "turn_id": turn_id,
        })


async def handle_chikki_ws(websocket: WebSocket):
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
                active_turn_task = None

            if receive_task not in completed:
                continue

            data = receive_task.result()
            receive_task = asyncio.create_task(websocket.receive_json())

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
                incoming_history = data.get("history", [])
                incoming_jokes = data.get("joke_history", [])
                if isinstance(incoming_history, list):
                    conversation_history = [
                        {"role": turn["role"], "content": turn["content"]}
                        for turn in incoming_history
                        if isinstance(turn, dict)
                        and turn.get("role") in {"user", "assistant"}
                        and isinstance(turn.get("content"), str)
                        and turn["content"].strip()
                    ][-12:]
                if isinstance(incoming_jokes, list):
                    conversation_jokes = [
                        joke.strip()
                        for joke in incoming_jokes
                        if isinstance(joke, str) and joke.strip()
                    ]
                continue

            user_msg = data.get("message") or data.get("text") or ""
            voice_mode = data.get("voice", True)
            language = data.get("language", "en-IN")
            turn_id = data.get("turn_id")
            is_joke = _is_joke_request(user_msg)

            if not user_msg.strip():
                continue

            if resume_refresh_task is not None:
                await resume_refresh_task
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
            ))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        receive_task.cancel()
        if active_turn_task is not None:
            active_turn_task.cancel()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await handle_chikki_ws(websocket)


@app.websocket("/ws/voice")
async def ws_voice_endpoint(websocket: WebSocket):
    await handle_chikki_ws(websocket)