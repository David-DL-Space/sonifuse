"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      router.push(`/report?id=${data.id}`);
    } catch (e) {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
        Discover Your{" "}
        <span className="text-sonifuse-400">Music DNA</span>
      </h1>
      <p className="text-slate-400 max-w-md mb-10 text-lg">
        Upload a track. We analyze genre, mood, BPM, key — and give you a
        personalized release strategy.
      </p>

      <div
        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 mb-6 transition-colors ${
          dragging
            ? "border-sonifuse-400 bg-sonifuse-400/10"
            : "border-slate-700 hover:border-slate-500"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f && f.type.startsWith("audio/")) setFile(f);
        }}
      >
        {file ? (
          <div className="space-y-2">
            <p className="text-slate-300 text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">🎵</div>
            <p className="text-slate-400">Drag & drop your track here</p>
            <p className="text-slate-600 text-sm">MP3, WAV, FLAC up to 20MB</p>
          </div>
        )}
      </div>

      <label className="cursor-pointer text-sonifuse-400 hover:text-sonifuse-300 text-sm mb-8">
        or browse files
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </label>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-sonifuse-600 hover:bg-sonifuse-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all"
      >
        {loading ? "Analyzing..." : "Analyze My Track"}
      </button>
    </main>
  );
}
