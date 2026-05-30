import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from .logic import analyze_app_data
except ImportError:
    from logic import analyze_app_data

app = FastAPI(title="Impuls Analysis Backend")

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"ok": True, "service": "Impuls Analysis Backend"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
def analyze(payload: dict):
    try:
        return analyze_app_data(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
