# Changelog

## 2.0.0 (in progress)

### Security
- Feedback analytics (`/feedback/recent`, `/feedback/analytics`) and `/resume/sync` now require an `X-Admin-Token` header matching `ADMIN_TOKEN`. Access is refused when no token is configured.
- The feedback dashboard asks for the admin token and keeps it only for the current browser tab session.
- Per-IP rate limits on chat messages, `/tts`, `/resume` and `/feedback`, plus a cap of 3 concurrent WebSocket connections per IP. All limits can be tuned through env vars.
- Input caps: chat messages (1,000 chars), TTS text, feedback fields, and the conversation history and joke history the client syncs (12 turns, 2,000 chars each).
- Removed the hardcoded contact email and phone number from the frontend. They now come only from `VITE_CONTACT_*`.

### Reliability
- Feedback is stored in SQLite (`FEEDBACK_DB_PATH`) instead of a JSONL file. Existing `feedback_log.jsonl` entries are imported once on first start.
- A per-provider circuit breaker replaces the global "active provider". Failing providers are skipped for 30 seconds, or 10 minutes for auth and retired-model errors.
- If tracing fails after tokens have already streamed, the reply is no longer duplicated.
- Silent `except: pass` blocks now log through the standard `logging` module (`LOG_LEVEL`).
- Added a `/health` endpoint that reports the app version.

### Maintenance
- Removed unused dependencies: `langchain-nvidia-ai-endpoints`, `langchain-core` and `groq`.
- `feedback_log.jsonl` is no longer tracked in git.
- Added a pytest suite (`backend/tests`) and a GitHub Actions workflow that runs the backend tests and the frontend build.
- Updated `.env.example`, `render.yaml` and the README.
