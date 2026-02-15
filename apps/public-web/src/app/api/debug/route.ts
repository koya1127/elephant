import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // kushiro parser debug
  const url = "https://kushirorikujo.com/r7competitionschedule.html";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder("utf-8").decode(buffer);

  const $ = cheerio.load(html);

  const rows = $("table tr");
  const results: unknown[] = [];

  rows.each((i, el) => {
    if (i >= 5) return; // first 5 rows only
    const tds = $(el).find("td");
    const ths = $(el).find("th");

    // Try to get text from td[0] and td[1]
    const td0 = tds.length > 0 ? $(tds[0]).text().trim().slice(0, 50) : null;
    const td1 = tds.length > 1 ? $(tds[1]).text().trim().slice(0, 50) : null;
    const th0 = ths.length > 0 ? $(ths[0]).text().trim().slice(0, 50) : null;

    // Check if dateMatch would work on td[0]
    const dateText = td0 || "";
    const normalized = dateText.replace(/[\uff10-\uff19]/g, (s: string) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    );
    const dateMatch = normalized.match(/(\d+)\u6708(\d+)\u65e5/);  // N月N日

    results.push({
      row: i,
      tdCount: tds.length,
      thCount: ths.length,
      td0,
      td1,
      th0,
      dateText: normalized,
      dateMatch: dateMatch ? dateMatch[0] : null,
      hasName: !!td1,
    });
  });

  return NextResponse.json({
    url,
    htmlLength: html.length,
    totalRows: rows.length,
    results,
  });
}
