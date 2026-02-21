/**
 * ローカル実行用: muroriku（室蘭地方陸上競技協会）のスクレイピング
 *
 * WixサイトはVercelのIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioの<p>要素ごとパース → Vercel Blobにマージ
 *
 * 実行: pnpm scrape:muroriku
 *
 * 必要な環境変数（.env.blob から自動読み込み）:
 *   BLOB_READ_WRITE_TOKEN
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as cheerio from "cheerio";
import { list, put } from "@vercel/blob";

// .env.blob を読み込み
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env.blob");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.blob がなければスキップ
  }
}
loadEnv();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Event {
  id: string;
  name: string;
  date: string;
  dateEnd?: string;
  location: string;
  disciplines: { name: string; grades: string[]; note?: string }[];
  maxEntries?: number;
  detailUrl: string;
  sourceId: string;
  entryDeadline?: string;
  note?: string;
  pdfSize?: number;
}

interface ScrapeResult {
  sourceId: string;
  scrapedAt: string;
  events: Event[];
}

// ---------------------------------------------------------------------------
// Blob I/O
// ---------------------------------------------------------------------------

const BLOB_PATH = "events.json";

async function readFromBlob(): Promise<ScrapeResult[]> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeToBlob(data: ScrapeResult[]): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await put(BLOB_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
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
      // パターンA: "大会名～終了日" → ～以降を削除
      // パターンB: "～終了日（曜）大会名" → nameが～始まりの場合、終了日の後の大会名を取得
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN が未設定。.env.blob を確認してください。");
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

  console.log("\n[Blob] Reading existing data...");
  const existing = await readFromBlob();
  const idx = existing.findIndex((e) => e.sourceId === "muroriku");
  if (idx >= 0) {
    console.log(`[Blob] Replacing muroriku: ${existing[idx].events.length} → ${events.length} events`);
    existing[idx] = { sourceId: "muroriku", scrapedAt: new Date().toISOString(), events };
  } else {
    console.log(`[Blob] Adding muroriku: ${events.length} events`);
    existing.push({ sourceId: "muroriku", scrapedAt: new Date().toISOString(), events });
  }

  console.log("[Blob] Writing...");
  await writeToBlob(existing);

  console.log(`\n=== Done: muroriku ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date}${e.dateEnd ? "~" + e.dateEnd : ""} ${e.name}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
