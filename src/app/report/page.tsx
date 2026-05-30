"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface GenreLabel {
  name: string;
  confidence: number;
  parent: string;
}

interface Analysis {
  id: string;
  filename: string;
  duration: number;
  sample_rate: number;
  bpm: number;
  key: string;
  key_confidence: number;
  genres: GenreLabel[];
  genre_confidence: number;
  mood: string[];
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  style_description?: string;
  era?: string[];
  region?: string[];
  scene?: string[];
  use_cases?: string[];
  tips: { title: string; body: string }[];
  _gemini_errors?: string[];
  _model?: string;
  _client_ts?: number;
  _bytes?: number;
  _hash?: string;
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

function TagList({ tags, color = "sonifuse" }: { tags: string[]; color?: string }) {
  if (!tags || tags.length === 0) return null;
  const colors: Record<string, string> = {
    sonifuse: "bg-sonifuse-400/15 text-sonifuse-300",
    green: "bg-green-400/15 text-green-300",
    amber: "bg-amber-400/15 text-amber-300",
    purple: "bg-purple-400/15 text-purple-300",
    pink: "bg-pink-400/15 text-pink-300",
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`px-2.5 py-1 rounded-full text-xs ${colors[color] || colors.sonifuse}`}>
          {t}
        </span>
      ))}
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
    const stored = sessionStorage.getItem("sonifuse_result");
    if (stored) {
      try {
        setData(JSON.parse(stored));
        setLoading(false);
        return;
      } catch {
        // fall through
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
          <p className="text-slate-400">Loading report...</p>
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

  const primaryGenre = data.genres?.[0];

  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-slate-500 text-xs">
          {data.filename}
          <span className="text-slate-700 ml-2">
            {data._client_ts ? `#${String(data._client_ts).slice(-6)}` : `#${data.id}`}
          </span>
        </p>
        <p className="text-sonifuse-400 text-sm font-medium tracking-wide uppercase">Your Music DNA</p>
        <h1 className="text-3xl md:text-4xl font-bold">
          {primaryGenre?.name || "Unknown"}{" "}
          <span className="text-slate-500 text-lg font-normal">
            ({Math.round((primaryGenre?.confidence ?? data.genre_confidence) * 100)}% match)
          </span>
        </h1>
        {data.style_description && (
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed mt-3">
            {data.style_description}
          </p>
        )}
      </div>

      {/* Multi-genre breakdown */}
      {data.genres && data.genres.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Genre Breakdown</p>
          {data.genres.map((g, i) => (
            <div key={g.name} className="flex items-center gap-3">
              <span className="text-slate-300 text-sm w-40 text-right truncate" title={g.name}>
                {g.name}
                {g.parent ? (
                  <span className="text-slate-600 text-xs ml-1">← {g.parent}</span>
                ) : null}
              </span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    i === 0 ? "bg-sonifuse-500" : "bg-slate-600"
                  }`}
                  style={{ width: `${g.confidence * 100}%` }}
                />
              </div>
              <span className="text-slate-400 text-xs w-10">{Math.round(g.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Rich dimension tags */}
      {(data.era?.length || data.region?.length || data.scene?.length) ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.era && data.era.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2">Era</p>
              <TagList tags={data.era} color="amber" />
            </div>
          )}
          {data.region && data.region.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2">Region</p>
              <TagList tags={data.region} color="purple" />
            </div>
          )}
          {data.scene && data.scene.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2">Scene</p>
              <TagList tags={data.scene} color="green" />
            </div>
          )}
        </div>
      ) : null}

      {/* Use cases */}
      {data.use_cases && data.use_cases.length > 0 && (
        <div>
          <p className="text-slate-500 text-xs mb-2">Best For</p>
          <TagList tags={data.use_cases} color="pink" />
        </div>
      )}

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["BPM", data.bpm],
          ["Key", `${data.key}`],
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

      {/* Gemini debug */}
      {data._gemini_errors && data._gemini_errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4">
          <p className="text-red-400 text-xs font-medium mb-1">Gemini fallback — errors:</p>
          {data._gemini_errors.map((e, i) => (
            <p key={i} className="text-red-500 text-xs font-mono">{e}</p>
          ))}
        </div>
      )}

      {/* Diagnostic: file fingerprint — confirms each upload is unique */}
      <div className="bg-slate-900/50 rounded-xl p-3 text-center">
        <p className="text-slate-600 text-[10px] font-mono">
          {data._bytes != null ? `${(data._bytes/1024).toFixed(1)}KB` : "?"} · {data._hash || "?"}
        </p>
      </div>

      {/* CTA */}
      <SubscribeCTA />

      {/* Back link */}
      <div className="text-center">
        <a href="/" className="text-slate-500 hover:text-slate-400 text-sm">
          ← Analyze another track
        </a>
      </div>
    </main>
  );
}

function SubscribeCTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubscribe = async () => {
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="text-center pt-8">
        <p className="text-green-400 text-sm">✓ Got it! We'll keep you posted.</p>
      </div>
    );
  }

  return (
    <div className="text-center pt-8">
      <p className="text-slate-500 text-sm mb-4">Want the full report with competitor analysis?</p>
      <div className="flex items-center justify-center gap-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sonifuse-500"
        />
        <button
          onClick={handleSubscribe}
          disabled={status === "loading"}
          className="bg-sonifuse-600 hover:bg-sonifuse-500 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
        >
          {status === "loading" ? "Sending..." : "Unlock Full Report"}
        </button>
      </div>
      {status === "error" && <p className="text-red-400 text-xs mt-2">Something went wrong. Try again.</p>}
    </div>
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
