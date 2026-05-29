"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface Analysis {
  id: string;
  filename: string;
  duration: number;
  sample_rate: number;
  bpm: number;
  key: string;
  key_confidence: number;
  genre: string;
  genreConfidence: number;
  mood: string[];
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tips: { title: string; body: string }[];
}

function Bar({ label, value, color = "bg-sonifuse-500" }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-sm w-28 text-right">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-slate-300 text-sm w-10">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Try to load from sessionStorage first
    const stored = sessionStorage.getItem("sonifuse_result");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Map snake_case → camelCase for frontend
        setData({
          ...parsed,
          genreConfidence: parsed.genre_confidence ?? 0,
          sample_rate: parsed.sample_rate ?? 0,
          key_confidence: parsed.key_confidence ?? 0,
        });
        setLoading(false);
        return;
      } catch {
        // fall through to error
      }
    }
    setError("Analysis data not found. Please upload your track again.");
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin text-5xl">🎧</div>
          <p className="text-slate-400">Analyzing your track...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-slate-400">{error || "Report not found."}</p>
        <a href="/" className="text-sonifuse-400 hover:text-sonifuse-300 text-sm">
          ← Upload another track
        </a>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-slate-500 text-xs">{data.filename}</p>
        <p className="text-sonifuse-400 text-sm font-medium tracking-wide uppercase">Your Music DNA</p>
        <h1 className="text-3xl md:text-4xl font-bold">
          {data.genre}{" "}
          <span className="text-slate-500 text-lg font-normal">
            ({Math.round(data.genreConfidence * 100)}% match)
          </span>
        </h1>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["BPM", data.bpm],
          ["Key", `${data.key} (${Math.round(data.key_confidence * 100)}%)`],
          ["Energy", `${Math.round(data.energy * 100)}%`],
          ["Dance", `${Math.round(data.danceability * 100)}%`],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-slate-900 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Mood Tags */}
      <div className="flex flex-wrap justify-center gap-2">
        {data.mood.map((m) => (
          <span key={m} className="bg-sonifuse-400/15 text-sonifuse-300 px-3 py-1 rounded-full text-sm">
            {m}
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="space-y-3 bg-slate-900 rounded-2xl p-6">
        <h2 className="text-slate-300 font-semibold mb-4">Audio Profile</h2>
        <Bar label="Energy" value={data.energy} color="bg-sonifuse-500" />
        <Bar label="Danceability" value={data.danceability} color="bg-green-500" />
        <Bar label="Acousticness" value={data.acousticness} color="bg-amber-500" />
        <Bar label="Instrumental" value={data.instrumentalness} color="bg-purple-500" />
        <Bar label="Valence" value={data.valence} color="bg-pink-500" />
      </div>

      {/* Strategy Tips */}
      {data.tips && data.tips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Strategy Recommendations</h2>
          {data.tips.map((tip, i) => (
            <div key={i} className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
              <h3 className="font-semibold text-sonifuse-300 mb-2">{tip.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="text-center pt-8">
        <p className="text-slate-500 text-sm mb-4">Want the full report with competitor analysis?</p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="email"
            placeholder="your@email.com"
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sonifuse-500"
          />
          <button className="bg-sonifuse-600 hover:bg-sonifuse-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
            Unlock Full Report
          </button>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center">
        <a href="/" className="text-slate-500 hover:text-slate-400 text-sm">
          ← Analyze another track
        </a>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin text-5xl">🎧</div>
          <p className="text-slate-400">Loading report...</p>
        </div>
      </main>
    }>
      <ReportContent />
    </Suspense>
  );
}
