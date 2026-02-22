/**
 * ローカル実行用: osrk（小樽後志陸上競技協会）のスクレイピング
 *
 * osrk.jpのWP REST APIはVercel・GitHub ActionsのIPをブロックするため
 * ローカルPCからのみ実行可能。
 *
 * 実行: pnpm scrape:osrk
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   POSTGRES_URL
 */

import * as cheerio from "cheerio";
import { loadEnv, upsertEventsToDb, type Event } from "./lib/db";

loadEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(name: string, date: string, sourceId: string): string {
  const slug = name.replace(/[^\w\u3000-\u9FFF]/g, "").slice(0, 30);
  return `${sourceId}-${date}-${slug}`;
}

function extractLocationFromName(name: string): string {
  const match = name.match(/[　\s]+([^\s　]+)$/);
  return match ? match[1] : "";
}

// ---------------------------------------------------------------------------
// WP REST API スクレイピング
// ---------------------------------------------------------------------------

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const toHalf = (s: string) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

async function scrapeOsrk(): Promise<Array<{ name: string; dateText: string; detailUrl: string; pdfUrl?: string }>> {
  const apiUrl =
    "https://osrk.jp/wp-json/wp/v2/posts?categories=4&per_page=100&orderby=date&order=desc";

  const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`WP API status: ${res.status}`);

  const posts: Array<{
    title: { rendered: string };
    content: { rendered: string };
    link: string;
  }> = await res.json();
  console.log(`[osrk] WP API returned ${posts.length} posts`);

  const events: Array<{ name: string; dateText: string; detailUrl: string; pdfUrl?: string }> = [];

  for (const post of posts) {
    const $ = cheerio.load(post.content.rendered);
    const bodyText = toHalf($.text());

    const dateMatch = bodyText.match(/(\d{4})年[^月\n]*?(\d{1,2})月\s*(\d{1,2})日/);
    if (!dateMatch) continue;

    const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    let pdfUrl: string | undefined;
    $("a").each((_, a) => {
      if (pdfUrl) return;
      const href = $(a).attr("href") || "";
      const text = $(a).text().trim();
      if (href.endsWith(".pdf") && text.includes("要項")) {
        pdfUrl = href.startsWith("http") ? href : new URL(href, "https://osrk.jp/").toString();
      }
    });

    const name = cheerio.load(post.title.rendered).text().trim();
    if (!name) continue;

    events.push({ name, dateText: dateStr, detailUrl: post.link, pdfUrl });
  }

  return events;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Osrk Scraper (ローカル実行) ===\n");

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。.env.local を確認してください。");
    process.exit(1);
  }

  const rawEvents = await scrapeOsrk();
  console.log(`[osrk] Parsed ${rawEvents.length} events`);

  if (rawEvents.length === 0) {
    console.warn("イベントが0件。WP API応答を確認してください。");
    process.exit(0);
  }

  const events: Event[] = rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "osrk"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: extractLocationFromName(raw.name),
      disciplines: [],
      detailUrl: raw.detailUrl || "https://osrk.jp/",
      sourceId: "osrk",
    };
  });

  const scrapedAt = new Date().toISOString();
  console.log("\n[DB] Upserting events...");
  await upsertEventsToDb("osrk", events, scrapedAt);

  console.log(`\n=== Done: osrk ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
