from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.logic import analyze_app_data

app = FastAPI(title="Impuls Analysis Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.head("/health")
def health_head():
    return Response(status_code=200)


@app.get("/ping")
def ping():
    return {"ok": True}


@app.head("/ping")
def ping_head():
    return Response(status_code=200)


@app.post("/analyze")
def analyze(payload: dict):
    try:
        return analyze_app_data(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
