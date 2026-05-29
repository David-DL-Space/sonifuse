from pydantic import BaseModel
from typing import Optional


class GenreLabel(BaseModel):
    """Multi-label genre with confidence and hierarchy."""
    name: str           # e.g. "Deep House"
    confidence: float   # 0–1
    parent: str = ""    # e.g. "House" → parent of "Deep House"


class StrategyTip(BaseModel):
    title: str
    body: str


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

    # Genre — multi-label with hierarchy
    genres: list[GenreLabel]       # e.g. [{name:"Deep House", confidence:0.85, parent:"House"}]
    genre_confidence: float        # overall confidence

    # Mood / emotional profile
    mood: list[str]
    energy: float          # 0–1
    valence: float         # 0–1 (positive/negative)
    danceability: float    # 0–1
    acousticness: float    # 0–1
    instrumentalness: float  # 0–1

    # Rich dimensions
    style_description: str = ""
    era: list[str] = []             # e.g. ["80s", "Retro", "Modern"]
    region: list[str] = []          # e.g. ["Japanese", "Latin", "Nordic"]
    scene: list[str] = []           # e.g. ["Bedroom Pop", "Underground Club", "Festival Anthem"]
    use_cases: list[str] = []       # e.g. ["Workout", "Study", "Driving", "Party"]

    # Strategy tips
    tips: list[StrategyTip]

    # Debug — Gemini errors if fallback was used
    _gemini_errors: list[str] = []


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
