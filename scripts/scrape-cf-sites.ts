/**
 * GitHub Actions用スクリプト: koutairen（高体連）のスクレイピング
 *
 * Playwright + stealth でHTML取得 → スケジュールPDFをClaude解析 → Vercel Blobにマージ
 *
 * 環境変数:
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob読み書きトークン
 *   ANTHROPIC_API_KEY     — Claude API（PDF解析用）
 *
 * 実行: npx tsx scripts/scrape-cf-sites.ts
 */

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { list, put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

chromium.use(StealthPlugin());

// ---------------------------------------------------------------------------
// Types
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
// PDF解析
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
// Koutairen パーサー
// ---------------------------------------------------------------------------

async function parseKoutairen(html: string, baseUrl: string): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);

  let pdfUrl: string | undefined;

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes(".pdf") && (href.includes("大会") || href.includes("日程") || href.includes("schedule"))) {
      pdfUrl = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
      return false;
    }
  });

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
    console.log(`[Koutairen] Claude extracted ${pdfEvents.length} events`);

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
    console.warn("[Koutairen] No schedule PDF found");
  }

  return events;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Koutairen Scraper (GitHub Actions) ===\n");

  const url = "https://www.doukoutairen-rikujyou.com/%E5%A4%A7%E4%BC%9A%E6%97%A5%E7%A8%8B/";
  const baseUrl = "https://www.doukoutairen-rikujyou.com/";

  // Playwright でHTML取得
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  let html = "";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const title = await page.title();
    if (title.includes("Just a moment")) {
      console.log("[Playwright] Cloudflare challenge detected, waiting...");
      try {
        await page.waitForFunction(
          () => !document.title.includes("Just a moment"),
          { timeout: 30000 }
        );
        console.log("[Playwright] Passed Cloudflare challenge");
      } catch {
        console.warn("[Playwright] Cloudflare challenge did not resolve");
      }
    }
    await page.waitForTimeout(5000);
    html = await page.content();
    console.log(`[Playwright] Got ${html.length} chars`);
  } finally {
    await page.close();
    await browser.close();
  }

  if (!html) {
    console.error("No HTML, aborting");
    process.exit(1);
  }

  // パース
  const rawEvents = await parseKoutairen(html, baseUrl);
  console.log(`[koutairen] Parsed ${rawEvents.length} events`);

  const events: Event[] = rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "koutairen"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: extractLocationFromName(raw.name),
      disciplines: [],
      detailUrl: raw.detailUrl || url,
      sourceId: "koutairen",
    };
  });

  const result: ScrapeResult = {
    sourceId: "koutairen",
    scrapedAt: new Date().toISOString(),
    events,
  };

  // Vercel Blob マージ
  console.log("\n[Blob] Reading existing data...");
  const existing = await readFromBlob();
  const idx = existing.findIndex((e) => e.sourceId === "koutairen");
  if (idx >= 0) {
    console.log(`[Blob] Replacing koutairen: ${existing[idx].events.length} → ${events.length} events`);
    existing[idx] = result;
  } else {
    console.log(`[Blob] Adding koutairen: ${events.length} events`);
    existing.push(result);
  }

  console.log("[Blob] Writing...");
  await writeToBlob(existing);

  console.log(`\n=== Done: koutairen ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
