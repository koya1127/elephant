import { siteConfigs } from "@/config/sites";
import { toHalfWidthAll } from "./text-utils";
import type { Discipline, Event, ScrapeResult } from "./types";

export function generateId(name: string, date: string, sourceId: string): string {
  const slug = name
    .replace(/[^\w\u3000-\u9FFF]/g, "")
    .slice(0, 30);
  return `${sourceId}-${date}-${slug}`;
}

export function extractLocationFromName(name: string): string {
  // 大会名末尾の場所名を抽出（例: "空知陸上競技記録会 第1戦　深川" → "深川"）
  const match = name.match(/[　\s]+([^\s　]+)$/);
  return match ? match[1] : "";
}

/** スペース除去 + 全角英数→半角 */
function normalizeBase(name: string): string {
  return toHalfWidthAll(name.replace(/[\s\u3000]+/g, ""));
}

/**
 * 名前正規化（スペース・全角英数を統一して比較しやすくする）
 */
export function normalizeName(name: string): string {
  return normalizeBase(name)
    .replace(/^20\d{2}/, ""); // 先頭の年号を除去（「2025苫小牧記録会」→「苫小牧記録会」）
}

/**
 * 過去大会マッチング用の正規化（回次・年度・兼以降を除去）
 */
export function normalizeForHistoricalMatch(name: string): string {
  return normalizeBase(name)
    .replace(/20\d{2}年?/g, "")
    .replace(/第\d+回/g, "")
    .replace(/令和[一二三四五六七八九十\d]+年度?/g, "")
    .replace(/\n/g, "")
    .replace(/兼.*$/, "");
}

/**
 * 過去の同名大会から種目を取得する（同一ソース内のみ）
 * disciplinesが空のイベントに対し、異なる年の同名大会のdisciplinesを返す
 */
export function findHistoricalDisciplines(
  event: Event,
  allEvents: Event[]
): Discipline[] | null {
  if (event.disciplines.length > 0) return null;

  const eventYear = event.date.slice(0, 4);
  const normalized = normalizeForHistoricalMatch(event.name);
  if (normalized.length < 3) return null;

  // 同一sourceId、異なる年、disciplines有りのイベントを候補に
  const candidates = allEvents.filter(
    (e) =>
      e.sourceId === event.sourceId &&
      e.date.slice(0, 4) !== eventYear &&
      e.disciplines.length > 0 &&
      normalizeForHistoricalMatch(e.name) === normalized
  );

  if (candidates.length === 0) return null;

  // 最新年のものを返す
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0].disciplines;
}

/**
 * 全ソース間クロスサイト重複除去・マージ
 * 同じ日付で名前が類似するイベントを検出し、情報の多い方を残して補完する
 */
export function deduplicateCrossSite(
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

  // 各日付グループ内で重複を検出（同一ソース含む）
  for (const [, group] of byDate) {
    for (let i = 0; i < group.length; i++) {
      if (group[i].removed) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (group[j].removed) continue;

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
    console.log(`[Dedup] Removed ${totalRemoved} duplicate events`);
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
export function isDuplicate(a: Event, b: Event): boolean {
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);

  // 条件1: 名前の包含チェック
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
  const coreA = normalizeForDedup(a.name.replace(/[\s\u3000]+[^\s\u3000]+$/, ""));
  const coreB = normalizeForDedup(b.name.replace(/[\s\u3000]+[^\s\u3000]+$/, ""));
  if (coreA.length >= 8 && coreB.length >= 8) {
    const coreShorter = coreA.length <= coreB.length ? coreA : coreB;
    const coreLonger = coreA.length <= coreB.length ? coreB : coreA;
    if (coreLonger.includes(coreShorter) &&
        coreShorter.length / coreLonger.length >= 0.5) return true;
  }

  // 条件5: 長い共通プレフィックス（同じ大会名 + 異なる場所表記）
  let prefixLen = 0;
  while (prefixLen < nameA.length && prefixLen < nameB.length &&
         nameA[prefixLen] === nameB[prefixLen]) prefixLen++;
  const shorterLen = Math.min(nameA.length, nameB.length);
  if (prefixLen >= 8 && prefixLen / shorterLen >= 0.7) return true;

  // 条件6: 地域名による短縮名マッチ
  if (shorter.length >= 5 && longer.includes(shorter)) {
    const shorterRegion = nameA.length <= nameB.length
      ? REGION_KEYWORDS[a.sourceId]
      : REGION_KEYWORDS[b.sourceId];
    if (shorterRegion && shorterRegion.some((kw) => longer.includes(kw))) return true;
  }

  return false;
}

/**
 * siteConfigsのnameから地域キーワードを自動生成
 */
export const REGION_KEYWORDS: Record<string, string[] | undefined> = Object.fromEntries(
  siteConfigs
    .filter((c) => !["hokkaido", "runnet", "chuutairen", "koutairen", "gakuren", "masters"].includes(c.id))
    .map((c) => {
      const region = c.name.replace(/(地方|陸上|陸協).*$/, "").trim();
      return [c.id, region ? [region] : undefined];
    })
    .filter(([, v]) => v)
);

/**
 * 重複判定用の深い正規化（コネクタ文字を除去）
 */
export function normalizeForDedup(name: string): string {
  return normalizeName(name)
    .replace(/[兼・\/／]/g, "");
}

/**
 * 情報の多い方をkeeper、少ない方をloserとして返す
 */
export function pickKeeper<T extends { event: Event }>(a: T, b: T): [T, T] {
  const scoreA = (a.event.disciplines.length * 10) +
    (a.event.location ? 3 : 0) + (a.event.pdfSize ? 1 : 0);
  const scoreB = (b.event.disciplines.length * 10) +
    (b.event.location ? 3 : 0) + (b.event.pdfSize ? 1 : 0);
  return scoreA >= scoreB ? [a, b] : [b, a];
}

/**
 * loserの情報でkeeperの欠けているフィールドを補完する
 */
export function mergeEventInfo(keeper: Event, loser: Event): void {
  if (!keeper.location && loser.location) keeper.location = loser.location;
  if (keeper.disciplines.length === 0 && loser.disciplines.length > 0)
    keeper.disciplines = loser.disciplines;
  if (!keeper.entryDeadline && loser.entryDeadline)
    keeper.entryDeadline = loser.entryDeadline;
  if (!keeper.pdfSize && loser.pdfSize) keeper.pdfSize = loser.pdfSize;
  if (!keeper.note && loser.note) keeper.note = loser.note;
  if (keeper.fee == null && loser.fee != null) {
    keeper.fee = loser.fee;
    keeper.feeSource = loser.feeSource;
  }
  if (keeper.actualFee == null && loser.actualFee != null)
    keeper.actualFee = loser.actualFee;
}
