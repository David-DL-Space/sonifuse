import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sonifuse — AI Music DNA Analyzer",
  description:
    "Upload your track and discover your Music DNA. Get AI-powered strategy recommendations for your next release.",
  openGraph: {
    title: "Sonifuse — Discover Your Music DNA",
    description:
      "Upload a track. Get your genre, mood, BPM, and personalized strategy tips. Free for independent musicians.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
