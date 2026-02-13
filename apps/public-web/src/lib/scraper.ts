import * as cheerio from "cheerio";
import type { SiteConfig, ScrapedEventRaw } from "./types";

/**
 * 指定サイトのHTMLを取得してイベント一覧を抽出する
 */
export async function scrapeEvents(
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const html = await fetchHtml(config.url, config.encoding);
  return parseEventsFromHtml(html, config);
}

/**
 * HTMLを取得（エンコーディング対応）
 */
async function fetchHtml(url: string, encoding?: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder(encoding || "utf-8");
  return decoder.decode(buffer);
}

/**
 * パーサータイプに応じてHTMLからイベント一覧を抽出
 */
function parseEventsFromHtml(
  html: string,
  config: SiteConfig
): ScrapedEventRaw[] {
  switch (config.parser) {
    case "sorachi":
      return parseSorachi(html, config);
    case "kushiro":
      return parseKushiro(html, config);
    default:
      throw new Error(`Unknown parser type: ${config.parser}`);
  }
}

/**
 * URLから年を推定する（例: /event/2025/ → 2025）
 * 見つからなければ現在の年を返す
 */
function detectYear(url: string): string {
  const match = url.match(/\/(\d{4})\//);
  return match ? match[1] : new Date().getFullYear().toString();
}

/**
 * PDFリンクを抽出するヘルパー
 */
function extractPdfLinks(pdfHtml: string, baseUrl: string): string[] {
  const pdfLinks: string[] = [];
  const $ = cheerio.load(pdfHtml);
  $("a").each((_k, a) => {
    const href = $(a).attr("href");
    if (href && href.endsWith(".pdf")) {
      const absoluteUrl = href.startsWith("http")
        ? href
        : new URL(href, baseUrl).toString();
      pdfLinks.push(absoluteUrl);
    }
  });
  return pdfLinks;
}

// ──────────────────────────────────────────
// 空知陸協パーサー
// テーブル構造:
//   列0: 月（rowspan で複数行にまたがる）
//   列1: 日
//   列2: 曜日
//   列3: 大会名
//   列4: 大会要項（PDFリンク）
//   列5: 参加申込書
// ──────────────────────────────────────────
function parseSorachi(html: string, config: SiteConfig): ScrapedEventRaw[] {
  const $ = cheerio.load(html);
  const events: ScrapedEventRaw[] = [];
  const rows = $("table tr");
  const year = detectYear(config.url);

  let currentMonth = "";

  rows.each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length === 0) return;

    const cellTexts: { text: string; html: string }[] = [];
    cells.each((_j, cell) => {
      cellTexts.push({
        text: $(cell).text().trim(),
        html: $(cell).html() || "",
      });
    });

    // 列数で月カラムの有無を判定
    // 6列 = 月あり、5列 = 月なし（前の月を引き継ぎ）
    let day: string;
    let eventName: string;
    let pdfHtml: string;

    if (cellTexts.length >= 6) {
      const monthText = cellTexts[0].text.replace(/\s/g, "");
      if (monthText && /^\d+$/.test(monthText)) {
        currentMonth = monthText;
      }
      day = cellTexts[1].text.replace(/\s/g, "");
      eventName = cellTexts[3].text.replace(/\s+/g, " ").trim();
      pdfHtml = cellTexts[4].html;
    } else if (cellTexts.length >= 5) {
      day = cellTexts[0].text.replace(/\s/g, "");
      eventName = cellTexts[2].text.replace(/\s+/g, " ").trim();
      pdfHtml = cellTexts[3].html;
    } else {
      return;
    }

    if (!currentMonth || !day || !/\d/.test(day)) return;
    if (eventName === "大会名" || eventName === "") return;

    const pdfLinks = extractPdfLinks(pdfHtml, config.baseUrl);

    // 日付範囲の処理（例: "20〜22" → "20"）
    const dayMatch = day.match(/(\d+)/);
    const dayNum = dayMatch ? dayMatch[1] : day;
    const dayEndMatch = day.match(/[〜~ー](\d+)/);

    const dateText = `${year}-${currentMonth.padStart(2, "0")}-${dayNum.padStart(2, "0")}`;
    const dateEndText = dayEndMatch
      ? `${year}-${currentMonth.padStart(2, "0")}-${dayEndMatch[1].padStart(2, "0")}`
      : undefined;

    events.push({
      name: eventName,
      dateText: dateEndText ? `${dateText}~${dateEndText}` : dateText,
      pdfUrl: pdfLinks[0],
      detailUrl: pdfLinks[0] || config.url,
    });
  });

  return events;
}

// ──────────────────────────────────────────
// 釧路地方陸協パーサー
// テーブル構造（4列）:
//   列0: 日付 <th>（例: ４月2６日（土）, ５月２２日（木）～\n24日（土））
//   列1: 大会名 <td>
//   列2: 要項PDF <td>（div.sp-button内のリンク）
//   列3: 日程関係 <td>（タイムテーブル等）
// ──────────────────────────────────────────
function parseKushiro(html: string, config: SiteConfig): ScrapedEventRaw[] {
  const $ = cheerio.load(html);
  const events: ScrapedEventRaw[] = [];
  const rows = $(config.selectors.eventRow);

  // URLから年を推定（r7 = 令和7年 = 2025）
  const year = detectYearFromKushiroUrl(config.url);

  rows.each((_i, row) => {
    // 日付は<th>に入っている
    const dateTh = $(row).find("th.col-title").first();
    const cells = $(row).find("td");
    if (!dateTh.length || cells.length < 1) return;

    const dateCell = dateTh.text().trim();
    const eventName = $(cells[0]).text().replace(/\s+/g, " ").trim();
    // 要項列（2列目のtd = index 1）のHTMLからPDFリンクを抽出
    const pdfHtml = cells.length >= 2 ? $(cells[1]).html() || "" : "";

    if (!dateCell || !eventName) return;

    // 日本語日付をパース（例: ４月2６日（土）→ 2025-04-26）
    const parsed = parseJapaneseDate(dateCell, year);
    if (!parsed) return;

    const pdfLinks = extractPdfLinks(pdfHtml, config.baseUrl);

    events.push({
      name: eventName,
      dateText: parsed.dateEnd
        ? `${parsed.dateStart}~${parsed.dateEnd}`
        : parsed.dateStart,
      pdfUrl: pdfLinks[0],
      detailUrl: pdfLinks[0] || config.url,
    });
  });

  return events;
}

/**
 * 釧路サイトのURLから年を推定
 * r7 = 令和7年 = 2025, r8 = 2026, etc.
 */
function detectYearFromKushiroUrl(url: string): string {
  const match = url.match(/r(\d+)/i);
  if (match) {
    const reiwa = parseInt(match[1], 10);
    return (2018 + reiwa).toString(); // 令和1年 = 2019, 基準は2018
  }
  return new Date().getFullYear().toString();
}

/**
 * 日本語日付文字列をパース
 * 全角数字・半角数字混在に対応
 * 例: "４月2６日（土）" → { dateStart: "2025-04-26" }
 * 例: "5月22日（木）～24日（土）" → { dateStart: "2025-05-22", dateEnd: "2025-05-24" }
 */
function parseJapaneseDate(
  text: string,
  year: string
): { dateStart: string; dateEnd?: string } | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  // 月と日を抽出
  const mainMatch = normalized.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!mainMatch) return null;

  const month = mainMatch[1].padStart(2, "0");
  const day = mainMatch[2].padStart(2, "0");
  const dateStart = `${year}-${month}-${day}`;

  // 範囲の終了日を抽出（～24日 or 〜24日）
  const rangeMatch = normalized.match(/[～〜~]\s*(\d{1,2})日/);
  if (rangeMatch) {
    const dayEnd = rangeMatch[1].padStart(2, "0");
    return { dateStart, dateEnd: `${year}-${month}-${dayEnd}` };
  }

  return { dateStart };
}

/**
 * PDFをダウンロードしてバイナリデータを返す
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download PDF: ${res.status} ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
