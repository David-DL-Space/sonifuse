"""
Sonifuse Backend — FastAPI audio analysis server.

POST /api/analyze  — upload audio, get Music DNA report
GET  /health       — health check
"""

import uuid
import logging

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analyzer import analyzer
from app.models import AnalysisResult, ErrorResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sonifuse Audio Analyzer",
    description="Music DNA analysis API — extract BPM, key, genre, mood, and strategy tips",
    version="0.1.0",
)

# Allow requests from Next.js frontend (Vercel) and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sonifuse.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "sonifuse-backend"}


@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze_audio(file: UploadFile = File(...)):
    """Upload an audio file and receive a full Music DNA analysis."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content_type = file.content_type or ""
    valid_types = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "audio/mp3", "audio/mp4", "audio/ogg"}
    if content_type and content_type not in valid_types:
        logger.warning(f"Unexpected content type: {content_type}")

    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=400, detail="Could not read file")

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    max_size = 50 * 1024 * 1024  # 50 MB
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    logger.info(f"Analyzing: {file.filename} ({len(contents)} bytes)")

    try:
        result = analyzer.analyze(contents, file.filename or "unknown")
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")

    result["id"] = uuid.uuid4().hex[:12]

    logger.info(f"Analysis complete: id={result['id']} bpm={result['bpm']} genre={result['genre']}")
    return result


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return ErrorResponse(error="Request failed", detail=exc.detail).model_dump()
