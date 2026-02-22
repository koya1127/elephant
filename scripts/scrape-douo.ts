/**
 * ローカル実行用: douo（道央陸上競技協会）のスクレイピング
 *
 * CloudflareがデータセンターIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioでパース → Postgres DBにupsert
 *
 * 実行: pnpm scrape:douo
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   POSTGRES_URL
 */

import { execSync } from "child_process";
import * as cheerio from "cheerio";
import { loadEnv, upsertEventsToDb, type Event } from "./lib/db";

loadEnv();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapedEventRaw {
  name: string;
  dateText: string;
  detailUrl?: string;
}

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
// HTML取得 + パース
// ---------------------------------------------------------------------------

const DOUO_URL = "https://www.douo-tandf.com/%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1/";

function fetchHtml(): string {
  const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${DOUO_URL}"`;
  console.log(`[curl] ${cmd}`);
  try {
    return execSync(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString("utf-8");
  } catch (e) {
    console.error("[curl] Failed:", e);
    return "";
  }
}

function parseDouo(html: string): ScrapedEventRaw[] {
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);
  const bodyText = $("body").text();

  const dateRe = /(\d{4})年\s*(\d{1,2})月(\d{1,2})日/g;
  const datePositions: Array<{ year: string; month: string; day: string; index: number }> = [];
  let m;
  while ((m = dateRe.exec(bodyText)) !== null) {
    datePositions.push({ year: m[1], month: m[2], day: m[3], index: m.index });
  }

  for (let i = 0; i < datePositions.length; i++) {
    const dp = datePositions[i];

    const prevEnd = i > 0
      ? bodyText.indexOf("開催", datePositions[i - 1].index)
      : 0;
    const nameStart = prevEnd !== -1 ? prevEnd : 0;
    const before = bodyText.substring(nameStart, dp.index);

    let name = "";
    const tagMatch = before.match(/(?:【終了】|【中止】)\s*([^【]+)$/);
    if (tagMatch) {
      name = tagMatch[1].trim();
    } else {
      const afterDoc = before.match(/(?:審判編成|タイムテーブル|競技者注意事項|要項)\s*(.+)$/);
      if (afterDoc) {
        name = afterDoc[1].trim();
      }
    }
    while (name.length > 40) {
      const lastPart = name.match(/(?:審判編成|タイムテーブル|競技者注意事項|要項)\s*(.+)$/);
      if (lastPart && lastPart[1].length < name.length) {
        name = lastPart[1].trim();
      } else {
        break;
      }
    }

    const afterDate = bodyText.substring(dp.index, dp.index + 80);
    const endDayMatch = afterDate.match(/[・～]\s*(\d{1,2})日/);
    const endDay = endDayMatch ? endDayMatch[1].padStart(2, "0") : null;

    const month = dp.month.padStart(2, "0");
    const day = dp.day.padStart(2, "0");
    const dateStr = endDay
      ? `${dp.year}-${month}-${day}~${dp.year}-${month}-${endDay}`
      : `${dp.year}-${month}-${day}`;

    if (!name || name.length < 3) continue;

    const isDupe = events.some((e) =>
      e.dateText === dateStr && e.name.slice(0, 5) === name.slice(0, 5)
    );
    if (!isDupe) {
      events.push({ name, dateText: dateStr, detailUrl: DOUO_URL });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Douo Scraper (ローカル実行) ===\n");

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。.env.local を確認してください。");
    process.exit(1);
  }

  // 1. HTML取得
  const html = fetchHtml();
  if (!html || html.includes("Just a moment")) {
    console.error("Cloudflareにブロックされました。ネットワーク環境を確認してください。");
    process.exit(1);
  }
  console.log(`[douo] Got ${html.length} chars`);

  // 2. パース
  const rawEvents = parseDouo(html);
  console.log(`[douo] Parsed ${rawEvents.length} events`);

  if (rawEvents.length === 0) {
    console.warn("イベントが0件。HTMLの構造が変わった可能性があります。");
    process.exit(0);
  }

  const events: Event[] = rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "douo"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: extractLocationFromName(raw.name),
      disciplines: [],
      detailUrl: raw.detailUrl || DOUO_URL,
      sourceId: "douo",
    };
  });

  // 3. DB upsert
  const scrapedAt = new Date().toISOString();
  console.log("\n[DB] Upserting events...");
  await upsertEventsToDb("douo", events, scrapedAt);

  console.log(`\n=== Done: douo ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
