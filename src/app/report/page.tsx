"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface Analysis {
  bpm: number;
  key: string;
  genre: string;
  genreConfidence: number;
  mood: string[];
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tips: { title: string; body: string }[];
}

// Placeholder — real data will come from server-side fetch in production
const placeholder: Analysis = {
  bpm: 128,
  key: "Am",
  genre: "Indie Pop",
  genreConfidence: 0.82,
  mood: ["Dreamy", "Energetic", "Melancholic"],
  energy: 0.74,
  danceability: 0.61,
  acousticness: 0.35,
  instrumentalness: 0.12,
  tips: [],
};

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

  useEffect(() => {
    // In MVP, use placeholder. In production, fetch from /api/results?id=xxx
    setTimeout(() => {
      setData(placeholder);
      setLoading(false);
    }, 800);
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

  if (!data) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">Report not found.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-2">
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
          ["Key", data.key],
          ["Energy", `${Math.round(data.energy * 100)}%`],
          ["Dance", `${Math.round(data.danceability * 100)}%`],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-slate-900 rounded-xl p-4 text-center">
            <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
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
      </div>

      {/* Strategy Tips */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Strategy Recommendations</h2>
        {(data.tips && data.tips.length > 0 ? data.tips : [
          {
            title: "Your sound leans Indie Pop — ride the playlist wave",
            body: `Indie Pop tracks on Spotify grew 34% YoY. With your ${data.bpm} BPM tempo and ${data.key} key, you'd fit perfectly on "Indie Pop Rising" and "Fresh Finds" playlists. Submit 2 weeks before release.`,
          },
          {
            title: `Try a ${data.bpm > 120 ? "TikTok" : "YouTube Shorts"} teaser campaign`,
            body: `At ${data.bpm} BPM, your track has the energy for short-form video. Post a 15-second hook clip with a "can you guess the genre?" caption. This format averages 3x engagement over static posts.`,
          },
          {
            title: "Drop on a Thursday — here's why",
            body: "Your genre's audience is most active Thursday–Saturday evenings. Releasing Thursday gives Spotify's algorithm 24 hours to index your track before New Music Friday playlists refresh.",
          },
        ]).map((tip, i) => (
          <div key={i} className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h3 className="font-semibold text-sonifuse-300 mb-2">{tip.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{tip.body}</p>
          </div>
        ))}
      </div>

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
