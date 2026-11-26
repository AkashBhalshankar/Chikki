# Run Chikki 2.0 locally and verify it

You need Python 3.12 with [uv](https://docs.astral.sh/uv/), and Node 20+. Use two terminals.

## 1. One-time setup

```bash
# Terminal A: backend
cd backend
uv sync --group dev
```

Open `backend/.env` and make sure these lines exist (add any that are missing):

```env
ADMIN_TOKEN=local-test-token        # any value; protects the dashboard and admin endpoints
GITHUB_USERNAME=AkashBhalshankar    # optional: lets Chikki mention your latest repos
# optional: instant alerts for messages, digest and health checks
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_CHAT_ID=...
```

Your provider keys and `GOOGLE_DRIVE_RESUME_URL` should already be there.
`frontend/.env` needs `VITE_API_URL=http://localhost:8000`. Optional: `VITE_BOOKING_URL=https://cal.com/you`.

```bash
# Terminal B: frontend
cd frontend
npm install
```

## 2. Start both servers

```bash
# Terminal A
cd backend
uv run uvicorn main:app --reload --port 8000 --no-access-log

# Terminal B
cd frontend
npm run dev
```

Open http://localhost:5173 in **Chrome or Edge** (voice needs the Web Speech API).

## 3. Automated checks (2 minutes)

```bash
cd backend && uv run pytest -q          # expect: 92 passed
cd frontend && npm run build            # expect: built, no errors
```

## 4. Backend checks (terminal, replace the token if you changed it)

| Check | Command | Expect |
|---|---|---|
| Health and version | `curl localhost:8000/health` | `{"status":"ok","version":"2.0.0"}` |
| Admin is locked | `curl -i localhost:8000/feedback/analytics` | `401` |
| Admin works | `curl -H "X-Admin-Token: local-test-token" localhost:8000/analytics/summary` | JSON with totals |
| Drive resume + keys healthy | `curl -X POST -H "X-Admin-Token: local-test-token" localhost:8000/ops/check` | `{"ok":true,...}` |
| Notifications delivered | `curl -X POST -H "X-Admin-Token: local-test-token" localhost:8000/notify/test` | `"ok":true` and a test message in Telegram and your inbox |
| Digest | `curl -H "X-Admin-Token: local-test-token" localhost:8000/digest/preview` | digest text |
| Knowledge index | `curl -X POST -H "X-Admin-Token: local-test-token" localhost:8000/knowledge/refresh` | `"chunks"` greater than 0 |

## 4b. Answer-quality evals (uses real model calls, about 1 minute)

```bash
cd backend
uv run python evals.py              # all cases; expect 13/13 passed
uv run python evals.py --id rag     # a single case
```

A failure prints what was wrong and the reply. Add your own cases to `backend/evals/cases.json`.
If Groq reports a rate limit the run falls back to the next provider; just re-run a failed case.

## 5. Click-through checklist in the browser

1. **Text chat:** click "Use text chat instead", ask *"What is Chikki?"*. You get a short answer with **Sources** chips under it.
2. **Tell me more:** click the "Tell me more about that." suggestion. The answer is clearly longer.
3. **Actions:** ask *"How can I contact Akash?"*. A **Contact Akash** button appears under the reply. Click it, fill the form, send. Check:
   - the message appears in the dashboard **Messages** tab, and
   - (if Telegram is set) you get an alert.
4. **Resume:** ask *"Can I get his resume?"*, click **Download resume**. The PDF should reflect the Drive resume.
5. **Role fit:** click **Check role fit**, paste any job description (40+ characters). You get a score, matches and **honest gaps**. Click **Resume tailored to this role**.
6. **GitHub:** ask *"What has he built recently on GitHub?"* (needs `GITHUB_USERNAME`).
7. **Shared links:** open each of these in a new tab:
   - http://localhost:5173/?q=What%20are%20Akash%27s%20strongest%20skills%3F
   - http://localhost:5173/?company=Acme
   You see a "Someone shared this with you" card; click it and the answer starts automatically. In chat, **Copy link** copies a link for your last question.
8. **Voice:** go back to the start screen, click "Click to start", allow the microphone, say *"Hey Chikki"*, then ask something. You should hear the voice and see captions.
9. **Dashboard:** click **Analytics**, enter `local-test-token`. The **Usage** tab shows the questions you just asked, language, voice vs text, reply times and any knowledge gaps. **Feedback** and **Messages** tabs also load.
10. **Telegram conversation feed (optional):** set `NOTIFY_CONVERSATIONS=true` in `backend/.env`, restart the
    backend, and ask two questions in the app. The first arrives as "🆕 New visitor #XXXX" with a sound, the
    second as "💬 #XXXX · turn 2" silently, each with the full question and a one-line answer. Set it back to
    `false` afterwards so your own testing does not ping you.
11. **Voice quality:** in voice mode, say *"Does he know fast API and lang graph?"*:
    - while you speak, a line **"I'm hearing..."** shows your words, and technical terms appear correctly spelled (FastAPI, LangGraph);
    - mumble or whisper something unclear: Chikki should ask you to repeat instead of answering;
    - switch the language selector to **Telugu** or **Hindi** and ask in that language: the reply is in that script and the voice matches;
    - ask in English with the selector on Telugu: the English reply is spoken with the English voice, not garbled.
12. **UI:**
    - the 📊 Analytics button is **not** visible to visitors; open `http://localhost:5173/?admin=1` (or press
      Ctrl+Shift+A) to reveal it, then use your admin token;
    - **More** menu: check How Chikki works, Copy link, LinkedIn, GitHub, theme and Clear chat open from it;
    - switch to **☀️ Light theme** (or the ☀️ button on the start screen) and back; reload to confirm it is remembered;
    - resize the window to phone width: buttons wrap cleanly, inputs do not zoom, and on a real phone **📞 Call Akash**
      appears in More;
    - in voice mode a small wave under the robot idles while listening and animates while it hears you.
13. **How it works:** click **🧠 How Chikki works** and check the page opens and closes (Esc works too).
14. **Limits (optional):** send 6 role-fit checks in an hour, or 5 messages in an hour, and the last one should be refused politely.

## 6. If something looks wrong

- **Dashboard says "admin not configured":** `ADMIN_TOKEN` is missing in `backend/.env`. Restart the backend after editing.
- **No voice or captions only:** Edge-TTS may be blocked; Chikki falls back to your browser's voice.
- **Answers ignore a new knowledge file:** call `/knowledge/refresh` (or just wait; files are re-read on each question).
- **Role fit or digest errors:** check the backend terminal; every failure is logged with its cause.
- **Reset local data:** stop the backend and delete `backend/data/feedback.db`.

## 7. Before you deploy

- Render: set `ADMIN_TOKEN`, optionally `GITHUB_USERNAME`, Telegram or webhook vars, and a persistent disk with `FEEDBACK_DB_PATH`.
- Vercel: set `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, optional `VITE_BOOKING_URL`.
- GitHub: add repository secrets `BACKEND_URL` and `ADMIN_TOKEN` to enable the scheduled digest and daily health check
  (Actions tab, "Scheduled owner tasks", **Run workflow** to test it once).
