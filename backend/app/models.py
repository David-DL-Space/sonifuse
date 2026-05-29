from pydantic import BaseModel
from typing import Optional


class AnalysisResult(BaseModel):
    """Complete audio analysis result returned to the frontend."""
    id: str
    filename: str
    duration: float
    sample_rate: int

    # Core features
    bpm: float
    key: str
    key_confidence: float

    # Genre
    genre: str
    genre_confidence: float

    # Mood / emotional profile
    mood: list[str]
    energy: float          # 0–1
    valence: float         # 0–1 (positive/negative)
    danceability: float    # 0–1
    acousticness: float    # 0–1
    instrumentalness: float  # 0–1

    # Strategy tips (generated based on analysis)
    tips: list["StrategyTip"]


class StrategyTip(BaseModel):
    title: str
    body: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
