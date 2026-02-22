/**
 * GitHub Actions用スクリプト: koutairen（高体連）のスクレイピング
 *
 * Playwright + stealth でHTML取得 → スケジュールPDFをClaude解析 → Postgres DBにupsert
 *
 * 環境変数:
 *   POSTGRES_URL         — Postgres接続URL
 *   ANTHROPIC_API_KEY    — Claude API（PDF解析用）
 *
 * 実行: npx tsx scripts/scrape-cf-sites.ts
 */

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, upsertEventsToDb, type Event, type Discipline } from "./lib/db";

loadEnv();

chromium.use(StealthPlugin());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapedEventRaw {
  name: string;
  dateText: string;
  pdfUrl?: string;
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
// Osrk パーサー (小樽後志)
// ---------------------------------------------------------------------------

const OSRK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function scrapeOsrk(): Promise<ScrapedEventRaw[]> {
  const toHalf = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  const apiUrl =
    "https://osrk.jp/wp-json/wp/v2/posts?categories=4&per_page=100&orderby=date&order=desc";

  const res = await fetch(apiUrl, { headers: { "User-Agent": OSRK_UA } });
  if (!res.ok) throw new Error(`WP API status: ${res.status}`);

  const posts: Array<{
    title: { rendered: string };
    content: { rendered: string };
    link: string;
  }> = await res.json();
  console.log(`[Osrk] WP API returned ${posts.length} posts`);

  const events: ScrapedEventRaw[] = [];

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
// メイン処理
// ---------------------------------------------------------------------------

async function scrapeKoutairenSite(): Promise<Event[]> {
  console.log("=== Koutairen Scraper ===\n");

  const url = "https://www.doukoutairen-rikujyou.com/%E5%A4%A7%E4%BC%9A%E6%97%A5%E7%A8%8B/";
  const baseUrl = "https://www.doukoutairen-rikujyou.com/";

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
    console.error("[Koutairen] No HTML, skipping");
    return [];
  }

  const rawEvents = await parseKoutairen(html, baseUrl);
  console.log(`[koutairen] Parsed ${rawEvents.length} events`);

  return rawEvents.map((raw) => {
    const [dateStart, dateEnd] = raw.dateText.includes("~")
      ? raw.dateText.split("~")
      : [raw.dateText, undefined];
    return {
      id: generateId(raw.name, dateStart, "koutairen"),
      name: raw.name,
      date: dateStart,
      dateEnd,
      location: extractLocationFromName(raw.name),
      disciplines: [] as Discipline[],
      detailUrl: raw.detailUrl || url,
      sourceId: "koutairen",
    };
  });
}

async function runOsrkSite(): Promise<Event[]> {
  console.log("\n=== Osrk Scraper (小樽後志) ===\n");

  try {
    const rawEvents = await scrapeOsrk();
    console.log(`[osrk] Parsed ${rawEvents.length} events`);

    if (rawEvents.length === 0) {
      console.log("[osrk] 0 events, keeping existing data");
      return [];
    }

    return rawEvents.map((raw) => {
      const [dateStart, dateEnd] = raw.dateText.includes("~")
        ? raw.dateText.split("~")
        : [raw.dateText, undefined];
      return {
        id: generateId(raw.name, dateStart, "osrk"),
        name: raw.name,
        date: dateStart,
        dateEnd,
        location: extractLocationFromName(raw.name),
        disciplines: [] as Discipline[],
        detailUrl: raw.detailUrl || "https://osrk.jp/",
        sourceId: "osrk",
      };
    });
  } catch (e) {
    console.error("[osrk] Failed:", e);
    return [];
  }
}

async function main() {
  console.log("=== CF Sites Scraper (GitHub Actions) ===\n");

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。");
    process.exit(1);
  }

  const scrapedAt = new Date().toISOString();

  // koutairen (Playwright必須)
  const koutairenEvents = await scrapeKoutairenSite();
  if (koutairenEvents.length > 0) {
    console.log(`\n[DB] Upserting koutairen ${koutairenEvents.length} events...`);
    await upsertEventsToDb("koutairen", koutairenEvents, scrapedAt);
    console.log(`=== Done: koutairen ${koutairenEvents.length} events ===`);
    for (const e of koutairenEvents) {
      console.log(`  - ${e.date} ${e.name}`);
    }
  }

  // osrk (WP REST API、Playwright不要)
  const osrkEvents = await runOsrkSite();
  if (osrkEvents.length > 0) {
    console.log(`\n[DB] Upserting osrk ${osrkEvents.length} events...`);
    await upsertEventsToDb("osrk", osrkEvents, scrapedAt);
    console.log(`=== Done: osrk ${osrkEvents.length} events ===`);
    for (const e of osrkEvents) {
      console.log(`  - ${e.date} ${e.name}`);
    }
  }

  console.log("\n[Done] All sites processed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
