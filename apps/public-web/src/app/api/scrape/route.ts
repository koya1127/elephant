import { NextResponse } from "next/server";
import { scrapeEvents, downloadPdf } from "@/lib/scraper";
import { parsePdfWithClaude, parseExcelWithClaude } from "@/lib/pdfParser";
import { siteConfigs } from "@/config/sites";
import { readEvents, writeEvents } from "@/lib/storage";
import { checkAdmin } from "@/lib/admin";
import { generateId, extractLocationFromName, deduplicateCrossSite } from "@/lib/event-utils";
import type { Event, ScrapedEventRaw, ScrapeResult } from "@/lib/types";

// PDF解析は時間がかかるためタイムアウトを延長
export const maxDuration = 300; // 5分

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
    // 認証: Clerk admin or admin key（外部スクリプト用）
    const adminKey = request.headers.get("x-admin-key");
    const isKeyAuth = adminKey && adminKey === process.env.ADMIN_SECRET;
    if (!isKeyAuth) {
      const auth = await checkAdmin();
      if (!auth.ok) return auth.response;
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

    // 既存データを先に読み込む（PDF差分解析で使用）
    const existing = await readEvents();

    for (const config of configs) {
      const rawEvents = await scrapeEvents(config);

      // 既存イベントをidでMapに変換（高速検索用）
      const existingResult = existing.find(
        (e) => e.sourceId === config.id
      );
      const existingMap = new Map(
        (existingResult?.events || []).map((e) => [e.id, e])
      );

      // 基本イベント情報を先に作成
      const events: Event[] = rawEvents.map((raw) => {
        const [dateStart, dateEnd] = raw.dateText.includes("~")
          ? raw.dateText.split("~")
          : [raw.dateText, undefined];
        return {
          id: generateId(raw.name, dateStart, config.id),
          name: raw.name,
          date: dateStart,
          dateEnd,
          location: extractLocationFromName(raw.name),
          disciplines: [],
          detailUrl: raw.detailUrl || config.url,
          sourceId: config.id,
        };
      });

      // skipPdf時 or PDFなしイベント: 既存のPDF解析結果を引き継ぐ
      for (let i = 0; i < events.length; i++) {
        const prev = existingMap.get(events[i].id);
        if (prev) {
          if (prev.disciplines.length > 0) events[i].disciplines = prev.disciplines;
          if (prev.maxEntries != null) events[i].maxEntries = prev.maxEntries;
          if (prev.entryDeadline) events[i].entryDeadline = prev.entryDeadline;
          if (prev.note) events[i].note = prev.note;
          if (prev.pdfSize != null) events[i].pdfSize = prev.pdfSize;
          if (prev.location && !events[i].location) events[i].location = prev.location;
        }
      }

      // 要項解析（PDF/Excel対応、並列バッチ処理、差分解析付き）
      let skippedPdfs = 0;
      if (!skipPdf) {
        const pdfTargets = rawEvents
          .map((raw, i) => ({ raw, index: i }))
          .filter((t) => t.raw.pdfUrl);

        for (let i = 0; i < pdfTargets.length; i += PDF_CONCURRENCY) {
          const batch = pdfTargets.slice(i, i + PDF_CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(async ({ raw, index }) => {
              const fileBuffer = await downloadPdf(raw.pdfUrl!);
              const currentSize = fileBuffer.length;

              // 既存データとファイルサイズを比較
              const prev = existingMap.get(events[index].id);
              if (
                prev &&
                prev.pdfSize != null &&
                prev.pdfSize === currentSize &&
                prev.disciplines.length > 0  // disciplines空なら再解析
              ) {
                // サイズ同じ & disciplines済み → 前回の解析結果を再利用
                console.log(
                  `[Doc] Skipped (unchanged): ${raw.name}`
                );
                return { index, skipped: true as const, prev };
              }

              // サイズ違う or 新規 → Claude APIで解析
              const url = raw.pdfUrl!.toLowerCase();
              const isExcel = url.endsWith(".xlsx") || url.endsWith(".xls");
              console.log(`[Doc] Parsing (${isExcel ? "Excel" : "PDF"}): ${raw.name}`);
              const parsed = isExcel
                ? await parseExcelWithClaude(fileBuffer)
                : await parsePdfWithClaude(fileBuffer);
              return {
                index,
                skipped: false as const,
                parsed,
                pdfSize: currentSize,
              };
            })
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              const val = result.value;
              if (val.skipped) {
                // 前回の解析結果をコピー
                const { prev } = val;
                events[val.index].disciplines = prev.disciplines;
                events[val.index].maxEntries = prev.maxEntries;
                events[val.index].entryDeadline = prev.entryDeadline;
                events[val.index].note = prev.note;
                events[val.index].pdfSize = prev.pdfSize;
                if (prev.location)
                  events[val.index].location = prev.location;
                skippedPdfs++;
              } else {
                const { index, parsed, pdfSize } = val;
                if (parsed.location)
                  events[index].location = parsed.location;
                events[index].disciplines =
                  parsed.disciplines || [];
                events[index].maxEntries = parsed.maxEntries;
                events[index].entryDeadline = parsed.entryDeadline;
                events[index].note = parsed.note;
                events[index].pdfSize = pdfSize;
              }
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
        skippedPdfs,
      } as ScrapeResult & { skippedPdfs: number });
    }

    // 全ソース間クロスサイト重複除去・マージ
    deduplicateCrossSite(allResults, existing);

    // 同じsourceIdのデータを更新（0件の場合は既存データを保持）
    for (const result of allResults) {
      if (result.events.length === 0) {
        console.log(`[Skip] ${result.sourceId}: 0 events scraped, keeping existing data`);
        continue;
      }
      const idx = existing.findIndex((e) => e.sourceId === result.sourceId);
      if (idx >= 0) {
        existing[idx] = result;
      } else {
        existing.push(result);
      }
    }

    await writeEvents(existing);

    const totalEvents = allResults.reduce(
      (sum, r) => sum + r.events.length,
      0
    );
    const totalSkipped = allResults.reduce(
      (sum, r) => sum + ((r as ScrapeResult & { skippedPdfs: number }).skippedPdfs || 0),
      0
    );

    return NextResponse.json({
      success: true,
      message: `${totalEvents} events scraped from ${configs.length} site(s), ${totalSkipped} PDFs skipped (unchanged)`,
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
    const results = await readEvents();
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}

