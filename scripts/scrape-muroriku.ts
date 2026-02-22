/**
 * ローカル実行用: muroriku（室蘭地方陸上競技協会）のスクレイピング
 *
 * WixサイトはVercelのIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioの<p>要素ごとパース → Postgres DBにupsert
 *
 * 実行: pnpm scrape:muroriku
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   POSTGRES_URL
 */

import { execSync } from "child_process";
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
// HTML取得 + パース
// ---------------------------------------------------------------------------

const MURORIKU_URL =
  "https://muroriku243443.wixsite.com/muroriku/timetable";

const toHalf = (s: string) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function fetchHtml(): string {
  const cmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" "${MURORIKU_URL}"`;
  console.log(`[curl] Fetching ${MURORIKU_URL}`);
  try {
    return execSync(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString("utf-8");
  } catch (e) {
    console.error("[curl] Failed:", e);
    return "";
  }
}

function parseMuroriku(html: string): Array<{ name: string; dateText: string; detailUrl: string }> {
  const events: Array<{ name: string; dateText: string; detailUrl: string }> = [];
  const $ = cheerio.load(html);

  // 年度抽出（全体テキストから）
  const fullText = toHalf($.text());
  const yearMatch = fullText.match(/(\d{4})年度/);
  const scheduleYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  console.log(`[muroriku] scheduleYear: ${scheduleYear}`);

  // <p>要素ごとにテキストを取り出してパース（&nbsp; → space変換含む）
  const lines: string[] = [];
  $("p").each((_, el) => {
    const t = toHalf(($(el).text() as string).replace(/\u00a0/g, " ").trim());
    if (t) lines.push(t);
  });
  console.log(`[muroriku] <p> lines: ${lines.length}`);

  for (const line of lines) {
    const trimmed = line.trim();
    // "M月D日（曜）大会名" または "M月D日（曜）～ M2月D2日（曜）大会名"
    const match = trimmed.match(
      /(\d{1,2})月\s*(\d{1,2})日[（(][日月火水木金土・祝][）)]\s*(.+)/
    );
    if (!match) continue;

    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    let name = match[3]
      .replace(/【終了】/g, "")
      .replace(/（終了）/g, "")
      .replace(/\(終了\)/g, "")
      .trim();
    if (!name) continue;

    // 複数日: "～ M2月D2日" or "～ D2日"
    const endMatch = trimmed.match(/[～~]\s*(?:(\d{1,2})月\s*)?(\d{1,2})日/);
    let dateStr: string;
    if (endMatch) {
      const endMonth = endMatch[1] ? endMatch[1].padStart(2, "0") : month;
      const endDay = endMatch[2].padStart(2, "0");
      if (/^[～~]/.test(name)) {
        name = name.replace(/^[～~]\s*(?:\d{1,2}月\s*)?\d{1,2}日[（(][^）)]*[）)]\s*/, "").trim();
      } else {
        name = name.replace(/[～~].*/, "").trim();
      }
      dateStr = `${scheduleYear}-${month}-${day}~${scheduleYear}-${endMonth}-${endDay}`;
    } else {
      dateStr = `${scheduleYear}-${month}-${day}`;
    }

    if (!name) continue;
    events.push({ name, dateText: dateStr, detailUrl: MURORIKU_URL });
  }

  return events;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Muroriku Scraper (ローカル実行) ===\n");

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。.env.local を確認してください。");
    process.exit(1);
  }

  const html = fetchHtml();
  if (!html) {
    console.error("HTMLの取得に失敗しました。");
    process.exit(1);
  }
  console.log(`[muroriku] Got ${html.length} chars`);

  const rawEvents = parseMuroriku(html);
  console.log(`[muroriku] Parsed ${rawEvents.length} events`);

  if (rawEvents.length === 0) {
    console.warn("イベントが0件。HTMLの構造が変わった可能性があります。");
    process.exit(0);
  }

  const events: Event[] = rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "muroriku"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: extractLocationFromName(raw.name),
      disciplines: [],
      detailUrl: raw.detailUrl || MURORIKU_URL,
      sourceId: "muroriku",
    };
  });

  const scrapedAt = new Date().toISOString();
  console.log("\n[DB] Upserting events...");
  await upsertEventsToDb("muroriku", events, scrapedAt);

  console.log(`\n=== Done: muroriku ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date}${e.dateEnd ? "~" + e.dateEnd : ""} ${e.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
