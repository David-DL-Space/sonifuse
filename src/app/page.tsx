"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // ── Recording state ────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const doAnalyze = useCallback(async (audioFile: File) => {
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", audioFile);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      // Store with a timestamp so user can confirm it's a new analysis
      data._client_ts = Date.now();
      sessionStorage.setItem("sonifuse_result", JSON.stringify(data));
      router.push(`/report?id=${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleUpload = async () => {
    if (!file) return;
    doAnalyze(file);
  };

  // ── Recording handlers ─────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS Safari doesn't support audio/webm; fall back to default MIME
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const recMime = mediaRecorder.current?.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type: recMime });
        // Revoke old URL and create new one for playback
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
      };

      recorder.start();
      setRecording(true);
      setRecordTime(0);
      // Clear previous recording state
      setRecordedBlob(null);
      setRecordedUrl(null);
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow mic permissions.");
    }
  }, [doAnalyze, recordedUrl]);

  const handleAnalyzeRecording = useCallback(() => {
    if (!recordedBlob) return;
    const recMime = mediaRecorder.current?.mimeType || "audio/webm";
    const ext = recMime.includes("mp4") ? "m4a" : "webm";
    const audioFile = new File([recordedBlob], `recording_${Date.now()}.${ext}`, { type: recMime });
    doAnalyze(audioFile);
  }, [recordedBlob, doAnalyze]);

  const discardRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
  }, [recordedUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      setFinalDuration(recordTime);
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [recordTime]);

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

      {/* Desktop: drag & drop zone */}
      <div
        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 mb-6 transition-colors ${
          isMobile ? "hidden" : ""
        } ${
          dragging
            ? "border-sonifuse-400 bg-sonifuse-400/10"
            : "border-slate-700 hover:border-slate-500"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
            <p className="text-slate-500 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">🎵</div>
            <p className="text-slate-400">Drag & drop your track here</p>
            <p className="text-slate-600 text-sm">MP3, WAV, FLAC up to 50MB</p>
          </div>
        )}
      </div>

      {/* Mobile: Record → Preview → Analyze flow */}
      {isMobile && !file && (
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* State 1: Ready to record */}
          {!recording && !recordedBlob && (
            <button
              onClick={startRecording}
              disabled={loading}
              className="w-20 h-20 rounded-full bg-sonifuse-600 hover:bg-sonifuse-500 active:scale-95 flex flex-col items-center justify-center gap-1 transition-all duration-200 select-none"
            >
              <span className="text-2xl">🎤</span>
              <span className="text-white text-[10px] font-medium leading-tight">
                Tap to<br />Record
              </span>
            </button>
          )}

          {/* State 2: Recording */}
          {recording && (
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-sm font-mono">{recordTime}s</span>
              </div>
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-500/30"
              >
                <span className="text-white text-lg font-bold">■</span>
              </button>
            </div>
          )}

          {/* State 3: Preview playback */}
          {!recording && recordedBlob && recordedUrl && (
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <p className="text-slate-300 text-sm font-medium">🎧 Recorded {finalDuration}s</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={recordedUrl} className="w-full h-9 [&::-webkit-media-controls-panel]:bg-slate-800 rounded-lg" />
              <div className="flex gap-3">
                <button
                  onClick={handleAnalyzeRecording}
                  disabled={loading}
                  className="bg-sonifuse-600 hover:bg-sonifuse-500 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all"
                >
                  {loading ? "Analyzing..." : "Analyze ✓"}
                </button>
                <button
                  onClick={discardRecording}
                  disabled={loading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  Re-record
                </button>
              </div>
            </div>
          )}

          {recording && (
            <p className="text-red-400 text-xs animate-pulse">
              Recording… tap ■ to stop
            </p>
          )}
          {!recording && !recordedBlob && (
            <p className="text-slate-500 text-xs">or</p>
          )}
        </div>
      )}

      {/* File browse (desktop) and fallback for mobile */}
      <label className={`cursor-pointer text-sonifuse-400 hover:text-sonifuse-300 text-sm mb-8 ${isMobile && file ? "" : isMobile && !file ? "" : ""}`}>
        {isMobile && !file ? "Choose a file instead" : file ? "Change file" : "or browse files"}
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

      {file && (
        <div className="w-full max-w-md bg-slate-900 rounded-xl p-4 mb-6 text-left">
          <p className="text-slate-300 text-sm truncate">{file.name}</p>
          <p className="text-slate-500 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {(file || recording) && (
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-sonifuse-600 hover:bg-sonifuse-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all"
        >
          {loading ? "Analyzing..." : "Analyze My Track"}
        </button>
      )}
    </main>
  );
}
