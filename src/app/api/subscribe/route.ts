import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SUBSCRIBERS_FILE = path.join(process.cwd(), "subscribers.json");

interface Subscriber {
  email: string;
  id: string;
  timestamp: string;
}

function readSubscribers(): Subscriber[] {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function appendSubscriber(sub: Subscriber) {
  const subs = readSubscribers();
  subs.push(sub);
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    appendSubscriber({
      email,
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
