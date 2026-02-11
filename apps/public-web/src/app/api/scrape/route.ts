import { NextResponse } from "next/server";
import { scrapeEvents, downloadPdf } from "@/lib/scraper";
import { parsePdfWithClaude } from "@/lib/pdfParser";
import { siteConfigs } from "@/config/sites";
import type { Event, ScrapedEventRaw, ScrapeResult } from "@/lib/types";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

// PDF解析は時間がかかるためタイムアウトを延長
export const maxDuration = 300; // 5分

// Vercelではcwd()への書き込み不可 → /tmp を使用
const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

const PDF_CONCURRENCY = 3; // 同時にPDF解析するリクエスト数

/**
 * POST /api/scrape
 * スクレイピングを実行してevents.jsonに保存する
 *
 * Query params:
 *   ?siteId=sorachi  — 特定サイトのみ実行（省略時は全サイト）
 *   ?skipPdf=true    — PDF解析をスキップ（HTMLのみ取得）
 */
export async function POST(request: Request) {
  try {
    // 管理者キー認証（POSTはコストがかかるため保護）
    const adminKey = request.headers.get("x-admin-key");
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetSiteId = searchParams.get("siteId");
    const skipPdf = searchParams.get("skipPdf") === "true";

    const configs = targetSiteId
      ? siteConfigs.filter((c) => c.id === targetSiteId)
      : siteConfigs;

    if (configs.length === 0) {
      return NextResponse.json(
        { error: `Site not found: ${targetSiteId}` },
        { status: 404 }
      );
    }

    const allResults: ScrapeResult[] = [];

    for (const config of configs) {
      const rawEvents = await scrapeEvents(config);

      // 基本イベント情報を先に作成
      const events: Event[] = rawEvents.map((raw) => {
        const [dateStart, dateEnd] = raw.dateText.includes("~")
          ? raw.dateText.split("~")
          : [raw.dateText, undefined];
        return {
          id: generateId(raw.name, dateStart),
          name: raw.name,
          date: dateStart,
          dateEnd,
          location: extractLocationFromName(raw.name),
          disciplines: [],
          detailUrl: raw.detailUrl || config.url,
          sourceId: config.id,
        };
      });

      // PDF解析（並列バッチ処理）
      if (!skipPdf) {
        const pdfTargets = rawEvents
          .map((raw, i) => ({ raw, index: i }))
          .filter((t) => t.raw.pdfUrl);

        for (let i = 0; i < pdfTargets.length; i += PDF_CONCURRENCY) {
          const batch = pdfTargets.slice(i, i + PDF_CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(async ({ raw, index }) => {
              console.log(`[PDF] Parsing: ${raw.name}`);
              const pdfBuffer = await downloadPdf(raw.pdfUrl!);
              const parsed = await parsePdfWithClaude(pdfBuffer);
              return { index, parsed };
            })
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              const { index, parsed } = result.value;
              if (parsed.location) events[index].location = parsed.location;
              events[index].disciplines = parsed.disciplines || [];
              events[index].maxEntries = parsed.maxEntries;
              events[index].entryDeadline = parsed.entryDeadline;
              events[index].note = parsed.note;
            } else {
              console.error(`[PDF] Error:`, result.reason);
            }
          }
        }
      }

      allResults.push({
        sourceId: config.id,
        scrapedAt: new Date().toISOString(),
        events,
      });
    }

    // ファイルに保存
    await mkdir(DATA_DIR, { recursive: true });

    // 既存データを読み込んでマージ
    let existing: ScrapeResult[] = [];
    try {
      const data = await readFile(EVENTS_FILE, "utf-8");
      existing = JSON.parse(data);
    } catch {
      // ファイルが存在しない場合は空配列
    }

    // 同じsourceIdのデータを更新
    for (const result of allResults) {
      const idx = existing.findIndex((e) => e.sourceId === result.sourceId);
      if (idx >= 0) {
        existing[idx] = result;
      } else {
        existing.push(result);
      }
    }

    await writeFile(EVENTS_FILE, JSON.stringify(existing, null, 2), "utf-8");

    const totalEvents = allResults.reduce(
      (sum, r) => sum + r.events.length,
      0
    );

    return NextResponse.json({
      success: true,
      message: `${totalEvents} events scraped from ${configs.length} site(s)`,
      results: allResults,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scrape
 * 保存済みのevents.jsonを返す
 */
export async function GET() {
  try {
    const data = await readFile(EVENTS_FILE, "utf-8");
    const results: ScrapeResult[] = JSON.parse(data);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}

function generateId(name: string, date: string): string {
  const slug = name
    .replace(/[^\w\u3000-\u9FFF]/g, "")
    .slice(0, 20);
  return `${date}-${slug}`;
}

function extractLocationFromName(name: string): string {
  // 大会名末尾の場所名を抽出（例: "空知陸上競技記録会 第1戦　深川" → "深川"）
  const match = name.match(/[　\s]+([^\s　]+)$/);
  return match ? match[1] : "";
}
