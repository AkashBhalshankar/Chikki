# Changelog

## Accessibility, abuse protection, friendlier errors

- Daily ceiling per visitor (RATE_LIMIT_CHAT_PER_DAY, default 150) on top of the per-minute limit, with a kind message and the Contact option.
- Offline / cannot-reach-Chikki banner with Contact and Reload; error replies get Try again and Contact buttons.
- A crash shows a friendly page (Reload / Start fresh) instead of a blank screen; a damaged saved chat no longer stops the page loading.
- If the app never starts the loading screen offers a Reload after 15 seconds.
- Accessibility: focus moves into every window and stays there, returns on close; skip link; page language follows the chosen language; status text announced; High contrast setting.

## UI polish round 2

- Settings: background themes (Midnight, Sunrise, Forest, Ocean), Chikki's outfit, text size, easy-to-read font, vibration.
- Answers: skills as chips, links as small buttons, figures highlighted, a typing reveal, and a quiet 'ask about this line' button.
- Chat: day and time markers; Chikki shrinks to an avatar while you scroll on a phone; chat Chikki idles and dozes too.
- Phones: light vibration, swipe in from the right edge for More, pull down at the top to refresh, status-bar colour.
- Chikki hops in when a screen appears.

## Alive and useful

- Chikki looks around after 25s of quiet and dozes off after 60s; nods while you speak and looks surprised at 'wow'.
- The page glow follows Chikki's mood.
- Loading skeleton before the app starts, and a progress bar while the server wakes.
- Buttons press in, chips slide in, status text cross-fades; softer chimes.
- 'Summarise our chat' (copy or email).
- Project cards show a screenshot for the live projects.

## Speed and tone

- Provider race: the best provider starts alone; if silent for 1.2s the next one starts too and whichever speaks first wins.
- Quickest provider is tried first (measured), startup check seeds dead providers, rate-limited ones are skipped as long as they say.
- Instant polite replies for plain thanks, hello and goodbye (no model call, English/Telugu/Hindi).
- Courtesy rules added to Chikki's instructions.
- Smarter end-of-speech detection: finished-sounding sentences are sent sooner, ones ending on 'and', 'the', 'um' wait longer.

## Reach, speed and safety nets
- Link preview: sharing the site on LinkedIn, WhatsApp or email shows a title, a one-line pitch and a preview picture.
- A scheduled ping (every 10 minutes, `.github/workflows/keepwarm.yml`) keeps the free Render backend awake; it needs the `BACKEND_URL` secret.
- Instant answers: the start-screen questions and the interview questions are answered from a stored reply after the first time, with no model call (cleared when the resume changes; never stores a cut-off or edited reply).
- "Why this answer?" shows the notes Chikki looked up; a "Share" button turns an answer into a picture; Analytics shows a visitor funnel (visited, asked, downloaded the resume, left a message).
- Telegram owner commands (`/stats`, `/gaps`, `/answer N text`, `/health`), answered only in your chat. Off unless `TELEGRAM_COMMANDS=on`, and meant for one server only.
- Evals now cover text-chat layout, comparison tables, project order and NaChitram; a browser test (`npm run e2e`) clicks through the app in real Chrome and runs in CI.

## UI enhancements
- Text chat replies appear as they are written, and the working animation hands over to the text.
- Start screen: a one-line pitch, Resume and Contact buttons and the three live projects.
- Phones: Resume, Contact, Role fit and More sit in a bar at the bottom, and only two suggestion chips show.
- Answers carry a "Checked against the resume" badge; the small actions (copy, more detail, helpful, not helpful) share one row, shown on hover for older answers.
- Smooth fade between views, keyboard shortcuts (`/`, `?`, `Esc`), friendlier empty states, and an accent colour choice (violet, teal, amber) in Settings.

## Project links and order
- Chikki, ShareInSync and NaChitram have live links and come first (in answers, cards and the Projects window); the work projects at UBS follow. Cards carry a Live badge and an open button.
- Answers can include clickable links (only http and https are ever made clickable).

## NaChitram
- Chikki now knows the NaChitram Chrome extension (what it does, how it is built, its privacy design) from `backend/knowledge/nachitram.md`, lists it with the other projects (`projects.md`), and shows it as a project card.
- Project questions are told to cover every project in the resume and the notes, and may use up to 6 bullets.

## Install, access and efficiency
- Chikki can be installed as an app (manifest, icons, a service worker that caches nothing so deploys are never stale). Chrome reports no installability problems.
- Accessibility: visible keyboard focus, the conversation is announced to screen readers, labelled input, and people who ask their device for less motion get calmer animations.
- The system prompt is about 8% shorter (the joke rules only apply to the separate joke prompt), which stretches the Groq daily token limit a little further.

## More for recruiters and for the owner
- Interview mode: pick a role, Chikki answers five questions about Akash, then gives an honest fit verdict.
- Project cards under answers that mention a project, plus a Projects window (all text taken from the resume).
- Comparison questions answer with a small table; follow-up question chips now come from the model.
- Draft a cover note and talking points from a pasted job description.
- Voice settings: English voice (three female voices), speaking speed, how long Chikki waits after you stop talking, soft chimes. Saved per device.
- A collapsible transcript in voice mode, a wave hello on first load, a "Latest on GitHub" line, and festive looks (Christmas, New Year, Republic and Independence Day, Diwali).
- Owner inbox (Analytics > Gaps): questions Chikki could not answer; type the true answer and Chikki uses it from then on. Engaged visitors (3+ questions) appear in Analytics and the weekly digest.

## Smoother Chikki
- Expressions now blend instead of cutting: colours fade, the mouth morphs, eyes grow and slide, closed eyes fade in, and decorations (blush, hearts, confetti...) fade in and out.
- Everyone blinks now, not just the idle face.
- While speaking, the mouth follows the real loudness of the voice (Chrome and Firefox); browsers that cannot measure it keep the timed flapping. The audio is never rerouted, so this cannot silence Chikki.

## Text chat replies
- Replies are short and direct: the answer in the first sentence, usually 1 to 2 sentences, **bold** on key terms, and up to 4 bullets when naming three or more things. Voice replies stay plain.
- The chat renders that formatting safely (no HTML), shows Chikki's answer as a soft card, copies answers without the formatting marks, and offers a "Show more detail" button.
- The layout now follows the question: skills as grouped bullets, companies and projects as one bullet each, yes/no as a one-line verdict, "why hire him" as a pitch plus three reasons, explanations as short one-line paragraphs. An unsupported bullet is dropped quietly instead of breaking the list.
- The resume guard ignores bold marks and bullet dashes when checking a sentence.

## Chikki's expressions
- The model now names the mood of every reply with a hidden `[[mood:x]]` tag (22 moods) at the start, sent to the page as soon as it is known; keyword rules remain as the fallback, and the resume guard's "not in the resume" notice shows the apologetic face.
- All 35 faces are now reachable: celebrate after a contact message, grateful after a thumbs-up, interrupted when talked over, confused when speech is unclear, ready after the greeting, sleepy after a minute of silence, plus richer faces from the visitor's words.
- Look-alike faces now have their own feature (medal, sweat drop, confetti, question mark, zzz, raised brow, angry brows, nodding head, raised arm, blinking).

## Voice reliability and accuracy
- Server-side listening: each spoken question is transcribed by Groq Whisper (`POST /stt`), with a vocabulary hint for names like LangGraph and UBS and a filter for phantom phrases. The browser recogniser still gives live captions and is the fallback.
- Speaking: text-to-speech now has a timeout, one retry and an automatic pause with browser-voice fallback; audio for the next sentence is prepared while the current one plays.
- Faster start: in voice mode the first clause of a reply is spoken as soon as it is ready; greetings are prepared at startup and finished audio is cached, so repeated lines play instantly and survive a speech-service outage.
- Talk over Chikki to interrupt it (own-voice echo is filtered out), a Tap to talk / Done / Interrupt button, a "Waking up Chikki" notice on cold starts, an on-screen note when no voice is available, and voice metrics (time to first sound, fallbacks) in Analytics and the weekly digest.
- Health check reports a voice failure with its likely cause (for example, upgrade `edge-tts`), and `/health` shows voice status.

## 2.0.0 (in progress)

### New: retrieval-augmented answers (RAG)
- New knowledge base in `backend/knowledge/` plus optional `KNOWLEDGE_URLS`, chunked by Markdown section.
- Hybrid retrieval: BM25 keyword scoring always runs; NVIDIA embeddings are fused in with reciprocal rank fusion when configured. If embeddings fail, retrieval falls back to keywords and retries them later.
- The top excerpts are added to the prompt for each non-joke turn. Follow-up questions also use the previous question.
- Text chat shows the sources used under each reply (`meta.sources` on the WebSocket reply).
- Chikki project details moved from the hardcoded system prompt into `knowledge/chikki.md`.
- Added admin endpoint `POST /knowledge/refresh`.

### UI polish: readable font, welcome panel, copy answer
- Answers and buttons use Inter (easier to read than all-monospace); small labels keep the monospace font. Replies are slightly larger.
- The empty chat shows a welcome message and the four starter questions instead of a blank panel.
- "Was that helpful?" in voice mode only appears once Chikki has answered.
- A "Copy answer" button under every reply, bouncing typing dots while Chikki thinks, and a softer slate-indigo robot in the light theme.

### Light theme redesign and cleaner topic keywords
- Light theme: solid indigo main buttons, a brand-colored bubble for the visitor's messages, white cards with soft shadows, darker small text, a light dialog backdrop and a soft page glow. Dark is unchanged.
- The "topics you asked about" list (contact window and resume tailoring) no longer fills up with filler words or stray punctuation, and keeps short terms such as C#, AI and QA.

### New: resume-grounding guard
- Every sentence is checked before it is shown or spoken: numbers, company names and technologies must appear in the Google Drive resume (and by default Chikki's own write-ups; `GROUNDING_SOURCES=resume` is strictest). Unverified sentences are replaced by "I don't have that detail in Akash's resume."
- Abbreviations are accepted only when their long form is in the documents (for example P2P and Peer-to-Peer); the computed tenure is allowed because the prompt provides it.
- Blocked claims show in the Telegram feed, the Usage tab and the weekly digest. Modes: block, flag, off.
- Tested on real answers against the real resume: 27 of 29 sentences passed, the 2 blocked were Kubernetes (correct) and a "P2P" abbreviation (now handled). Four new eval cases cover invented skills, years and metrics.
- Text now appears a sentence at a time. Decimals such as 1.5 are no longer split while streaming (this also fixes spoken sentences being cut at "1.").

### Fix: provider failures were silent
- The daily health check now sends a tiny test to every AI provider and alerts you when a model is retired, a key is rejected, or no provider is answering.
- The NVIDIA default model was retired; it is now `poolside/laguna-xs-2.1`.

### UI refresh
- The 📊 Analytics button is hidden from visitors; reveal it with `?admin=1` or Ctrl+Shift+A.
- Fewer buttons: Resume, Contact Akash and Role fit stay visible; everything else moved into a **More** menu.
- A profile card on the start screen and a one-line profile in the headers tell recruiters who Chikki represents (configurable with `VITE_PROFILE_*` and `VITE_OPEN_TO_WORK`).
- A light theme (More menu, `?theme=light`) that is remembered; dark remains the default.
- A listening wave in voice mode, an accent edge on Chikki's answers, and a tab icon.
- Mobile: 16px inputs (no iOS zoom), 44px touch targets, safe-area padding, wrapping headers.

### Fix: one Contact Akash button
- A **📞 Call** button is shown on phones and tablets only (a `tel:` link does nothing on desktop).
- "Contact Akash" used a `mailto:` link that does nothing on computers without an email app, and "Call" a `tel:` link that does nothing on desktop, next to a separate "Leave a message" form. They are now one **Contact Akash** button that opens the form, plus the booking link when configured. Your email address and phone number are not shown on the page.

### New: live conversation feed and notification routing
- Telegram receives each visitor question in full with a one-line answer, a short anonymous visitor code, the time, reply time, and a warning for knowledge gaps. A visitor's first message makes a sound; later ones are silent. Off by default (`NOTIFY_CONVERSATIONS=true` to enable), sent in the background and capped at 60 an hour.
- Each notification type now goes to one place: contact-form messages to email (Telegram only if email fails), conversations, the weekly digest and health alerts to Telegram. Override with `NOTIFY_*` settings.
- The "How Chikki works" page now says plainly that questions are shared with Akash.

### New: email notifications (Resend) and delivery test
- Visitor messages, the weekly digest and health alerts can now also go to your inbox through Resend, next to Telegram and webhooks. Email replies go straight to the visitor.
- SMTP (for example Gmail with an App Password) works as an email fallback after Resend.
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
