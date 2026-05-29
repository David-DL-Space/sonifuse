import { NextRequest, NextResponse } from "next/server";

// Mock analysis data for MVP — will be replaced by Python FastAPI backend
const mockAnalysis = {
  bpm: 128,
  key: "Am",
  genre: "Indie Pop",
  genreConfidence: 0.82,
  mood: ["Dreamy", "Energetic", "Melancholic"],
  energy: 0.74,
  danceability: 0.61,
  acousticness: 0.35,
  instrumentalness: 0.12,
};

const strategyTips = [
  {
    title: "Your sound leans Indie Pop — ride the playlist wave",
    body: `Indie Pop tracks on Spotify grew 34% YoY. With your ${mockAnalysis.bpm} BPM tempo and ${mockAnalysis.key} key, you'd fit perfectly on "Indie Pop Rising" and "Fresh Finds" playlists. Submit 2 weeks before release.`,
  },
  {
    title: `Try a ${mockAnalysis.bpm > 120 ? "TikTok" : "YouTube Shorts"} teaser campaign`,
    body: `At ${mockAnalysis.bpm} BPM, your track has the energy for short-form video. Post a 15-second hook clip with a "can you guess the genre?" caption. This format averages 3x engagement over static posts.`,
  },
  {
    title: "Drop on a Thursday — here's why",
    body: "Your genre's audience is most active Thursday–Saturday evenings. Releasing Thursday gives Spotify's algorithm 24 hours to index your track before New Music Friday playlists refresh.",
  },
];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const _file = formData.get("file");

  if (!_file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 1500));

  const id = Date.now().toString(36);

  return NextResponse.json({
    id,
    ...mockAnalysis,
    tips: strategyTips,
  });
}
