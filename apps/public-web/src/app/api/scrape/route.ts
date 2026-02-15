import { NextResponse } from "next/server";
import { scrapeEvents, downloadPdf } from "@/lib/scraper";
import { parsePdfWithClaude, parseExcelWithClaude } from "@/lib/pdfParser";
import { siteConfigs } from "@/config/sites";
import { readEvents, writeEvents } from "@/lib/storage";
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
                prev.pdfSize === currentSize
              ) {
                // サイズ同じ → 前回の解析結果を再利用
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

    // クロスサイト重複除去（北海道全競技会日程 vs 地域サイト）
    // 地域サイトの方が要項PDF等の詳細があるため優先
    deduplicateHokkaidoEvents(allResults, existing);

    // 同じsourceIdのデータを更新
    for (const result of allResults) {
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

function generateId(name: string, date: string, sourceId: string): string {
  const slug = name
    .replace(/[^\w\u3000-\u9FFF]/g, "")
    .slice(0, 30);
  return `${sourceId}-${date}-${slug}`;
}

function extractLocationFromName(name: string): string {
  // 大会名末尾の場所名を抽出（例: "空知陸上競技記録会 第1戦　深川" → "深川"）
  const match = name.match(/[　\s]+([^\s　]+)$/);
  return match ? match[1] : "";
}

/**
 * 名前正規化（スペース・全角英数を統一して比較しやすくする）
 */
function normalizeName(name: string): string {
  return name
    .replace(/[\s\u3000]+/g, "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 北海道全競技会日程のイベントから、他サイトと重複するものを除外する
 * 地域サイト（空知・釧路・札幌・道央）は要項PDF等の詳細を持つため優先
 */
function deduplicateHokkaidoEvents(
  allResults: ScrapeResult[],
  existingResults: ScrapeResult[]
): void {
  const hokkaidoResult = allResults.find((r) => r.sourceId === "hokkaido");
  if (!hokkaidoResult) return;

  // 他サイトのイベントを集約（今回のスクレイプ結果 + 既存データ）
  const otherEvents: Array<{ date: string; name: string }> = [];
  for (const result of [...allResults, ...existingResults]) {
    if (result.sourceId === "hokkaido") continue;
    for (const event of result.events) {
      otherEvents.push({ date: event.date, name: normalizeName(event.name) });
    }
  }

  const before = hokkaidoResult.events.length;
  hokkaidoResult.events = hokkaidoResult.events.filter((hEvent) => {
    const hDate = hEvent.date;
    const hName = normalizeName(hEvent.name);
    // 同じ日付で名前が類似するイベントが他サイトにあれば除外
    const isDupe = otherEvents.some((other) => {
      if (other.date !== hDate) return false;
      // 先頭6文字の部分一致で判定（"第XX回"等のプレフィックスを含めて比較）
      if (hName.length < 6 || other.name.length < 6) {
        return hName === other.name;
      }
      return hName.includes(other.name.substring(0, 6)) ||
        other.name.includes(hName.substring(0, 6));
    });
    return !isDupe;
  });

  const removed = before - hokkaidoResult.events.length;
  if (removed > 0) {
    console.log(`[Dedup] Removed ${removed} duplicate events from hokkaido (${before} → ${hokkaidoResult.events.length})`);
  }
}
