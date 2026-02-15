import { NextResponse } from "next/server";
import { scrapeEvents } from "@/lib/scraper";
import { siteConfigs } from "@/config/sites";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  if (siteId) {
    // 特定サイトのスクレイパーをテスト
    const config = siteConfigs.find((c) => c.id === siteId);
    if (!config) {
      return NextResponse.json({ error: `Site not found: ${siteId}` }, { status: 404 });
    }

    try {
      const events = await scrapeEvents(config);
      return NextResponse.json({
        siteId,
        eventCount: events.length,
        events: events.slice(0, 5),
      });
    } catch (e) {
      return NextResponse.json({
        siteId,
        error: String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  }

  // URL直接テスト
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "siteId or url required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const buffer = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);

    return NextResponse.json({
      status: res.status,
      bodyLength: buffer.byteLength,
      bodyPreview: text.slice(0, 500),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
