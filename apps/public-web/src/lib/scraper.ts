import * as cheerio from "cheerio";
import type { SiteConfig, ScrapedEventRaw } from "./types";

/**
 * 指定サイトのHTMLを取得してイベント一覧を抽出する
 */
export async function scrapeEvents(
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const html = await fetchHtml(config.url);
  return parseEventsFromHtml(html, config);
}

/**
 * HTMLを取得（Shift_JIS対応）
 */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();

  // Shift_JIS → UTF-8 変換
  const decoder = new TextDecoder("shift_jis");
  return decoder.decode(buffer);
}

/**
 * HTMLテーブルからイベント一覧を抽出
 * 空知陸協サイトのテーブル構造:
 *   列0: 月（rowspan で複数行にまたがる）
 *   列1: 日
 *   列2: 曜日
 *   列3: 大会名
 *   列4: 大会要項（PDFリンク）
 *   列5: 参加申込書
 */
function parseEventsFromHtml(
  html: string,
  config: SiteConfig
): ScrapedEventRaw[] {
  const $ = cheerio.load(html);
  const events: ScrapedEventRaw[] = [];
  const rows = $("table tr");

  let currentMonth = "";

  rows.each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length === 0) return; // ヘッダー行スキップ

    // rowspanがある月セルか、月セルがない（前の月を継続）かを判定
    let cellIndex = 0;
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
      // 月カラムあり
      const monthText = cellTexts[0].text.replace(/\s/g, "");
      if (monthText && /^\d+$/.test(monthText)) {
        currentMonth = monthText;
      }
      day = cellTexts[1].text.replace(/\s/g, "");
      eventName = cellTexts[3].text.replace(/\s+/g, " ").trim();
      pdfHtml = cellTexts[4].html;
    } else if (cellTexts.length >= 5) {
      // 月カラムなし（rowspanで省略）
      day = cellTexts[0].text.replace(/\s/g, "");
      eventName = cellTexts[2].text.replace(/\s+/g, " ").trim();
      pdfHtml = cellTexts[3].html;
    } else {
      return; // 不明な行はスキップ
    }

    // ヘッダー行スキップ（「月」「日」などのテキスト）
    if (!currentMonth || !day || !/\d/.test(day)) return;
    if (eventName === "大会名" || eventName === "") return;

    // PDFリンク抽出
    const pdfLinks: string[] = [];
    const $pdfCell = cheerio.load(pdfHtml);
    $pdfCell("a").each((_k, a) => {
      const href = $pdfCell(a).attr("href");
      if (href && href.endsWith(".pdf")) {
        const absoluteUrl = href.startsWith("http")
          ? href
          : new URL(href, config.baseUrl).toString();
        pdfLinks.push(absoluteUrl);
      }
    });

    // 日付範囲の処理（例: "20〜22" → "20"）
    const dayMatch = day.match(/(\d+)/);
    const dayNum = dayMatch ? dayMatch[1] : day;
    const dayEndMatch = day.match(/[〜~ー](\d+)/);

    const dateText = `2025-${currentMonth.padStart(2, "0")}-${dayNum.padStart(2, "0")}`;
    const dateEndText = dayEndMatch
      ? `2025-${currentMonth.padStart(2, "0")}-${dayEndMatch[1].padStart(2, "0")}`
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
