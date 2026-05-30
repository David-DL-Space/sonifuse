/**
 * Next.js API Route — calls Gemini directly for full music analysis.
 * Zero browser-side computation. Gemini handles BPM, key, genre, mood, strategy.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10; // Vercel hobby plan max

const KEY = (process.env as Record<string,string|undefined>)["GEMINI_API_KEY"]||"";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GenreLabel {
  name: string;
  confidence: number;
  parent: string;
}

const MODEL_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
];

const SYSTEM_PROMPT = `You are a professional music analyst and A&R strategist. Listen to the audio and return ONLY a JSON object:

{
  "bpm": 0 (estimated tempo as integer),
  "key": "C" (estimated key: C, C#, D, D#, E, F, F#, G, G#, A, A#, B with optional 'm' for minor),
  "genres": [
    {"name": "specific genre", "confidence": 0.0-1.0, "parent": "broader category"}
  ] (1-3 genres, parent = umbrella genre),
  "mood": ["tag1", "tag2"] (4-6 mood/emotion words),
  "style_description": "2-3 sentences on sound, production, vibe.",
  "era": ["tag"] (0-3: "80s", "Retro", "Modern", "Timeless", etc.),
  "region": ["tag"] (0-3 geographic/cultural tags),
  "scene": ["tag"] (0-3: "Bedroom Pop", "Festival", "Club", etc.),
  "use_cases": ["tag"] (2-4: "Workout", "Study", "Driving", "Party", etc.),
  "tips": [
    {"title": "actionable tip", "body": "2-3 sentence explanation referencing BPM/key"}
  ] (exactly 3 tips)
}

CRITICAL:
- ONLY valid JSON. No markdown, no backticks, no explanation.
- Double quotes ONLY. No trailing commas.
- Genres = real, specific music genres. Don't inflate confidence.
- Estimate BPM and key by ear from the audio.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const audioBytes = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name, file.type);
    const audioB64 = audioBytes.toString("base64");

    // Diagnostic: hash first 4KB to detect duplicate uploads
    const byteSize = audioBytes.length;
    const headHash = audioBytes.slice(0, 4096).toString("base64").slice(0, 12);

    const userPrompt = `Analyze this audio recording. Estimate BPM and key from the audio, then identify genres, mood, and give 3 strategy tips. Respond with JSON only.`;

    const errors: string[] = [];
    const debug: string[] = [];
    for (const model of MODEL_CHAIN) {
      debug.push(`try:${model}`);
      try {
        const result = await callGemini(model, SYSTEM_PROMPT, userPrompt, audioB64, mimeType);
        if (result) {
          const genres = (result.genres as GenreLabel[]) || [];
          return NextResponse.json({
            id: crypto.randomUUID().slice(0, 12),
            filename: file.name,
            bpm: result.bpm || 0,
            key: result.key || "C",
            key_confidence: 0.8,
            genres: genres.length > 0 ? genres : [{ name: "Indie / Alternative", confidence: 0.5, parent: "Alternative" }],
            genre_confidence: genres[0]?.confidence ?? 0.5,
            mood: result.mood || ["Balanced"],
            energy: 0.5,
            valence: 0.5,
            danceability: 0.5,
            acousticness: 0.5,
            instrumentalness: 0.5,
            style_description: result.style_description || "",
            era: result.era || [],
            region: result.region || [],
            scene: result.scene || [],
            use_cases: result.use_cases || [],
            tips: result.tips || FALLBACK_TIPS,
            duration: 0,
            sample_rate: 44100,
            _gemini_errors: [],
            _model: model,
            _debug: debug,
            _bytes: byteSize,
            _hash: headHash,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE")
            || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("JSON")
            || msg.includes("Unterminated") || msg.includes("Expected")) {
          errors.push(`${model}: ${msg.slice(0, 60)}`);
          debug.push(`err:${model}:${msg.slice(0, 200)}`);
          continue;
        }
        errors.push(`${model}: ${msg.slice(0, 100)}`);
        debug.push(`fatal:${model}:${msg.slice(0, 40)}`);
        break;
      }
    }

    return NextResponse.json({
      id: crypto.randomUUID().slice(0, 12),
      filename: file.name,
      bpm: 0, key: "C", key_confidence: 0.3,
      genres: [{ name: "Indie / Alternative", confidence: 0.5, parent: "Alternative" }],
      genre_confidence: 0.5,
      mood: ["Balanced"],
      energy: 0.5, valence: 0.5, danceability: 0.5, acousticness: 0.5, instrumentalness: 0.5,
      style_description: "A unique sound with its own character.",
      era: [], region: [], scene: [], use_cases: [],
      tips: FALLBACK_TIPS,
      duration: 0, sample_rate: 44100,
      _gemini_errors: errors,
      _debug: debug,
      _bytes: byteSize,
      _hash: headHash,
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
  try { return JSON.parse(text); } catch {}

  let s = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/"([^"\n]*?)$/gm, '"$1"');
  s = s.replace(/([{,]\s*)([a-zA-Z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  s = s.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3');
  s = s.replace(/(:\s*)'([^']*)'/g, '$1"$2"');
  s = s.replace(/,(\s*[}\]])/g, "$1");
  s = s.replace(/(":\s*)([a-zA-Z][\w\s]*[a-zA-Z])(\s*[,}\]])/g, '$1"$2"$3');

  try { return JSON.parse(s); } catch {}

  s = s.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
  try {
    const fn = new Function(`return (${s})`);
    return fn() as Record<string, unknown>;
  } catch {}

  throw new Error("JSON parse failed: " + text.slice(0, 200));
}

function getMimeType(filename: string, fileType?: string): string {
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

const FALLBACK_TIPS = [
  { title: "Analyze your DNA", body: "Your track has a distinctive sonic profile. Use it to pitch to genre-matching playlists on Spotify for Artists." },
  { title: "Plan your release", body: "Submit to Spotify for Artists 2 weeks before release. Editorial curators look for clear genre positioning." },
  { title: "Use short-form content", body: "Post a 15-second hook on Reels/TikTok 3-5 days before release to build pre-saves and anticipation." },
];
