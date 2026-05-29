"""
Gemini AI integration for Sonifuse — genre/mood/strategy powered by Google Gemini.

Hybrid approach:
  librosa → hard numbers (BPM, Key, energy, valence, etc.)
  Gemini  → genre, subgenre, mood description, strategy tips

Requires: GOOGLE_API_KEY env var or GEMINI_API_KEY env var.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Gemini prompt template ────────────────────────────────────────

SYSTEM_PROMPT = """You are a professional music analyst and A&R strategist for independent musicians.
Analyze the audio clip and the provided technical measurements. Return a JSON object with these fields:

{
  "genres": [
    {"name": "Primary genre (1-3 words)", "confidence": 0.0-1.0, "parent": "Broader category"}
  ] (1-3 genres with confidence scores — multi-label classification),
  "mood": ["tag1", "tag2", "tag3", "tag4"] (4-6 descriptive mood/emotion tags),
  "style_description": "2-3 sentences describing the overall sound, production style, and vibe. Be evocative and specific.",
  "era": ["tag"] (0-3 era/style-period tags: e.g. "80s", "Retro", "Modern", "Timeless", "90s", "Y2K", "Vintage"),
  "region": ["tag"] (0-3 geographic/cultural style tags: e.g. "Japanese", "Latin", "Nordic", "British", "American", "K-pop influenced", "Afrobeat"),
  "scene": ["tag"] (0-3 cultural scene/context tags: e.g. "Bedroom Pop", "Underground Club", "Festival Anthem", "SoundCloud Rap", "Coffee Shop", "Art Gallery"),
  "use_cases": ["tag"] (2-4 best fitting use cases: "Workout", "Study/Focus", "Driving", "Party", "Chill", "Morning", "Late Night", "Romantic", "Gaming", "Meditation"),
  "tips": [
    {"title": "Short actionable tip title", "body": "2-3 sentence explanation with specific, data-backed reasoning"}
  ] (exactly 3 tips)
}

Rules:
- Genres must be real, recognizable music genres. Prefer specific over generic (e.g. "Dream Pop" over "Pop"). Each genre must have a "parent" that is the broader category (e.g. "Deep House" → parent: "House", "Trap" → parent: "Hip Hop").
- Mood tags should be emotional descriptors, not technical terms. Use words like "Dreamy", "Aggressive", "Warm", "Cinematic", etc.
- Tips must reference the specific BPM, key, and energy level provided. Make them actionable for independent musicians.
- Be honest about uncertainty — don't inflate confidence.
- Use genre knowledge covering: Pop, Rock, Hip Hop, R&B, Electronic (House, Techno, Drum & Bass, Synthwave), Jazz, Classical, Folk, Country, Blues, Reggae, Latin, K-Pop, J-Pop, City Pop, Shoegaze, Dream Pop, Lo-fi, Ambient, Punk, Metal, Trap, Funk, Disco, Gospel, Indie, Alternative, and their subgenres.
- Respond ONLY with valid JSON, no markdown, no explanation.
"""

USER_PROMPT_TEMPLATE = """Analyze this audio recording.

Technical measurements from librosa:
- BPM: {bpm}
- Key: {key}
- Energy: {energy}/1.0
- Valence (positive/negative): {valence}/1.0
- Danceability: {danceability}/1.0
- Acousticness: {acousticness}/1.0
- Instrumentalness: {instrumentalness}/1.0
- Spectral Brightness: {brightness}/1.0
- Duration: {duration}s

Based on the audio and these measurements, identify the genre, mood, and give 3 strategy tips."""


class GeminiClient:
    """Wraps Google Gemini API for audio analysis."""

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._client = None
        self._available = None  # None = not checked yet

    @property
    def available(self) -> bool:
        if self._available is None:
            self._available = bool(self._api_key)
        return self._available

    @property
    def client(self):
        if self._client is None and self._api_key:
            from google import genai
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    # ── Model fallback chain ────────────────────────────────────────
    # Ordered by preference: best model first, then fallbacks
    MODEL_CHAIN = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3-flash-preview",
    ]

    def analyze(
        self,
        audio_bytes: bytes,
        mime_type: str,
        bpm: float,
        key: str,
        energy: float,
        valence: float,
        danceability: float,
        acousticness: float,
        instrumentalness: float,
        brightness: float,
        duration: float,
    ) -> dict:
        """
        Send audio + librosa data to Gemini, get genre/mood/tips back.
        Tries models in MODEL_CHAIN order, falling back to rule engine on total failure.

        Returns dict with: genre, subgenre, genre_confidence, mood, style_description, tips.
        """
        if not self.available:
            return self._fallback(bpm, energy, valence, key)

        prompt = USER_PROMPT_TEMPLATE.format(
            bpm=round(bpm, 1),
            key=key,
            energy=round(energy, 2),
            valence=round(valence, 2),
            danceability=round(danceability, 2),
            acousticness=round(acousticness, 2),
            instrumentalness=round(instrumentalness, 2),
            brightness=round(brightness, 2),
            duration=round(duration, 1),
        )

        audio_part = self._upload_audio(audio_bytes, mime_type)

        for model in self.MODEL_CHAIN:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=[audio_part, prompt],
                    config={
                        "system_instruction": SYSTEM_PROMPT,
                        "temperature": 0.4,
                        "max_output_tokens": 800,
                    },
                )

                text = response.text.strip()
                result = self._parse_json(text)

                logger.info(f"Gemini OK via {model} → genres={[g.get('name') for g in result.get('genres', [])]}")
                return {
                    "genres": result.get("genres", [{"name": "Indie / Alternative", "confidence": 0.5, "parent": "Alternative"}]),
                    "genre_confidence": float(result.get("genres", [{}])[0].get("confidence", 0.7)) if result.get("genres") else 0.5,
                    "mood": result.get("mood", ["Balanced"]),
                    "style_description": result.get("style_description", ""),
                    "era": result.get("era", []),
                    "region": result.get("region", []),
                    "scene": result.get("scene", []),
                    "use_cases": result.get("use_cases", []),
                    "tips": result.get("tips", self._fallback_tips(bpm, key)),
                }

            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"{model}: bad response — {e}")
                continue
            except Exception as e:
                err_msg = str(e)
                # 503 / 429 → try next model; other errors → fallback
                if any(x in err_msg for x in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED")):
                    logger.warning(f"{model}: {err_msg[:80]} → trying next")
                    continue
                logger.warning(f"{model}: unexpected error — {err_msg[:120]}")
                import traceback
                logger.warning(traceback.format_exc())
                break  # Don't retry on unknown errors

        # All models failed
        logger.warning("All Gemini models exhausted, using rule-based fallback")
        return self._fallback(bpm, energy, valence, key)

    def _parse_json(self, text: str) -> dict:
        """Robust JSON parsing — strips markdown fences, handles Gemini quirks."""
        # Strip markdown code fences
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)

    def _upload_audio(self, audio_bytes: bytes, mime_type: str):
        """Upload audio bytes to Gemini as a file part."""
        from google.genai import types

        # For small files (under 20MB), we can use inline bytes
        return types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)

    def _fallback(self, bpm, energy, valence, key):
        """Return sensible defaults when Gemini is unavailable."""
        mood = []
        if energy > 0.6:
            mood.append("Energetic")
        elif energy > 0.3:
            mood.append("Moderate")
        else:
            mood.append("Calm")
        if valence > 0.6:
            mood.append("Happy")
        elif valence < 0.4:
            mood.append("Melancholic")
        else:
            mood.append("Balanced")

        return {
            "genres": [{"name": "Indie / Alternative", "confidence": 0.5, "parent": "Alternative"}],
            "genre_confidence": 0.5,
            "mood": mood,
            "style_description": "A unique sound with its own character.",
            "era": [],
            "region": [],
            "scene": [],
            "use_cases": [],
            "tips": self._fallback_tips(bpm, key),
        }

    def _fallback_tips(self, bpm, key):
        return [
            {
                "title": "Analyze your track's DNA to find its audience",
                "body": f"At {bpm:.0f} BPM in {key}, your track has a distinctive profile. Use these characteristics to pitch to genre-matching playlists and connect with listeners who appreciate this sound.",
            },
            {
                "title": "Build your release strategy around your sound profile",
                "body": "Submit your track to Spotify for Artists at least 2 weeks before release. Curators at editorial playlists look for clear genre positioning and professional production quality.",
            },
            {
                "title": "Use short-form content to amplify your reach",
                "body": "Instagram Reels and TikTok reward original audio. Post a 15-second hook clip 3-5 days before release to build anticipation and drive pre-saves.",
            },
        ]


# Singleton
gemini = GeminiClient()
