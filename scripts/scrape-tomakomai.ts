/**
 * ローカル実行用: tomakomai（苫小牧陸上競技協会）のスクレイピング
 *
 * JimdoサイトがVercelのIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioでパース → Vercel Blobにマージ
 *
 * 実行: pnpm scrape:tomakomai
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
  pdfUrl?: string;
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
  pdfUrl?: string;
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

// ---------------------------------------------------------------------------
// HTML取得 + パース
// ---------------------------------------------------------------------------

const TOMAKOMAI_URL = "https://tomakomairikkyo.jimdofree.com/%E7%AB%B6%E6%8A%80%E4%BC%9A%E7%AD%89%E6%83%85%E5%A0%B1/";
const BASE_URL = "https://tomakomairikkyo.jimdofree.com/";

function fetchHtml(): string {
  const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "${TOMAKOMAI_URL}"`;
  console.log(`[curl] fetching ${TOMAKOMAI_URL}`);
  try {
    return execSync(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString("utf-8");
  } catch (e) {
    console.error("[curl] Failed:", e);
    return "";
  }
}

function parseTomakomai(html: string): ScrapedEventRaw[] {
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);

  // 全角数字→半角変換
  const toHalf = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  // 令和→西暦変換
  const reiwaToYear = (r: number) => 2018 + r;

  $(".j-hgrid").each((_, el) => {
    const block = $(el);

    // 大会名: font-size:22px のテキストを結合
    const nameParts: string[] = [];
    block.find("b, span, strong").each((_, tag) => {
      const style = $(tag).attr("style") || "";
      if (style.includes("font-size") && style.includes("22")) {
        const t = $(tag).text().trim();
        if (t) nameParts.push(t);
      }
    });
    // フォールバック: 緑色テキスト
    if (nameParts.length === 0) {
      block.find("span, b, strong").each((_, tag) => {
        const style = $(tag).attr("style") || "";
        if (style.includes("color") && style.includes("#254e0e")) {
          const t = $(tag).text().trim();
          if (t && t.length > 3) nameParts.push(t);
        }
      });
    }
    if (nameParts.length === 0) return;

    const name = nameParts.join("")
      .replace(/\s*E-mail:.*$/i, "")
      .replace(/\s*※.*$/, "")
      .trim();
    if (!name || name.includes("@")) return;

    // 開催日: 赤文字の「開催日」行
    let dateText = "";
    block.find("span, b, strong, font").each((_, tag) => {
      const style = $(tag).attr("style") || "";
      const color = $(tag).attr("color") || "";
      const text = $(tag).text().trim();
      if (
        (style.includes("#ff0000") || style.includes("red") ||
         color.includes("#ff0000") || color.includes("red")) &&
        text.includes("開催日")
      ) {
        dateText = text;
      }
    });
    // フォールバック: テキスト全体から開催日を探す
    if (!dateText) {
      const allText = block.text();
      const match = allText.match(/開催日[：:].*/);
      if (match) dateText = match[0];
    }
    if (!dateText) return;

    // 令和日付をパース
    const normalized = toHalf(dateText);
    const reiwaMatch = normalized.match(/令和(\d+)年(\d+)月(\d+)日/);
    if (!reiwaMatch) return;

    const westernYear = reiwaToYear(parseInt(reiwaMatch[1], 10));
    const month = reiwaMatch[2].padStart(2, "0");
    const day = reiwaMatch[3].padStart(2, "0");

    // 終了日（〜）
    let endDateStr: string | null = null;
    const endMatch = normalized.match(/[～〜~]\s*(?:(\d+)月)?(\d+)日/);
    if (endMatch) {
      const endMonth = endMatch[1] ? endMatch[1].padStart(2, "0") : month;
      const endDay = endMatch[2].padStart(2, "0");
      endDateStr = `${westernYear}-${endMonth}-${endDay}`;
    }

    const dateStr = endDateStr
      ? `${westernYear}-${month}-${day}~${endDateStr}`
      : `${westernYear}-${month}-${day}`;

    // PDFリンク: 後続兄弟の .j-imageSubtitle から要項PDFを探す
    let pdfUrl: string | undefined;
    let sibling = block.next();
    for (let i = 0; i < 5 && sibling.length; i++) {
      if (sibling.hasClass("j-hgrid")) break;
      sibling.find(".j-imageSubtitle figure a, .j-imageSubtitle a, a").each((_, a) => {
        if (pdfUrl) return;
        const href = $(a).attr("href") || "";
        const caption =
          $(a).closest("figure").find("figcaption").text() || $(a).text();
        if (href && (caption.includes("要項") || caption.includes("大会要項"))) {
          pdfUrl = href.startsWith("http")
            ? href
            : new URL(href, BASE_URL).toString();
        }
      });
      if (pdfUrl) break;
      sibling = sibling.next();
    }

    events.push({
      name,
      dateText: dateStr,
      pdfUrl: pdfUrl?.endsWith(".pdf") ? pdfUrl : undefined,
      detailUrl: pdfUrl || TOMAKOMAI_URL,
    });
  });

  return events;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Tomakomai Scraper (ローカル実行) ===\n");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN が未設定。.env.blob を確認してください。");
    process.exit(1);
  }

  // 1. HTML取得
  const html = fetchHtml();
  if (!html || html.includes("Just a moment") || html.trim().length < 100) {
    console.error("HTMLの取得に失敗しました。ネットワーク環境を確認してください。");
    process.exit(1);
  }
  console.log(`[tomakomai] Got ${html.length} chars`);

  // 2. パース
  const rawEvents = parseTomakomai(html);
  console.log(`[tomakomai] Parsed ${rawEvents.length} events`);

  if (rawEvents.length === 0) {
    console.warn("イベントが0件。HTMLの構造が変わった可能性があります。");
    process.exit(0);
  }

  const events: Event[] = rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "tomakomai"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: "苫小牧市",
      disciplines: [],
      detailUrl: raw.detailUrl || TOMAKOMAI_URL,
      sourceId: "tomakomai",
      pdfUrl: raw.pdfUrl,
    };
  });

  // 3. Vercel Blob マージ
  console.log("\n[Blob] Reading existing data...");
  const existing = await readFromBlob();
  const idx = existing.findIndex((e) => e.sourceId === "tomakomai");
  if (idx >= 0) {
    console.log(`[Blob] Replacing tomakomai: ${existing[idx].events.length} → ${events.length} events`);
    existing[idx] = { sourceId: "tomakomai", scrapedAt: new Date().toISOString(), events };
  } else {
    console.log(`[Blob] Adding tomakomai: ${events.length} events`);
    existing.push({ sourceId: "tomakomai", scrapedAt: new Date().toISOString(), events });
  }

  console.log("[Blob] Writing...");
  await writeToBlob(existing);

  console.log(`\n=== Done: tomakomai ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}${e.pdfUrl ? " [PDF]" : ""}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
