/**
 * GitHub Actions用スクリプト: Cloudflare保護サイト（douo, koutairen）のスクレイピング
 *
 * Playwrightでブラウザ経由HTMLを取得し、既存パーサーでイベント抽出後、
 * Vercel Blobの既存データにマージして書き戻す。
 *
 * 環境変数:
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob読み書きトークン
 *   ANTHROPIC_API_KEY     — Claude API（koutairenのPDF解析用）
 *
 * 実行: npx tsx scripts/scrape-cf-sites.ts
 */

import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { list, put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types (apps/public-web/src/lib/types.ts から必要なもの)
// ---------------------------------------------------------------------------

interface Discipline {
  name: string;
  grades: string[];
  note?: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
  dateEnd?: string;
  location: string;
  disciplines: Discipline[];
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
  pdfUrl?: string;
  detailUrl?: string;
}

// ---------------------------------------------------------------------------
// Site configs (Cloudflareサイトのみ)
// ---------------------------------------------------------------------------

const CF_SITES = [
  {
    id: "douo",
    name: "道央陸上競技協会",
    url: "https://www.douo-tandf.com/%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1/",
    baseUrl: "https://www.douo-tandf.com/",
  },
  {
    id: "koutairen",
    name: "北海道高体連陸上競技専門部",
    url: "https://www.doukoutairen-rikujyou.com/%E5%A4%A7%E4%BC%9A%E6%97%A5%E7%A8%8B/",
    baseUrl: "https://www.doukoutairen-rikujyou.com/",
  },
] as const;

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
// ID生成 (route.ts の generateId と同じ)
// ---------------------------------------------------------------------------

function generateId(name: string, date: string, sourceId: string): string {
  const slug = name
    .replace(/[^\w\u3000-\u9FFF]/g, "")
    .slice(0, 30);
  return `${sourceId}-${date}-${slug}`;
}

function extractLocationFromName(name: string): string {
  const match = name.match(/[　\s]+([^\s　]+)$/);
  return match ? match[1] : "";
}

// ---------------------------------------------------------------------------
// PDF解析 (pdfParser.ts の parsePdfWithClaude 相当)
// ---------------------------------------------------------------------------

const SCHEDULE_PROMPT = `このPDFは陸上競技の大会スケジュール（年間日程表）です。
すべての大会について以下の情報をJSON配列で抽出してください。

各要素:
- name: 大会名（正式名称）
- date: 開催日（YYYY-MM-DD形式）
- dateEnd: 複数日開催の場合の最終日（YYYY-MM-DD形式、1日のみなら省略）
- location: 開催場所・会場名（記載があれば）

注意:
- 「中止」「延期」と記載のある大会は除外してください
- 日付が不明な大会は除外してください
- JSON配列のみで回答してください。マークダウンのコードブロックは不要です。`;

interface ScheduleEvent {
  name: string;
  date: string;
  dateEnd?: string;
  location?: string;
}

async function parseSchedulePdf(pdfBuffer: Buffer): Promise<ScheduleEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
          },
          { type: "text", text: SCHEDULE_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response");

  let jsonStr = textBlock.text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const arrStart = jsonStr.indexOf("[");
  const arrEnd = jsonStr.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1) jsonStr = jsonStr.substring(arrStart, arrEnd + 1);

  let raw;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    console.error(`[SchedulePDF] Failed to parse: ${jsonStr.slice(0, 200)}`);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((e: Record<string, unknown>) => e.name && e.date) as ScheduleEvent[];
}

// ---------------------------------------------------------------------------
// Douo パーサー (scraper.ts の douo ブランチと同一ロジック)
// ---------------------------------------------------------------------------

function parseDouo(html: string): ScrapedEventRaw[] {
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);

  // デバッグ: HTML先頭を出力
  console.log(`[Douo] HTML snippet (first 500): ${html.slice(0, 500)}`);

  // デバッグ: __WEBSITE_PROPS__ の有無
  const hasProps = html.includes("__WEBSITE_PROPS__");
  console.log(`[Douo] Has __WEBSITE_PROPS__: ${hasProps}`);

  // デバッグ: テキスト全体から日付パターンを検索
  const bodyText = $("body").text();
  const dateMatches = bodyText.match(/\d{4}年\s*\d{1,2}月\d{1,2}日/g);
  console.log(`[Douo] Date patterns in body text: ${dateMatches?.length ?? 0}`);
  if (dateMatches) console.log(`[Douo] Sample: ${dateMatches.slice(0, 3).join(", ")}`);

  // Jimdo CSR: クラス名が異なる可能性があるので複数セレクタを試す
  const selectors = [
    ".j-module.n.j-text p",
    ".j-text p",
    "[class*='j-text'] p",
    "p",
  ];
  for (const sel of selectors) {
    const count = $(sel).length;
    if (count > 0) console.log(`[Douo] Selector "${sel}": ${count} elements`);
  }

  // 元のセレクタで試行
  $(".j-module.n.j-text p").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(
      /(\d{4})年\s*(\d{1,2})月(\d{1,2})日(?:[(（].*?[)）])?(?:\s*～\s*(\d{1,2})日)?\s*(.*)/
    );
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, "0");
      const day = match[3].padStart(2, "0");
      const endDay = match[4] ? match[4].padStart(2, "0") : null;
      const name = match[5].trim();
      const dateStr = endDay
        ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
        : `${year}-${month}-${day}`;
      events.push({ name, dateText: dateStr, detailUrl: "https://www.douo-tandf.com/" });
    }
  });

  // フォールバック: セレクタで見つからなければbodyテキスト全体を行分割してパース
  if (events.length === 0) {
    console.log("[Douo] Falling back to full-text parsing");
    const lines = bodyText.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(
        /(\d{4})年\s*(\d{1,2})月(\d{1,2})日(?:[(（].*?[)）])?(?:\s*～\s*(\d{1,2})日)?\s+(.*)/
      );
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        const day = match[3].padStart(2, "0");
        const endDay = match[4] ? match[4].padStart(2, "0") : null;
        const name = match[5].trim();
        if (!name) continue;
        const dateStr = endDay
          ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
          : `${year}-${month}-${day}`;
        events.push({ name, dateText: dateStr, detailUrl: "https://www.douo-tandf.com/" });
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Koutairen パーサー (scraper.ts の parseKoutairen と同一ロジック)
// ---------------------------------------------------------------------------

async function parseKoutairen(html: string, baseUrl: string): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);

  // 方法1: <a>タグから.pdfリンクを直接検索
  let pdfUrl: string | undefined;
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes(".pdf") && (href.includes("大会") || href.includes("日程") || href.includes("schedule"))) {
      pdfUrl = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
      return false;
    }
  });

  // 方法2: __WEBSITE_PROPS__ JSONからPDFリンクを抽出
  if (!pdfUrl) {
    const startIdx = html.indexOf("window.__WEBSITE_PROPS__");
    if (startIdx !== -1) {
      const jsonStart = html.indexOf("{", startIdx);
      let depth = 0;
      let jsonEnd = jsonStart;
      for (let i = jsonStart; i < html.length; i++) {
        if (html[i] === "{") depth++;
        if (html[i] === "}") depth--;
        if (depth === 0) { jsonEnd = i + 1; break; }
      }
      const jsonStr = html.substring(jsonStart, jsonEnd);
      const pdfMatches = jsonStr.match(/https?:[^"]*\.pdf/g);
      if (pdfMatches && pdfMatches.length > 0) {
        pdfUrl = pdfMatches.find((u) => u.includes("日程") || u.includes("大会")) || pdfMatches[0];
        pdfUrl = pdfUrl.replace(/\\\//g, "/");
      }
    }
  }

  // 方法3: download系のリンクを探す
  if (!pdfUrl) {
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("/app/download/") || href.includes(".pdf")) {
        pdfUrl = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
        return false;
      }
    });
  }

  if (pdfUrl) {
    console.log(`[Koutairen] Found schedule PDF: ${pdfUrl}`);
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error(`Failed to download PDF: ${res.statusText}`);
    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    const pdfEvents = await parseSchedulePdf(pdfBuffer);
    console.log(`[Koutairen] Claude extracted ${pdfEvents.length} events from schedule PDF`);

    for (const pe of pdfEvents) {
      const dateStr = pe.dateEnd ? `${pe.date}~${pe.dateEnd}` : pe.date;
      events.push({
        name: pe.location ? `${pe.name}　${pe.location}` : pe.name,
        dateText: dateStr,
        pdfUrl,
        detailUrl: pdfUrl,
      });
    }
  } else {
    console.warn("[Koutairen] No schedule PDF found on page");
  }

  return events;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Cloudflare Sites Scraper (GitHub Actions) ===\n");

  // 1. Playwright でHTMLを取得
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const htmlMap = new Map<string, string>();

  for (const site of CF_SITES) {
    console.log(`[Playwright] Fetching ${site.name}: ${site.url}`);
    const page = await context.newPage();
    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Jimdoサイトはクライアントサイドレンダリングがあるので少し待つ
      await page.waitForTimeout(5000);
      const html = await page.content();
      htmlMap.set(site.id, html);
      console.log(`[Playwright] Got ${html.length} chars from ${site.id}`);
    } catch (e) {
      console.error(`[Playwright] Failed to fetch ${site.id}:`, e);
      htmlMap.set(site.id, "");
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // 2. 各サイトをパースしてイベント抽出
  const allNewResults: ScrapeResult[] = [];

  for (const site of CF_SITES) {
    const html = htmlMap.get(site.id) || "";
    if (!html) {
      console.warn(`[${site.id}] No HTML, skipping`);
      continue;
    }

    let rawEvents: ScrapedEventRaw[];
    if (site.id === "douo") {
      rawEvents = parseDouo(html);
    } else {
      rawEvents = await parseKoutairen(html, site.baseUrl);
    }

    console.log(`[${site.id}] Parsed ${rawEvents.length} raw events`);

    const events: Event[] = rawEvents.map((raw) => {
      const [dateStart, dateEnd] = raw.dateText.includes("~")
        ? raw.dateText.split("~")
        : [raw.dateText, undefined];
      return {
        id: generateId(raw.name, dateStart, site.id),
        name: raw.name,
        date: dateStart,
        dateEnd,
        location: extractLocationFromName(raw.name),
        disciplines: [],
        detailUrl: raw.detailUrl || site.url,
        sourceId: site.id,
      };
    });

    allNewResults.push({
      sourceId: site.id,
      scrapedAt: new Date().toISOString(),
      events,
    });
  }

  // 3. Vercel Blobの既存データを読み込み、該当sourceIdを差し替え
  console.log("\n[Blob] Reading existing data...");
  const existing = await readFromBlob();
  console.log(`[Blob] Found ${existing.length} existing site results`);

  for (const result of allNewResults) {
    const idx = existing.findIndex((e) => e.sourceId === result.sourceId);
    if (idx >= 0) {
      console.log(
        `[Blob] Replacing ${result.sourceId}: ${existing[idx].events.length} → ${result.events.length} events`
      );
      existing[idx] = result;
    } else {
      console.log(`[Blob] Adding new source: ${result.sourceId} (${result.events.length} events)`);
      existing.push(result);
    }
  }

  // 4. 書き戻し
  console.log("[Blob] Writing updated data...");
  await writeToBlob(existing);

  // サマリー
  const total = allNewResults.reduce((s, r) => s + r.events.length, 0);
  console.log(`\n=== Done: ${total} events from ${allNewResults.length} CF sites ===`);

  for (const r of allNewResults) {
    console.log(`  ${r.sourceId}: ${r.events.length} events`);
    for (const e of r.events) {
      console.log(`    - ${e.date} ${e.name}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
