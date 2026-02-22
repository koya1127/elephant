/**
 * ローカル実行用: tomakomai（苫小牧陸上競技協会）のスクレイピング
 *
 * JimdoサイトがVercelのIPをブロックするため、ローカルPCでのみ実行可能。
 * curl でHTML取得 → cheerioでパース → Postgres DBにupsert
 *
 * 実行: pnpm scrape:tomakomai
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   POSTGRES_URL
 *   ANTHROPIC_API_KEY（PDF解析用、任意）
 */

import { execSync } from "child_process";
import * as cheerio from "cheerio";
import { loadEnv, upsertEventsToDb, type Event } from "./lib/db";
import { parsePdfWithClaude } from "../apps/public-web/src/lib/pdfParser";
import { downloadPdf } from "../apps/public-web/src/lib/scraper";

loadEnv();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapedEventRaw {
  name: string;
  dateText: string;
  detailUrl?: string;
  pdfUrl?: string;
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

  const toHalf = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

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

    // PDFリンク: 後続兄弟（j-hgrid含む）から .j-imageSubtitle を探す
    let pdfUrl: string | undefined;
    let sibling = block.next();
    for (let i = 0; i < 8 && sibling.length; i++) {
      if (sibling.hasClass("j-hgrid")) {
        const hasEventName = sibling.find("b, span, strong").toArray().some((tag) => {
          const s = $(tag).attr("style") || "";
          return s.includes("font-size") && s.includes("22");
        });
        if (hasEventName) break;
      }
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

    // Google Drive /view URL → 直接DL URLに変換
    if (pdfUrl) {
      const gdMatch = pdfUrl.match(/drive\.google\.com\/file\/d\/([^/]+)\//);
      if (gdMatch) {
        pdfUrl = `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
      }
    }

    const isPdfUrl = pdfUrl?.endsWith(".pdf") || pdfUrl?.includes("export=download");
    events.push({
      name,
      dateText: dateStr,
      pdfUrl: isPdfUrl ? pdfUrl : undefined,
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

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。.env.local を確認してください。");
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

  const events: (Event & { pdfUrl?: string })[] = rawEvents.map((raw) => {
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

  // 3. PDF解析（pdfUrlがあれば Claude API で種目抽出）
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("\n[PDF] Parsing disciplines from PDFs...");
    const pdfEvents = events.filter((e) => e.pdfUrl);
    console.log(`[PDF] ${pdfEvents.length} events have PDF URLs`);

    const chunkSize = 3;
    for (let i = 0; i < pdfEvents.length; i += chunkSize) {
      const chunk = pdfEvents.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (event) => {
          try {
            console.log(`[PDF] Parsing: ${event.name}`);
            const buf = await downloadPdf(event.pdfUrl!);
            const result = await parsePdfWithClaude(buf);
            event.disciplines = result.disciplines;
            if (result.disciplines.length > 0) {
              console.log(`  → ${result.disciplines.map((d) => d.name).join(", ")}`);
            } else {
              console.log(`  → 種目なし`);
            }
          } catch (err) {
            console.warn(`  → 解析失敗: ${event.name}`, err);
          }
        })
      );
    }
  } else {
    console.warn("[PDF] ANTHROPIC_API_KEY 未設定。種目解析をスキップ。");
  }

  // 4. DB upsert
  const scrapedAt = new Date().toISOString();
  console.log("\n[DB] Upserting events...");
  await upsertEventsToDb("tomakomai", events, scrapedAt);

  console.log(`\n=== Done: tomakomai ${events.length} events ===`);
  for (const e of events) {
    console.log(`  - ${e.date} ${e.name}${e.pdfUrl ? " [PDF]" : ""}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
