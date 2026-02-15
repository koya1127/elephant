import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const tests: Record<string, { url: string; encoding: string; selector: string }> = {
    sorachi: {
      url: "https://sorachi-rikkyo.com/event/2025/requirements.html",
      encoding: "shift_jis",
      selector: "table tr",
    },
    kushiro: {
      url: "https://kushirorikujo.com/r7competitionschedule.html",
      encoding: "utf-8",
      selector: "table tr",
    },
    sapporo: {
      url: "https://jaaf-sapporo.jp/schedule/index.html",
      encoding: "utf-8",
      selector: "table.nomal-table tr",
    },
  };

  const test = tests[siteId];
  if (!test) {
    return NextResponse.json({ error: `No test for ${siteId}` });
  }

  try {
    // Step 1: Fetch
    const res = await fetch(test.url, { headers: { "User-Agent": UA } });
    const buffer = await res.arrayBuffer();

    // Step 2: Decode
    let html: string;
    try {
      const decoder = new TextDecoder(test.encoding);
      html = decoder.decode(buffer);
    } catch (decodeErr) {
      return NextResponse.json({
        step: "decode",
        error: String(decodeErr),
        encoding: test.encoding,
        bufferSize: buffer.byteLength,
      });
    }

    // Step 3: Cheerio
    const $ = cheerio.load(html);
    const rows = $(test.selector);
    const rowCount = rows.length;

    // Step 4: Inspect first 3 rows
    const rowDetails: unknown[] = [];
    rows.slice(0, 5).each((i, el) => {
      const tds = $(el).find("td");
      const ths = $(el).find("th");
      rowDetails.push({
        index: i,
        tdCount: tds.length,
        thCount: ths.length,
        html: $(el).html()?.slice(0, 300),
      });
    });

    return NextResponse.json({
      fetchStatus: res.status,
      bufferSize: buffer.byteLength,
      htmlLength: html.length,
      htmlPreview: html.slice(0, 300),
      selector: test.selector,
      rowCount,
      rowDetails,
    });
  } catch (e) {
    return NextResponse.json({
      error: String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  }
}
