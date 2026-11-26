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
| Digest | `curl -H "X-Admin-Token: local-test-token" localhost:8000/digest/preview` | digest text |
| Knowledge index | `curl -X POST -H "X-Admin-Token: local-test-token" localhost:8000/knowledge/refresh` | `"chunks"` greater than 0 |

## 5. Click-through checklist in the browser

1. **Text chat:** click "Use text chat instead", ask *"What is Chikki?"*. You get a short answer with **Sources** chips under it.
2. **Tell me more:** click the "Tell me more about that." suggestion. The answer is clearly longer.
3. **Actions:** ask *"How can I contact Akash?"*. A **Leave a message** button appears under the reply. Click it, fill the form, send. Check:
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
10. **Limits (optional):** send 6 role-fit checks in an hour, or 5 messages in an hour, and the last one should be refused politely.

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
