# Chikki: Voice-First AI Career Assistant

Chikki is a voice-first AI career assistant built to represent Akash Bhalshankar to recruiters, engineering leaders, and visitors.

She answers questions about Akash's experience, skills, projects, certifications, and career journey using a natural voice conversation instead of another static portfolio page.

> The portfolio has a chatbot. Chikki has opinions about meetings, feelings about deployments, and enough personality to know that "it works on my machine" is not a production strategy.

## What Chikki Can Do

### Voice-first interaction

- Listens for a wake phrase such as "Hey Chikki".
- Uses the browser Web Speech API for wake-word detection and speech recognition.
- Accepts natural spoken questions.
- Responds aloud using Microsoft Edge-TTS.
- Uses a configurable female voice by default: `en-IN-NeerjaNeural`.
- Supports configurable speech rate and pitch through environment variables.

### Text conversation

- Provides a separate text-only chat mode when microphone access is unavailable or not preferred.
- Keeps the voice and text modes intentionally separate.
- Persists the chat transcript in browser storage.
- Restores conversation history to the backend after reconnecting.
- Does not generate audio in text mode, which keeps typed conversations faster and quieter.

### Human-like expressions

Chikki's animated robot reacts to the conversation instead of displaying one static avatar.

Current expression vocabulary includes:

- Idle and listening
- Waking and greeting
- Thinking and speaking
- Happy and excited
- Celebrating and proud
- Curious and surprised
- Playful and wink
- Love and grateful
- Encouraging and confident
- Focused and determined
- Relieved and apologetic
- Concerned, skeptical, confused, sad, sleepy, and error states
- Joyful and laughing states for humor and celebration

Expressions are selected from conversational cues. Ordinary replies stay calm and neutral, while clear moments of excitement, uncertainty, gratitude, apology, or celebration get a matching reaction.

Expressions remain visible through the spoken answer and stay on screen briefly after playback, so the visual reaction has time to match the words instead of disappearing immediately.

## Interactive Conversation Hooks

Chikki gives visitors useful ways to continue the conversation instead of leaving them at an empty input:

- Quick prompts for projects, hiring value, technical skills, and developer jokes
- Contextual follow-up suggestions after an answer
- Prompt buttons available in voice mode and text mode
- New prompts clear stale suggestions so the interface stays focused
- Joke requests trigger playful or laughing expressions
- Resume download action backed by the profile data
- Optional LinkedIn and email contact actions configured through environment variables
- Helpful or needs-improvement feedback after responses, stored in the backend JSONL log and exposed through the analytics dashboard

This creates a guided portfolio experience while still allowing completely open-ended questions.

## Interaction-Aware Resume Downloads

The resume download is intentionally context-aware while remaining truthful.

- Before a visitor asks anything, Chikki downloads the general resume.
- After a visitor asks about a topic such as LangGraph, RAG, FastAPI,
        testing, NavLearn, Azure, or AI agents, the next download is tailored to
        that topic.
- The backend refreshes the configured Google Drive PDF or document and uses its current verified text as the resume source.
- The Drive text cache refreshes every 15 minutes. Chikki recalculates approximate experience from role month/year dates and uses roles marked Present/Current to identify the current employer.
- If the Drive resume has no Personal Projects section, Chikki adds only the verified Chikki project entry from the bundled resume source.
- Researched ideas that have not been implemented are intentionally excluded from the Personal Projects section.
- Tailoring only reorders existing verified content from the Drive resume and bundled project source.
- Relevant experience bullets, projects, and skill groups move higher in the
        document.
- The latest five visitor questions guide the relevance ranking.
- The generated PDF is a searchable, single-column ATS layout with standard
        headings, selectable text, and no tables or graphics.
- No new achievements, technologies, responsibilities, employers, or metrics
        are generated.
- The PDF uses years only, such as `1.5 years`; it does not expose month
        counts in the downloaded resume.
- Chikki can still answer exact duration questions conversationally when a
        visitor asks for months or detailed dates.

The browser sends recent topic keywords and profile URLs in the JSON body of
`POST /resume`, so the visitor's full conversation is not placed in the URL
or standard HTTP access logs. `GET /resume` remains available for a general
resume download and backwards compatibility.

```text
POST /resume  { "focus": "LangGraph RAG" }
POST /resume  { "focus": "testing NavLearn Selenium" }
GET  /resume
```

This keeps the resume useful for recruiters and technical visitors without
turning the download into an AI-generated document with unsupported claims.

Frontend contact configuration:

```env
VITE_RESUME_URL=http://localhost:8000/resume
VITE_LINKEDIN_URL=https://www.linkedin.com/in/your-real-profile
VITE_GITHUB_URL=https://github.com/your-real-profile
VITE_CONTACT_EMAIL=your-real-email@example.com
```

LinkedIn and email buttons remain hidden until real values are configured. The
resume action uses the backend `/resume` endpoint and downloads a tailored PDF
generated from the latest Drive source.
Configured LinkedIn and GitHub profile links are clickable in the interface
and embedded as clickable PDF links; resume focus terms are sent only with the
resume request.

## What Chikki Is

Chikki is Akash's voice-first AI career assistant and interactive portfolio.
It lets visitors explore verified experience, skills, and projects through
voice or text, and can generate a resume ordered around their recent questions.

The implementation uses React 18, Vite, Tailwind CSS, and Framer Motion in the
frontend; Python 3.12, FastAPI, and WebSockets in the backend; browser speech
recognition and Edge-TTS for voice; configured Groq, Gemini, NVIDIA, and
OpenRouter-compatible model providers; and Langfuse observability when
configured. ReportLab and pypdf generate and inspect searchable PDF resumes.

Its forward-looking engineering choices include provider fallback, persisted
conversation context across reconnects, a text fallback for voice access,
observability, user-feedback analytics, and resume personalization that keeps
all claims grounded in the maintained source documents.

The resume presents Chikki as the sole implemented personal project, with
three concise highlights: its React/FastAPI voice stack, its resilience and
conversation design, and its Google Drive-to-ATS resume workflow. Other ideas
that have only been researched are not presented as completed projects.

## Emotion-Aware Voice Delivery

The female Edge-TTS voice adapts its delivery to the conversation:

- Humor and jokes use a brighter, more energetic delivery.
- The opening joke beat uses a distinct laughing prosody; the follow-up beat
        settles into a joyful tone.
- Excited or celebratory answers use slightly faster, higher-pitched speech.
- Apologies and difficult topics use a slower, gentler delivery.
- Technical explanations use a measured, focused delivery.
- Ordinary conversation uses the configured natural voice settings.

The voice remains configurable through `TTS_VOICE`, `TTS_RATE`, and `TTS_PITCH`.

### Natural conversational personality

Chikki is instructed to:

- Use short, clear sentences that sound good aloud.
- Speak warmly and professionally.
- Use contractions and varied acknowledgements.
- Show empathy when someone is confused or frustrated.
- Avoid robotic explanations, markdown-heavy speech, and fake stage directions.
- Answer the actual question instead of delivering an unsolicited career biography.
- Add light humor when it fits the moment.

### Developer-friendly humor

When invited, Chikki can tell short, original jokes about:

- Technology and debugging
- Corporate meetings and email culture
- Coffee, deployments, deadlines, and developer life
- Everyday situations that software engineers recognize

Joke requests rotate through technology, AI, new technology, corporate
life, developer life, SDLC, QA, production, deployment, and weekend topics.
Recent assistant replies are supplied as exclusions so the next joke gets a
new setup and premise instead of repeating the same cache joke forever.

During a joke, the robot starts with a playful, laughing, or joyful reaction,
keeps it through the spoken punchline, then changes to a second reaction for
the post-joke beat before returning to listening.

Examples:

> Why did the developer go broke? They used up all their cache.

> A meeting about scheduling the next meeting can still run over time. That is enterprise-level recursion.

> "It works on my machine" is the developer version of "the dog ate my homework."

Humor stays friendly and appropriate. Serious, emotional, troubleshooting, and recruiter questions remain the priority.

## Resilient AI Model Routing

Chikki now has ordered model fallback instead of depending on one model.

The request path tries each configured provider in order:

1. Try the configured Groq model.
2. If Groq fails, try the configured Gemini-compatible provider.
3. If Gemini fails, try the configured NVIDIA provider.
4. If NVIDIA fails, try the configured OpenRouter provider.
5. Return a clear user-facing error only after all configured providers fail.

This improves availability when a configured provider is rate-limited,
unavailable, or temporarily unhealthy. The active model names and credentials
remain environment-driven.

## Technical Architecture

```text
Browser microphone
        |
        v
Web Speech API -> React interaction state -> WebSocket
                                      |
                                      v
                           FastAPI conversation backend
                                      |
                    Groq -> Gemini -> NVIDIA -> OpenRouter
                                      |
                         Text response + Edge-TTS audio
                                      |
                                      v
                         Animated React robot response
```

### Frontend

- React 18
- Vite
- Framer Motion
- Tailwind CSS
- Web Speech API
- WebSocket client
- Persistent browser chat history
- Animated SVG robot with expression states

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- WebSocket voice endpoint
- REST health and TTS endpoints
- Groq integration
- Gemini-compatible, NVIDIA, and OpenRouter integrations
- Edge-TTS voice synthesis
- Langfuse observability when configured
- ReportLab and pypdf for ATS-oriented resume generation
- Environment-driven model and voice configuration

### Knowledge source

Chikki's career knowledge is maintained in the configured Google Drive resume.
The backend fetches and parses the latest PDF or Google Doc text; updating that
source updates Chikki's answers and tailored resume downloads without changing
the React components or AI routing logic. Verified personal projects from the
bundled resume are included when the Drive document does not have its own
Personal Projects section.

## Why This Matters to Recruiters and Engineering Leaders

Chikki demonstrates more than a chat completion. It shows an end-to-end AI product with:

- A user-facing voice experience
- Browser speech recognition
- Real-time WebSocket communication
- Backend orchestration and error handling
- Multi-provider model resilience
- Ordered model fallback
- TTS integration
- Conversation memory
- Persistent client-side state
- Human-centered interaction design
- Explainable expression and interaction states
- Deployment-ready frontend and backend separation

It is a practical demonstration of building AI systems that people can actually use, not just a notebook that ends with `print(response)`.

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate       # Windows
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, allow microphone access, and say "Hey Chikki".

Never commit `.env` files or API keys. Configure secrets locally or in the deployment platform.

## Deployment

- Backend: Render using `render.yaml`
- Frontend: Vercel using the `frontend/` directory
- Frontend environment variable: `VITE_API_URL`
- Backend environment variables: provider keys, model fallback values, TTS settings, and allowed frontend origins

## LinkedIn Post Draft

### Headline

I built Chikki, a voice-first AI career assistant that can talk about my work, react like a human, and survive a model outage.

### Post

I have been building Chikki, a voice-first AI career assistant designed to represent my professional experience to recruiters, engineering leaders, and curious visitors.

Instead of another static portfolio, Chikki lets someone say "Hey Chikki" and ask about my experience, skills, projects, certifications, and AI engineering work. She listens, thinks, answers aloud with a female voice, and reacts with expressions that match the conversation.

The project brings together:

- React, Vite, Tailwind CSS, and Framer Motion
- Browser speech recognition and wake-word interaction
- FastAPI and WebSockets for real-time communication
- Groq and NVIDIA AI model integrations
- Ordered multi-model fallback for better reliability
- Edge-TTS voice synthesis
- Persistent conversation history
- Text mode as a graceful fallback when voice is unavailable
- Context-aware expressions such as curious, focused, confident, apologetic, grateful, playful, and celebratory
- Natural conversation guidelines with light tech and developer humor

One of the improvements I recently added was model resilience. Chikki no longer depends on a single NVIDIA model. If the primary model is unavailable, rate-limited, retired, or unhealthy, the backend moves through the configured NVIDIA fallback models and then reports a clear error only if every option fails.

That change reflects an important lesson in AI engineering: a demo can be impressive when everything works, but a product becomes trustworthy when it has a plan for when something does not.

And yes, Chikki knows the classic debugging joke:

"It works on my machine."

The production environment is still waiting for the sequel.

I am currently open to AI Engineer opportunities where I can work on multi-agent systems, RAG, LLM applications, FastAPI backends, model orchestration, and reliable AI products.

#AIEngineering #GenerativeAI #LLM #NVIDIAAI #FastAPI #Python #React #MachineLearning #VoiceAI #OpenToWork

### 1. Dynamic Google Drive PDF Stream Ingestion & Parser
- **Direct Stream Extraction:** Built `fetch_resume_from_drive(drive_url)` using `requests` and `io.BytesIO` to download the live PDF binary directly via Google Drive's file export endpoint (`/uc?export=download&id=...`).
- **AST/Text Parsing:** Integrated `pypdf.PdfReader` to extract and normalize text across all PDF pages into a single string.
- **In-Memory Hot Caching:** Cached both the raw parsed string (`_CACHED_RESUME_TEXT`) and binary bytes (`_CACHED_RESUME_PDF`) in memory so downstream requests avoid repeated network round-trips.

---

### 2. Live Resume Synchronization Endpoints (`backend/main.py`)
- **`POST /resume/sync`:** Added an on-demand synchronization route that re-fetches the Drive document, extracts text, refreshes the memory cache, and returns character metrics without server restarts.
- **`@app.on_event("startup")`:** Configured the application lifecycle to auto-sync the resume on startup when `GOOGLE_DRIVE_RESUME_URL` is set in `.env`.
- **`GET /resume`:** Updated the download route to serve the cached Google Drive PDF binary directly to recruiters with `application/pdf` attachment headers, falling back to local generation if uninitialized.

---

### 3. Dynamic LLM Prompt Context Prioritization (`backend/resume.py`)
- **System Prompt Prioritization:** Integrated `get_current_resume_text()` into `build_system_prompt()`.
- **Graceful Fallback:** Automatically selects the live Google Drive document text when present, falling back to the static `resume.json` baseline if the network is unavailable or unconfigured.

---

### 4. Environment & Runtime Configuration
- **Environment Variables:** Configured `GOOGLE_DRIVE_RESUME_URL` in `backend/.env`.
- **Dependency Integration:** Added `pypdf` and `requests` to the active virtual environment.
- **Root Context Isolation:** Resolved directory module import paths to allow running Uvicorn directly from within the `backend` folder.

## Suggested LinkedIn Media

Use a short screen recording showing:

1. Saying "Hey Chikki".
2. Asking a question about your experience.
3. Chikki changing from listening to thinking to speaking.
4. The response playing in the female voice.
5. A second question that triggers a different expression.
6. The terminal or a simple architecture graphic showing model fallback.

Do not show API keys, `.env` contents, private logs, or provider credentials in the recording.
