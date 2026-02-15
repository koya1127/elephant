/**
 * ローカル実行用: douo（道央陸上競技協会）のスクレイピング
 *
 * CloudflareがデータセンターIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioでパース → Vercel Blobにマージ
 *
 * 実行: pnpm scrape:douo
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
      // クォート除去
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
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

interface ScrapedEventRaw {
  name: string;
  dateText: string;
  detailUrl?: string;
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

  // 道央サイトの構造: 「【終了】大会名 YYYY年M月D日(曜)開催」
  // → 大会名は日付の **前** にある
  const dateRe = /(\d{4})年\s*(\d{1,2})月(\d{1,2})日/g;
  const datePositions: Array<{ year: string; month: string; day: string; index: number }> = [];
  let m;
  while ((m = dateRe.exec(bodyText)) !== null) {
    datePositions.push({ year: m[1], month: m[2], day: m[3], index: m.index });
  }

  for (let i = 0; i < datePositions.length; i++) {
    const dp = datePositions[i];

    // 日付の前のテキストから大会名を抽出
    // 前の日付の「開催」以降 ～ この日付の直前 を切り出す
    const prevEnd = i > 0
      ? bodyText.indexOf("開催", datePositions[i - 1].index)
      : 0;
    const nameStart = prevEnd !== -1 ? prevEnd : 0;
    const before = bodyText.substring(nameStart, dp.index);

    // 大会名は日付の前にある
    // パターン: 「【終了】大会名 YYYY年M月D日」
    // 前のテキストから最後の【終了】or【中止】以降を大会名とする
    let name = "";
    const tagMatch = before.match(/(?:【終了】|【中止】)\s*([^【]+)$/);
    if (tagMatch) {
      name = tagMatch[1].trim();
    } else {
      // タグなし: 最後の区切り（審判編成/タイムテーブル/要項等）の後のテキスト
      const afterDoc = before.match(/(?:審判編成|タイムテーブル|競技者注意事項|要項)\s*(.+)$/);
      if (afterDoc) {
        name = afterDoc[1].trim();
      }
    }
    // 名前が長すぎる場合はゴミ混入 → 最後の文書キーワード以降を繰り返し切り詰め
    while (name.length > 40) {
      const lastPart = name.match(/(?:審判編成|タイムテーブル|競技者注意事項|要項)\s*(.+)$/);
      if (lastPart && lastPart[1].length < name.length) {
        name = lastPart[1].trim();
      } else {
        break;
      }
    }

    // 終了日
    const afterDate = bodyText.substring(dp.index, dp.index + 80);
    const endDayMatch = afterDate.match(/[・～]\s*(\d{1,2})日/);
    const endDay = endDayMatch ? endDayMatch[1].padStart(2, "0") : null;

    const month = dp.month.padStart(2, "0");
    const day = dp.day.padStart(2, "0");
    const dateStr = endDay
      ? `${dp.year}-${month}-${day}~${dp.year}-${month}-${endDay}`
      : `${dp.year}-${month}-${day}`;

    if (!name || name.length < 3) continue;

    // 重複排除
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN が未設定。.env.blob を確認してください。");
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

  // 3. Vercel Blob マージ
  console.log("\n[Blob] Reading existing data...");
  const existing = await readFromBlob();
  const idx = existing.findIndex((e) => e.sourceId === "douo");
  if (idx >= 0) {
    console.log(`[Blob] Replacing douo: ${existing[idx].events.length} → ${events.length} events`);
    existing[idx] = { sourceId: "douo", scrapedAt: new Date().toISOString(), events };
  } else {
    console.log(`[Blob] Adding douo: ${events.length} events`);
    existing.push({ sourceId: "douo", scrapedAt: new Date().toISOString(), events });
  }

  console.log("[Blob] Writing...");
  await writeToBlob(existing);

  console.log(`\n=== Done: douo ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
