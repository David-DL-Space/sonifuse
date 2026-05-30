import { NextResponse } from "next/server";

const ENV = process.env as Record<string,string|undefined>;
const KEY = ENV["GEMINI_API_KEY"]||"";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function GET() {
  if (!KEY) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const SYSTEM_PROMPT = `You are a professional music analyst. Analyze the audio clip. Return ONLY JSON with: genres, mood, style_description, era, region, scene, use_cases, tips.`;

  const userPrompt = `Analyze this audio.
Technical measurements: BPM: 120, Key: C, Energy: 0.5/1.0, Valence: 0.5/1.0, Danceability: 0.5/1.0, Duration: 10s`;

  // Simple test with minimal audio (1s sine wave)
  const minAudio = Buffer.alloc(44100, 0);
  const b64 = minAudio.toString("base64");

  const results: Record<string,unknown> = {};

  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
    try {
      const url = `${API_BASE}/models/${model}:generateContent?key=${KEY}`;
      const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [
          { inline_data: { mime_type: "audio/wav", data: b64 } },
          { text: userPrompt },
        ]}],
        generation_config: { temperature: 0.4, max_output_tokens: 800 },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      results[model] = {
        status: res.status,
        rawText: text,
        parseSuccess: false,
        parseError: "",
        parsed: null,
      };

      // Try to parse
      try { 
        results[model].parsed = JSON.parse(text);
        results[model].parseSuccess = true;
      } catch (e: unknown) {
        results[model].parseError = e instanceof Error ? e.message : String(e);
      }
    } catch (e: unknown) {
      results[model] = { error: String(e) };
    }
  }

  return NextResponse.json(results);
}
