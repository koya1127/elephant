import { NextResponse } from "next/server";
import { scrapeEvents, downloadPdf } from "@/lib/scraper";
import { parsePdfWithClaude, parseExcelWithClaude } from "@/lib/pdfParser";
import { siteConfigs } from "@/config/sites";
import { readEvents, writeEvents } from "@/lib/storage";
import { checkAdmin } from "@/lib/admin";
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
    .replace(/[Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/^20\d{2}/, ""); // 先頭の年号を除去（「2025苫小牧記録会」→「苫小牧記録会」）
}

/**
 * 全ソース間クロスサイト重複除去・マージ
 * 同じ日付で名前が類似するイベントを検出し、情報の多い方を残して補完する
 */
function deduplicateCrossSite(
  allResults: ScrapeResult[],
  existingResults: ScrapeResult[]
): void {
  type EventEntry = {
    event: Event;
    result: ScrapeResult;
    index: number;
    removed: boolean;
  };

  // 全イベントをフラット化（source参照付き）
  const allEvents: EventEntry[] = [];
  for (const result of [...allResults, ...existingResults]) {
    for (let i = 0; i < result.events.length; i++) {
      allEvents.push({ event: result.events[i], result, index: i, removed: false });
    }
  }

  // 日付でグループ化
  const byDate = new Map<string, EventEntry[]>();
  for (const entry of allEvents) {
    const group = byDate.get(entry.event.date) || [];
    group.push(entry);
    byDate.set(entry.event.date, group);
  }

  let totalRemoved = 0;

  // 各日付グループ内で異なるsourceId間の重複を検出
  for (const [, group] of byDate) {
    for (let i = 0; i < group.length; i++) {
      if (group[i].removed) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (group[j].removed) continue;
        if (group[i].event.sourceId === group[j].event.sourceId) continue;

        const a = group[i], b = group[j];
        if (!isDuplicate(a.event, b.event)) continue;

        // 重複検出 → 情報の多い方を残し、少ない方を除去
        const [keeper, loser] = pickKeeper(a, b);
        mergeEventInfo(keeper.event, loser.event);
        loser.removed = true;
        totalRemoved++;
        console.log(
          `[Dedup] Merged: "${loser.event.name}" (${loser.event.sourceId}) → "${keeper.event.name}" (${keeper.event.sourceId})`
        );
      }
    }
  }

  if (totalRemoved > 0) {
    console.log(`[Dedup] Removed ${totalRemoved} cross-site duplicate events`);
  }

  // removedフラグが立ったイベントのインデックスをresultごとに集約
  const removedIndices = new Map<ScrapeResult, Set<number>>();
  for (const entry of allEvents) {
    if (!entry.removed) continue;
    let s = removedIndices.get(entry.result);
    if (!s) {
      s = new Set();
      removedIndices.set(entry.result, s);
    }
    s.add(entry.index);
  }

  // 除去対象を各resultから削除
  for (const [result, indices] of removedIndices) {
    result.events = result.events.filter((_, i) => !indices.has(i));
  }
}

/**
 * 2つのイベントが重複しているか判定する
 */
function isDuplicate(a: Event, b: Event): boolean {
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);

  // 条件1: 名前の包含チェック
  // 短い名前（10文字未満）が長い名前に包含されるケースは誤検知が多い
  // 例: 「記録会第2戦」が「空知陸上競技記録会第2戦」に包含 → 別地域なので除外すべき
  // 短い方が10文字以上、かつ長い方との長さ比が50%以上の場合のみ重複とみなす
  const shorter = nameA.length <= nameB.length ? nameA : nameB;
  const longer = nameA.length <= nameB.length ? nameB : nameA;
  if (longer.includes(shorter) && shorter.length >= 10 &&
      shorter.length / longer.length >= 0.5) return true;

  // 条件2: 同じ場所 + 部分名前一致（先頭6文字）
  if (
    a.location && b.location &&
    a.location === b.location &&
    nameA.length >= 6 && nameB.length >= 6 &&
    nameA.substring(0, 6) === nameB.substring(0, 6)
  ) return true;

  // 条件3: 片方のlocationがもう片方のnameに含まれる + 部分名前一致（先頭6文字）
  if (a.location && nameB.includes(normalizeName(a.location)) &&
      nameA.length >= 6 && nameB.length >= 6 &&
      nameA.substring(0, 6) === nameB.substring(0, 6)) return true;
  if (b.location && nameA.includes(normalizeName(b.location)) &&
      nameA.length >= 6 && nameB.length >= 6 &&
      nameA.substring(0, 6) === nameB.substring(0, 6)) return true;

  // 条件4: 末尾の場所を除去 + コネクタ正規化して比較
  // 「第77回函館市中学校陸上競技大会兼第74回渡島中学校陸上競技大会　千代台」vs
  // 「第77回函館市中学校陸上競技大会・第74回渡島中学校陸上競技大会」→ 一致
  const coreA = normalizeForDedup(a.name.replace(/[\s\u3000]+[^\s\u3000]+$/, ""));
  const coreB = normalizeForDedup(b.name.replace(/[\s\u3000]+[^\s\u3000]+$/, ""));
  if (coreA.length >= 8 && coreB.length >= 8) {
    const coreShorter = coreA.length <= coreB.length ? coreA : coreB;
    const coreLonger = coreA.length <= coreB.length ? coreB : coreA;
    if (coreLonger.includes(coreShorter) &&
        coreShorter.length / coreLonger.length >= 0.5) return true;
  }

  // 条件5: 長い共通プレフィックス（同じ大会名 + 異なる場所表記）
  // 「道北記録会第3戦花咲スポーツ公園(陸)」vs「道北記録会第3戦旭川」→ prefix 80%
  let prefixLen = 0;
  while (prefixLen < nameA.length && prefixLen < nameB.length &&
         nameA[prefixLen] === nameB[prefixLen]) prefixLen++;
  const shorterLen = Math.min(nameA.length, nameB.length);
  if (prefixLen >= 8 && prefixLen / shorterLen >= 0.7) return true;

  // 条件6: 地域名による短縮名マッチ
  // muroriku「記録会第2戦」vs hokkaido「室蘭地方陸上競技記録会第2戦」のように
  // 短い名前が相手に包含され、かつ相手の名前にこちらの地域名が含まれていれば重複
  const regionA = REGION_KEYWORDS[a.sourceId];
  const regionB = REGION_KEYWORDS[b.sourceId];
  if (shorter.length >= 5 && longer.includes(shorter)) {
    // 短い方のsourceIdの地域名が、長い方の名前に含まれているか
    const shorterRegion = nameA.length <= nameB.length ? regionA : regionB;
    if (shorterRegion && shorterRegion.some((kw) => longer.includes(kw))) return true;
  }

  return false;
}

/**
 * siteConfigsのnameから地域キーワードを自動生成
 * 「室蘭地方陸上競技協会」→「室蘭」、「小樽後志陸上競技協会」→「小樽後志」
 * hokkaido/runnet等の全国系サイトは除外（地域名なし）
 */
const REGION_KEYWORDS: Record<string, string[] | undefined> = Object.fromEntries(
  siteConfigs
    .filter((c) => !["hokkaido", "runnet", "chuutairen", "koutairen", "gakuren", "masters"].includes(c.id))
    .map((c) => {
      // 「室蘭地方陸上競技協会」→「室蘭」、「小樽後志陸上競技協会」→「小樽後志」
      const region = c.name.replace(/(地方|陸上|陸協).*$/, "").trim();
      return [c.id, region ? [region] : undefined];
    })
    .filter(([, v]) => v)
);

/**
 * 重複判定用の深い正規化（コネクタ文字を除去）
 */
function normalizeForDedup(name: string): string {
  return normalizeName(name)
    .replace(/[兼・\/／]/g, "");
}

/**
 * 情報の多い方をkeeper、少ない方をloserとして返す
 */
function pickKeeper(
  a: { event: Event; result: ScrapeResult; index: number; removed: boolean },
  b: { event: Event; result: ScrapeResult; index: number; removed: boolean }
): [typeof a, typeof b] {
  const scoreA = (a.event.disciplines.length * 10) +
    (a.event.location ? 3 : 0) + (a.event.pdfSize ? 1 : 0);
  const scoreB = (b.event.disciplines.length * 10) +
    (b.event.location ? 3 : 0) + (b.event.pdfSize ? 1 : 0);
  return scoreA >= scoreB ? [a, b] : [b, a];
}

/**
 * loserの情報でkeeperの欠けているフィールドを補完する
 */
function mergeEventInfo(keeper: Event, loser: Event): void {
  if (!keeper.location && loser.location) keeper.location = loser.location;
  if (keeper.disciplines.length === 0 && loser.disciplines.length > 0)
    keeper.disciplines = loser.disciplines;
  if (!keeper.entryDeadline && loser.entryDeadline)
    keeper.entryDeadline = loser.entryDeadline;
  if (!keeper.pdfSize && loser.pdfSize) keeper.pdfSize = loser.pdfSize;
  if (!keeper.note && loser.note) keeper.note = loser.note;
}
