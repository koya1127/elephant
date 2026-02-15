import { NextResponse } from "next/server";
import { scrapeEvents } from "@/lib/scraper";
import { siteConfigs } from "@/config/sites";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId") || "kushiro";

  const config = siteConfigs.find((c) => c.id === siteId);
  if (!config) {
    return NextResponse.json({ error: `Site not found: ${siteId}` }, { status: 404 });
  }

  try {
    const events = await scrapeEvents(config);
    return NextResponse.json({
      siteId,
      eventCount: events.length,
      first5: events.slice(0, 5).map((e) => ({
        name: e.name,
        dateText: e.dateText,
        pdfUrl: e.pdfUrl,
      })),
    });
  } catch (e) {
    return NextResponse.json({
      siteId,
      error: String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    });
  }
}
