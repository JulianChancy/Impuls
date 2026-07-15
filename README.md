# Impuls

Training analysis app for athletes. An Expo (React Native) mobile front end backed by a FastAPI analysis service and Supabase for auth and data storage.

## Structure

- `backend/` — FastAPI service. `logic.py` is the analytics source of truth (movement classification, insight generation, likely response status); `main.py` exposes it via `POST /analyze` plus `/health`.
- `mobile/` — Expo app. `App.js` holds the screen flow; `src/` contains storage, auth, database, and Supabase client helpers. See `mobile/README.md` for details.
- `supabase/` — SQL schema (`schema.sql`) and reset script.
- `testsuite.py`, `visual_test.py` — backend logic tests and visual output checks.
- `Procfile`, `render.yaml` — deployment config for Render.

Programme data is nested as: `calendar → macro_blocks → blocks → weeks → sessions → exercises`.

## Running locally

### Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Health check at `http://localhost:8000/health`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Environment

Copy `.env.example` and fill in:

- `EXPO_PUBLIC_ANALYSIS_API_BASE_URL` — analysis backend URL
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase project credentials

## Deployment

The backend deploys to Render via `render.yaml` (free plan, auto-deploy on push).
