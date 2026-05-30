/**
 * Next.js API Route — calls Gemini directly for genre/mood/strategy analysis.
 * No Python backend needed. Pure Vercel.
 */

import { NextRequest, NextResponse } from "next/server";

const KEY = (process.env as Record<string,string|undefined>)["GEMINI_API_KEY"]||"";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GenreLabel {
  name: string;
  confidence: number;
  parent: string;
}

const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
];

const SYSTEM_PROMPT = `You are a professional music analyst and A&R strategist for independent musicians.
Analyze the audio clip and the provided technical measurements. Return a JSON object with these fields:

{
  "genres": [
    {"name": "Primary genre (1-3 words)", "confidence": 0.0-1.0, "parent": "Broader category"}
  ] (1-3 genres with confidence scores),
  "mood": ["tag1", "tag2", "tag3", "tag4"] (4-6 descriptive mood/emotion tags),
  "style_description": "2-3 sentences describing the overall sound, production style, and vibe.",
  "era": ["tag"] (0-3 era tags: e.g. "80s", "Retro", "Modern", "Timeless"),
  "region": ["tag"] (0-3 geographic/cultural style tags),
  "scene": ["tag"] (0-3 cultural scene tags: e.g. "Bedroom Pop", "Festival Anthem"),
  "use_cases": ["tag"] (2-4 use cases: "Workout", "Study", "Driving", "Party", etc.),
  "tips": [
    {"title": "Short actionable tip title", "body": "2-3 sentence explanation"}
  ] (exactly 3 tips)
}

CRITICAL RULES:
- Respond ONLY with valid JSON. No markdown, no explanation, no code fences.
- ALL property names and string values MUST use double quotes (") — NEVER single quotes.
- No trailing commas.
- Genres must be real, recognizable music genres. Prefer specific over generic.
- Each genre must have a "parent" that is the broader category.
- Mood tags should be emotional descriptors, not technical terms.
- Tips must reference the specific BPM, key, and energy level.
- Be honest about uncertainty — don't inflate confidence.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const featuresJson = formData.get("features") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    let features = {
      bpm: 120, key: "C", energy: 0.5, valence: 0.5,
      danceability: 0.5, acousticness: 0.5, instrumentalness: 0.5,
      brightness: 0.5, duration: 0,
    };

    if (featuresJson) {
      try {
        const parsed = JSON.parse(featuresJson);
        features = { ...features, ...parsed };
      } catch { /* use defaults */ }
    }

    const userPrompt = `Analyze this audio recording.

Technical measurements:
- BPM: ${features.bpm}
- Key: ${features.key}
- Energy: ${features.energy}/1.0
- Valence: ${features.valence}/1.0
- Danceability: ${features.danceability}/1.0
- Acousticness: ${features.acousticness}/1.0
- Instrumentalness: ${features.instrumentalness}/1.0
- Spectral Brightness: ${features.brightness}/1.0
- Duration: ${features.duration}s

Based on the audio and these measurements, identify the genre, mood, and give 3 strategy tips.`;

    const audioBytes = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name, file.type);
    const audioB64 = audioBytes.toString("base64");

    const errors: string[] = [];
    const rawTexts: string[] = [];
    for (const model of MODEL_CHAIN) {
      try {
        const result = await callGemini(model, SYSTEM_PROMPT, userPrompt, audioB64, mimeType);
        if (result) {
          const genres = (result.genres as GenreLabel[]) || [
            { name: "Indie / Alternative", confidence: 0.5, parent: "Alternative" },
          ];
          return NextResponse.json({
            id: crypto.randomUUID().slice(0, 12),
            filename: file.name,
            duration: features.duration,
            sample_rate: 44100,
            bpm: features.bpm,
            key: features.key,
            key_confidence: 0.75,
            genres,
            genre_confidence: genres[0]?.confidence ?? 0.5,
            mood: result.mood || ["Balanced"],
            energy: features.energy,
            valence: features.valence,
            danceability: features.danceability,
            acousticness: features.acousticness,
            instrumentalness: features.instrumentalness,
            style_description: result.style_description || "",
            era: result.era || [],
            region: result.region || [],
            scene: result.scene || [],
            use_cases: result.use_cases || [],
            tips: result.tips || fallbackTips(features.bpm, features.key),
            _gemini_errors: [],
            _model: model,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("RESOURCE_EXHAUSTED")) {
          errors.push(`${model}: ${msg.slice(0, 60)}`);
          continue;
        }
        errors.push(`${model}: ${msg.slice(0, 100)}`);
        break;
      }
    }

    return NextResponse.json({
      id: crypto.randomUUID().slice(0, 12),
      filename: file.name,
      duration: features.duration,
      sample_rate: 44100,
      bpm: features.bpm,
      key: features.key,
      key_confidence: 0.7,
      genres: [{ name: "Indie / Alternative", confidence: 0.5, parent: "Alternative" }],
      genre_confidence: 0.5,
      mood: getFallbackMood(features.energy, features.valence),
      energy: features.energy,
      valence: features.valence,
      danceability: features.danceability,
      acousticness: features.acousticness,
      instrumentalness: features.instrumentalness,
      style_description: "A unique sound with its own character.",
      era: [], region: [], scene: [], use_cases: [],
      tips: fallbackTips(features.bpm, features.key),
      _gemini_errors: errors,
    });
  } catch (e: unknown) {
    console.error("Analyze error:", e);
    return NextResponse.json({ error: "Analysis failed", detail: String(e) }, { status: 500 });
  }
}

async function callGemini(model: string, sysPrompt: string, userPrompt: string, audioB64: string, mimeType: string) {
  const url = `${API_BASE}/models/${model}:generateContent?key=${KEY}`;
  const body = {
    system_instruction: { parts: [{ text: sysPrompt }] },
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: audioB64 } },
        { text: userPrompt },
      ],
    }],
    generation_config: { temperature: 0.4, max_output_tokens: 800, response_mime_type: "application/json" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 100)}`);

  const data = await res.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = text.trim();
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n");
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();
  }
  return robustParse(text);
}

function robustParse(text: string): Record<string, unknown> {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Fix common Gemini JSON issues (careful: don't break apostrophes in text)
  let cleaned = text
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // unquoted keys → quoted
    .replace(/,\s*}/g, '}')                 // trailing comma before }
    .replace(/,\s*]/g, ']');                // trailing comma before ]

  try { return JSON.parse(cleaned); } catch {}

  // Last resort: single-quote keys (only at line start or after comma)
  cleaned = text
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3');

  return JSON.parse(cleaned);
}

function getMimeType(filename: string, fileType?: string): string {
  // Only trust file.type if it's a real audio MIME
  if (fileType && fileType.startsWith("audio/") && !fileType.includes("octet-stream")) {
    return fileType;
  }
  const map: Record<string, string> = {
    mp3: "audio/mpeg", mpeg: "audio/mpeg", wav: "audio/wav", wave: "audio/wav",
    flac: "audio/flac", m4a: "audio/mp4", mp4: "audio/mp4",
    ogg: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", aac: "audio/aac",
  };
  return map[filename.split(".").pop()?.toLowerCase() || "wav"] || "audio/wav";
}

function getFallbackMood(energy: number, valence: number): string[] {
  const mood: string[] = [];
  if (energy > 0.6) mood.push("Energetic");
  else if (energy > 0.3) mood.push("Moderate");
  else mood.push("Calm");
  if (valence > 0.6) mood.push("Happy");
  else if (valence < 0.4) mood.push("Melancholic");
  else mood.push("Balanced");
  return mood;
}

function fallbackTips(bpm: number, key: string) {
  return [
    { title: "Analyze your track's DNA", body: `At ${Math.round(bpm)} BPM in ${key}, your track has a distinctive profile. Use these characteristics to pitch to genre-matching playlists.` },
    { title: "Plan your release strategy", body: "Submit to Spotify for Artists 2 weeks before release. Editorial curators look for clear genre positioning." },
    { title: "Use short-form content", body: "Post a 15-second hook on Reels/TikTok 3-5 days before release to build pre-saves." },
  ];
}
