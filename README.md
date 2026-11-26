# Chikki: Voice-First AI Career Assistant

A voice-first AI career assistant. Recruiters can ask about Akash by voice or
text. Chikki answers using the configured AI providers and the current Google
Drive resume.

**Version:** 2.0.0 — see [CHANGELOG.md](CHANGELOG.md).

## 1. Backend setup

The backend uses Python 3.12 and [uv](https://docs.astral.sh/uv/) (pip also works).

```bash
cd backend
uv sync                          # or: python -m venv .venv && pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:

- **At least one LLM provider key.** Chikki tries them in this order:
  Groq → Gemini → NVIDIA → OpenRouter. Providers that fail are skipped for a
  short time.
- **`GOOGLE_DRIVE_RESUME_URL`:** the resume Chikki reads from.
- **`ADMIN_TOKEN`:** a long random value. It protects the feedback dashboard
  and `/resume/sync`. Generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

Run it:

```bash
uv run uvicorn main:app --reload --port 8000 --no-access-log
```

Visit http://localhost:8000/health. You should see `{"status": "ok", "version": "2.0.0"}`.

### Tests

```bash
cd backend
uv sync --group dev
uv run pytest -q
```

GitHub Actions runs the backend tests and the frontend build on every push and pull request.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173, allow microphone access, and say **"Chikki"**.

## 3. Editing what Chikki knows

Update the Google Drive resume configured by `GOOGLE_DRIVE_RESUME_URL` (or
`GOOGLE_DRIVE_FILE_ID`). Chikki refreshes and reads that source, and the
resume download is generated from its current content. Personal projects are
limited to implemented projects.

## 4. Knowledge base (RAG)

Chikki retrieves relevant excerpts from verified write-ups for each question
and shows them as sources in text chat. The full resume always stays in the
prompt as the ground truth.

- Add Markdown files to [backend/knowledge/](backend/knowledge/). Use one file
  per project, with `##` sections. The index rebuilds automatically when files change.
- Optionally add raw README URLs with `KNOWLEDGE_URLS`, for implemented projects only.
- Retrieval uses BM25 keyword scoring. When `NVIDIA_EMBED_MODEL` is set to an
  available embedding model (recommended: `nvidia/nemotron-3.5-embed-1b`, see `.env.example`), dense similarity is fused in (hybrid search).
  Embedding errors fall back to keyword search automatically.
- Admins can force a rebuild with `POST /knowledge/refresh` (needs `X-Admin-Token`).

## 5. Contact and booking

- **Leave a message:** visitors send their name, email, company and a message.
  Messages appear in the dashboard's **Messages** tab.
  - Notifications (also used for the weekly digest and health alerts): Telegram
    (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`), email through Resend
    (`RESEND_API_KEY`, `CONTACT_TO`, optional `CONTACT_FROM`) and/or SMTP such as Gmail with an
    App Password (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), and/or `CONTACT_WEBHOOK_URL`.
    Resend is tried first, SMTP is the fallback. Render's free tier blocks SMTP, so use Resend there.
    Emails use the visitor as Reply-To, so replying answers them directly.
  - Resend's default sender can only email your own Resend account address. To email any
    address, verify a domain at resend.com/domains and set `CONTACT_FROM`.
  - Test delivery any time with `POST /notify/test` (admin token).
  - Protected by a rate limit (5 per hour per IP) and a spam honeypot.
- **Book a call:** set `VITE_BOOKING_URL` (Cal.com or Calendly) to show the button.

## 6. Admin: feedback dashboard

Open the 📊 dashboard in the app and enter your `ADMIN_TOKEN`. The token is
kept only for that browser tab session. Never put the token in a `VITE_*`
variable, because those are public.

Feedback is stored in SQLite at `FEEDBACK_DB_PATH`. The default is
`backend/data/feedback.db`. Any legacy `feedback_log.jsonl` entries are
imported automatically on first start.

## 7. Security defaults

- Per-IP rate limits:
  - chat: 20/min
  - TTS: 30/min
  - resume: 6/min
  - feedback: 20/min
- Up to 3 concurrent WebSocket connections per IP.
- Chat messages are capped at 1,000 characters.
- All limits can be tuned in `.env`. See `.env.example`.

## 8. Deploying

- **Backend → Render**
  - Connect the repository. Render reads `render.yaml`, which also generates an `ADMIN_TOKEN` for you. Copy it from the Render dashboard.
  - Set at least one provider key and `GOOGLE_DRIVE_RESUME_URL`.
  - Set `ALLOWED_ORIGINS` to your exact frontend origins.
  - **Feedback persistence:** Render's default disk is wiped on every deploy. To keep feedback, attach a persistent disk (for example at `/var/data`) and set `FEEDBACK_DB_PATH=/var/data/feedback.db`.
- **Frontend → Vercel**
  - Import `frontend/` as the project root.
  - Set `VITE_API_URL` to the HTTPS Render backend origin, with no trailing slash.
  - Optionally set `VITE_LINKEDIN_URL`, `VITE_GITHUB_URL`, `VITE_CONTACT_EMAIL` and `VITE_CONTACT_PHONE`. Each contact button stays hidden until its value is set.
  - Redeploy after changing any `VITE_*` value, because they're embedded at build time.
- Never commit `.env` files or provider secrets.

## Notes

- Speech recognition (wake word and speech-to-text) uses the browser's Web
  Speech API, which works best in Chrome or Edge on desktop.
- Voice output uses Edge-TTS (free, no key needed). The browser's own speech
  synthesis is the fallback.
- Langfuse tracing is enabled when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set.
