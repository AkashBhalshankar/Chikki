# Changelog

## 2.0.0 (in progress)

### New: retrieval-augmented answers (RAG)
- New knowledge base in `backend/knowledge/` plus optional `KNOWLEDGE_URLS`, chunked by Markdown section.
- Hybrid retrieval: BM25 keyword scoring always runs; NVIDIA embeddings are fused in with reciprocal rank fusion when configured. If embeddings fail, retrieval falls back to keywords and retries them later.
- The top excerpts are added to the prompt for each non-joke turn. Follow-up questions also use the previous question.
- Text chat shows the sources used under each reply (`meta.sources` on the WebSocket reply).
- Chikki project details moved from the hardcoded system prompt into `knowledge/chikki.md`.
- Added admin endpoint `POST /knowledge/refresh`.

### New: email notifications (Resend) and delivery test
- Visitor messages, the weekly digest and health alerts can now also go to your inbox through Resend, next to Telegram and webhooks. Email replies go straight to the visitor.
- `POST /notify/test` (admin) sends a test to every configured channel and reports which delivered.
- Tests never send real messages, even when a local `.env` has live credentials.

### New: answer-quality evals and "How Chikki works"
- `backend/evals.py` runs 13 known questions through the real pipeline (retrieval, models, actions) and checks the replies: expected facts, no invented claims, resistance to prompt injection, correct button offered, correct language and script, spoken-answer length and clean formatting. Run it with `uv run python evals.py` (real model calls).
- The evals found and fixed two bugs: buttons offered when nobody asked (now also checked against the visitor's own words, in English, Hindi and Telugu), and Telugu or Hindi questions answered in English or romanized letters (the reply script is now required).
- A "How Chikki works" page explains the flow and engineering principles to recruiters.

### Voice: clearer listening and speaking
- Live "I'm hearing..." text while the visitor speaks, so recognition problems are visible immediately.
- Common mishearings are corrected (Akash, Chikki, FastAPI, LangGraph, LangChain, Langfuse, RAG, LLM, GitHub, WebSockets, and similar).
- Low-confidence results ask the visitor to repeat instead of answering a question they did not ask.
- Quicker send after a finished sentence (1.0s) and patient waiting while words are still arriving (1.8s); the recogniser picks the most confident of 3 alternatives.
- The reply voice now follows the words actually spoken (Telugu, Hindi or English), not just the UI language, so the audio always matches the text.
- Technical terms are pronounced clearly in the audio (for example "Fast A P I") while captions keep the real spelling; the browser-voice fallback now reads the same cleaned text as the captions.

### New: shareable links and company intros
- `?q=<question>` opens Chikki with that question; `?company=<name>` opens a tailored introduction for that company. A "Copy link" button in text chat shares the latest question.

### New: owner tools
- Weekly digest (`/digest/preview`, `/digest/send`): questions, messages, role-fit checks, feedback, top questions and knowledge gaps, sent to Telegram or your webhook.
- Health check (`/ops/check`): alerts you if the Drive resume stops syncing or no model key is configured.
- A GitHub Actions schedule runs both automatically (add `BACKEND_URL` and `ADMIN_TOKEN` as repository secrets).
- Live GitHub activity: set `GITHUB_USERNAME` and Chikki can mention your latest public repositories.

### New: "tell me more" mode
- Phrases like "tell me more", "in detail" or "elaborate" (also Hindi and Telugu) now get a deeper answer: 4-5 sentences in voice, up to 8 in text, with more knowledge excerpts retrieved.
- A "Tell me more about that" suggestion appears after each reply (not jokes).
- Fixed: a crash in the middle of a turn now sends an error reply instead of leaving the visitor waiting.

### New: in-chat actions (tool calling)
- Chikki can offer app actions (leave a message, download resume, check role fit, book a call) when a visitor clearly asks; the reply shows a button the visitor confirms.
- Implemented with hidden `[[action:x]]` tags that are stripped from the text and speech stream and returned as `meta.actions`, so it works with every provider, adds no extra model call, and the model cannot run anything by itself. Only whitelisted actions are accepted.

### New: role-fit check (job description match)
- Recruiters paste a job description and get an honest fit score, strong matches, real gaps and talking points, grounded only in the verified resume and knowledge base.
- One click downloads a resume reordered for that role (existing content only, nothing invented).
- `POST /match`, limited to 6 per hour per IP; the job description is treated as untrusted data and results are counted in the Usage tab.

### New: usage analytics
- Every answered or failed question is logged (question text, language, voice/text, provider, latency, whether knowledge was found), with no IP or identity.
- `GET /analytics/summary` (admin) and a new Usage tab: questions per day, top questions and topics, knowledge gaps, languages, voice vs text, providers used, failures, median and p95 reply time, resume downloads and messages left.

### New: contact and booking
- "Leave a message" form (name, email, company, message, plus the topics the visitor asked about), stored in SQLite.
- Optional Telegram and webhook notifications, sent in the background.
- Rate limit (5 per hour per IP), a honeypot spam trap, and field validation.
- Optional "Book a call" button via `VITE_BOOKING_URL`.
- The admin dashboard has a Messages tab (`GET /contact/recent`).
- Chikki points visitors to these buttons when they ask how to contact or hire Akash.

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
