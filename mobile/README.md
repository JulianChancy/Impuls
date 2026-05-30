# Impuls Local Mobile Prototype

This Expo app uses local AsyncStorage for the app data objects, and a local FastAPI backend for analysis.

`logic.py` is the analytics source of truth. The mobile app sends the stored JSON object to `POST /analyze` and renders the returned analysis/insight JSON.

Key files:

- `App.js`: product-style front end and screen flow
- `src/storage.js`: local JSON storage shape, load/save/reset helpers, default objects
- `../logic.py`: analytics, insight generation, relationship interpretation, likely response status, and all data-dependent copy
- `../backend/main.py`: FastAPI `/analyze` endpoint that imports `logic.py`

Programme storage is nested like the final product model:

`calendar -> macro_blocks -> blocks -> weeks -> sessions -> exercises`

The frontend does not import `analytics.js`; that file has been removed to avoid a second analytics source of truth.

## Run Backend

From the project root:

```bash
cd /Users/julianchan/Desktop/APP/New/Impuls
python3 -m pip install -r requirements.txt
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

## Render Backend

The backend is Render-ready from the project root:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

If you use Render Blueprint, `../render.yaml` contains the same settings.

After Render gives you a service URL, create `mobile/.env`:

```bash
EXPO_PUBLIC_ANALYSIS_API_BASE_URL=https://your-render-service.onrender.com
```

You can also use the full endpoint instead:

```bash
EXPO_PUBLIC_ANALYSIS_API_URL=https://your-render-service.onrender.com/analyze
```

Restart Expo with `npx expo start -c` after changing env vars.

## Run Mobile App

In a second terminal:

```bash
cd /Users/julianchan/Desktop/APP/New/Impuls/mobile
npm install
npx expo start -c
```

Then press `i` for the iOS simulator.

If using the iOS simulator, keep the backend on `127.0.0.1`.

If using a physical phone instead of the iOS simulator, start the backend on your Mac's network interface:

```bash
cd /Users/julianchan/Desktop/APP/New/Impuls
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Then set `EXPO_PUBLIC_ANALYSIS_API_URL` to your Mac's LAN URL when starting Expo, for example:

```bash
EXPO_PUBLIC_ANALYSIS_API_URL=http://192.168.1.20:8000/analyze npx expo start -c
```
