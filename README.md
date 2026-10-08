# Chikki — Voice-First AI Career Assistance

A voice-first AI career assistant. Recruiters can ask about Akash by voice or
text; Chikki answers using the configured AI providers and the current Google
Drive resume source.

## 1. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and paste your NVIDIA API key:

```
NVIDIA_API_KEY=your_real_key_here
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_EMBED_MODEL=nvidia/nemotron-3-embed-1b
```

Run it:

```bash
uvicorn main:app --reload --port 8000 --no-access-log
```

Visit http://localhost:8000/health — you should see `{"status": "ok"}`.

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
`GOOGLE_DRIVE_FILE_ID`). Chikki refreshes and reads that source; the resume
download is generated from its current content. Personal projects are limited
to implemented projects.

## 4. Deploying

- **Backend → Render**: connect the repository; Render reads `render.yaml`.
  Configure at least one provider API key/model and `GOOGLE_DRIVE_RESUME_URL`
  in Render's environment settings. Set `ALLOWED_ORIGINS` to the exact Vercel
  production origin (for example, `https://your-project.vercel.app`), plus
  any preview origins you intend to use. Never commit `.env` or provider
  secrets.
- **Frontend → Vercel**: import `frontend/` as the Vercel project root. The
  included `frontend/vercel.json` configures Vite output and SPA routing. Set
  `VITE_API_URL` to the HTTPS Render backend origin, for example
  `https://your-chikki-backend.onrender.com` (no trailing slash).
- Add the public `VITE_LINKEDIN_URL` and `VITE_GITHUB_URL` values in Vercel if
  you want those profile links shown. `VITE_RESUME_URL` is optional; by default
  it resolves to `${VITE_API_URL}/resume`.
- Redeploy the frontend after changing any `VITE_*` setting. These values are
  embedded at build time. Keep the FastAPI/WebSocket backend on Render; Vercel
  hosts the frontend and is not used for the persistent voice WebSocket.

## Notes

- Speech recognition (wake word + STT) uses the browser's Web Speech API,
  which currently works best in Chrome/Edge on desktop.
- TTS is free via Edge-TTS — no API key required for voice output.
- LLM is NVIDIA (`nvidia/nemotron-3.5-lightning-30b-a3b` by default) —
  powered through the NVIDIA AI endpoints integration.
