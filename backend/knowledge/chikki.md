# Chikki Project

## What Chikki is

Chikki is Akash's voice-first AI career assistant and interactive portfolio. It helps visitors explore his verified experience, skills, projects, and career context through voice or text. Chikki is Akash's implemented personal project.

## Frontend stack

The frontend uses React 18, Vite, Tailwind CSS, and Framer Motion. Browser Web Speech APIs handle wake-phrase detection and speech recognition. An animated SVG robot shows expression states such as listening, thinking, speaking, curious, confident, playful, and laughing, and reacts to pointer interaction. A separate text chat mode works without a microphone, and the transcript is saved in browser storage and restored to the backend after reconnecting.

## Backend stack

The backend uses Python 3.12, FastAPI, REST endpoints, and WebSockets. Replies stream token by token over the WebSocket, and each complete sentence is converted to speech with Edge-TTS so audio starts before the full answer is finished. Spoken captions are revealed in sync with the audio. Langfuse provides tracing and observability when configured.

## Model routing and resilience

Chikki connects to OpenAI-compatible model providers in priority order: Groq, Gemini, NVIDIA, and OpenRouter. A per-provider circuit breaker skips a provider that recently failed, for 30 seconds after transient errors or 10 minutes after authentication or retired-model errors, and the request falls through to the next healthy provider. A clear, friendly error is returned only when every provider fails. If Edge-TTS is unavailable, the browser's built-in speech synthesis speaks the reply instead.

## Retrieval-augmented answers

In version 2.0 Chikki added retrieval-augmented generation. Verified project write-ups are split into chunks and indexed with BM25 keyword scoring, and when NVIDIA embeddings are configured, dense vector similarity is fused with the keyword ranking using reciprocal rank fusion. The most relevant excerpts are added to the prompt for each question, and the sources are shown to the visitor in text chat. The full resume always stays in the prompt as the ground truth.

## Security and reliability engineering

Version 2.0 added an admin token for the feedback analytics and resume sync endpoints, per-IP rate limits on chat, speech, resume, and feedback requests, a cap on concurrent WebSocket connections, and size limits on messages and synced conversation history. Feedback moved from a log file to SQLite. The backend has a pytest suite and a GitHub Actions workflow that runs the tests and the frontend build on every change.

## Conversation design

Chikki speaks in short, natural sentences designed to sound good aloud, avoids markdown and emojis in spoken output, and adapts its voice tone (excited, empathetic, confident, laughing) to the conversation. It supports English, Hindi, and Telugu. Jokes are generated fresh, with memory of previously told jokes so the same premise is not repeated.

## Resume generation

Resume downloads are generated from the latest Google Drive resume. The visitor's recent questions are used to reorder existing verified experience, skills, and projects so the most relevant content appears first. The PDF is text-based, single-column, and ATS-friendly. No new achievements, employers, or metrics are ever generated.

## Contact and scheduling

Visitors can leave a message for Akash with their name, email, company, and note, using the single "Contact Akash" button, which also shows his email and phone to copy. Messages are saved for Akash to review and can trigger an instant notification, with rate limiting and a spam honeypot. When a booking link is configured, the same window offers a "Book a call" link to schedule directly.

## Engineering approach

Akash designed Chikki around planning for failure and future change: provider fallback, reconnect and history handling, an accessible text fallback, observability, user feedback, abuse protection, automated tests, and modular frontend and backend responsibilities make it more resilient and easier to extend than a single-path demo. Chikki is a portfolio product, not a production-scale system, and no latency, adoption, or availability metrics are claimed.
