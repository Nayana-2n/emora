# EMORA — Wellness Mind AI

EMORA reads emotion from your **face**, **voice**, or **both** in a live session, then responds the way a caring friend would — while tracking your wellness, mood, journal, and habits over time.

.

![Stack](https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black) ![Stack](https://img.shields.io/badge/FastAPI-009688?logo=fastapi) ![Stack](https://img.shields.io/badge/Gemini-4285F4?logo=google) ![Stack](https://img.shields.io/badge/Tailwind%20v4-38BDF8?logo=tailwindcss)

---

## What it does

- **Live session** — camera + microphone hero view: facial emotion analysis, live voice-energy meter, stress score, and a spoken conversation with EMORA (3s of silence ends your turn). TTS reads the reply aloud.
- **Dashboard** — a dominant wellness score with today's emotion/stress, water, sleep and habits at a glance.
- **Journal, Mood, Analytics** — editorial journal with autosave, emotion mood heatmap, and a pie-free analytics suite (stress-vs-mood, habits, water/sleep gauges).
- **Habits, Water, Sleep, Strategies, Support** — daily tracking plus crisis resources (with India helplines).

## Architecture

```
frontend/   React 19 + Vite + Tailwind v4 + Recharts   (TypeScript)
backend/    FastAPI + Google Gemini + Firestore/SQLite  (Python 3.11)
```

- Frontend talks to the backend over `/api/*` (Vite dev proxy → `:9000`).
- In production set `VITE_API_BASE` to the backend URL (see Deploy).
- Emotion is **never color-only** — every badge pairs color + label + icon (`EmotionBadge`).
- Live conversation is real: camera frames → facial emotion, mic chunks → voice emotion + stress, 3s silence → `POST /api/chat` → TTS reply.

## Run locally

**Backend (port 9000):**
```bash
cd backend/backend
copy .env.example .env        # fill GEMINI_API_KEY, JWT_SECRET
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 9000
```

**Frontend (port 6010):**
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:6010, sign up, then **Live Session** → Start.

> **Note:** `requirements.txt` includes heavy ML libs (torch, transformers, librosa, opencv, moviepy) for the emotion models. If a hosted build times out, run the backend locally for the demo and host only the frontend.

## Deploy

### Frontend — Vercel
1. Import this repo → Root directory: `frontend`
2. Build is auto-detected (`npm run build`, output `dist`)
3. Add env var `VITE_API_BASE = https://<backend>.onrender.com` → Deploy

### Backend — Render (one click)
1. Repo → **New Blueprint** → pick `render.yaml` (or New Web Service manually)
2. Manual: root dir `backend/backend`, build `pip install -r requirements.txt`,
   start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add env vars: `GEMINI_API_KEY`, `JWT_SECRET` (long random string), `STORAGE_BACKEND=sqlite`
4. Paste the `.onrender.com` URL into Vercel's `VITE_API_BASE`, redeploy frontend

## Demo flow (2–3 min video)
Login → Dashboard → Live Session (camera + voice + AI reply) → Journal / Analytics.

## Links
- **Source code:** https://github.com/Nayana-2n/emora
- **Frontend (live):** `<Vercel URL>`
- **Backend (API):** `<Render URL>`
`
