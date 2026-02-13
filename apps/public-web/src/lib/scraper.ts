import * as cheerio from "cheerio";
import { execSync } from "child_process";
import type { SiteConfig, ScrapedEventRaw } from "./types";

/**
 * 指定サイトのHTMLを取得してイベント一覧を抽出する
 */
export async function scrapeEvents(
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const html = config.useCurl
    ? fetchHtmlWithCurl(config.url)
    : await fetchHtml(config.url, config.encoding);
  // 札幌は要項ページも取得して2段階でパース
  if (config.parser === "sapporo" && config.guidelineUrl) {
    const guidelineHtml = await fetchHtml(config.guidelineUrl);
    return parseSapporo(html, guidelineHtml, config);
  }
  return parseEventsFromHtml(html, config);
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * curl経由でHTMLを取得（Cloudflare保護回避用）
 */
function fetchHtmlWithCurl(url: string): string {
  return execSync(
    `curl -s -L -A "${USER_AGENT}" "${url}"`,
    { maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" }
  );
}

/**
 * HTMLを取得（エンコーディング対応）
 */
async function fetchHtml(url: string, encoding?: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
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
    case "douo":
      return parseDouo(html, config);
    case "hokkaido":
      return parseHokkaido(html, config);
    case "sapporo":
      // 通常はscrapeEvents()で直接呼ばれるためここには来ない
      throw new Error("Sapporo parser requires guidelineHtml - use scrapeEvents()");
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

// ──────────────────────────────────────────
// 道央陸協パーサー（Jimdoサイト）
// window.__WEBSITE_PROPS__ JSON内のブロックデータを解析
// ブロック形式:
//   - List: content.items.items[0].content.{text0, text1, primaryCTA, secondaryCTA}
//   - Columns: content.text.data.text（タイトル+日付）, content.columns.items[].content.primaryCTA
// ──────────────────────────────────────────
function parseDouo(html: string, config: SiteConfig): ScrapedEventRaw[] {
  // __WEBSITE_PROPS__ のJSONを抽出（ブレース数でバランスをとる）
  const marker = "window.__WEBSITE_PROPS__ = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    console.error("[Douo] __WEBSITE_PROPS__ not found");
    return [];
  }

  const jsonStart = startIdx + marker.length;
  let depth = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    if (depth === 0) {
      jsonEnd = i + 1;
      break;
    }
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(html.slice(jsonStart, jsonEnd));
  } catch {
    console.error("[Douo] Failed to parse JSON");
    return [];
  }

  const fileLinkMap = (data.fileLinkMap || {}) as Record<
    string,
    { download_url?: string; cdn_url?: string; title?: string }
  >;
  const pageData = data.pageData as
    | { blocks?: Record<string, unknown>[] }
    | undefined;
  const blocks = pageData?.blocks || [];
  const events: ScrapedEventRaw[] = [];

  const resolveFileUrl = (uuid: string): string | undefined => {
    const file = fileLinkMap[uuid];
    return file?.download_url || file?.cdn_url;
  };

  const stripHtmlTags = (html: string): string =>
    html.replace(/<[^>]+>/g, "").trim();

  const extractEventName = (htmlText: string): string => {
    // h1, h2, h3タグ内のテキストを抽出
    const headingMatch = htmlText.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g);
    if (headingMatch) {
      return headingMatch
        .map((h) => stripHtmlTags(h))
        .filter(Boolean)
        .join(" ")
        .replace(/【終了】\s*/, "")
        .trim();
    }
    return stripHtmlTags(htmlText).replace(/【終了】\s*/, "").trim();
  };

  const parseDateToISO = (
    htmlText: string
  ): { dateStart: string; dateEnd?: string } | null => {
    const text = stripHtmlTags(htmlText);
    // 「2025年5月3日(土)開催」「2025年8月2日(土)・3日(日)開催」
    const mainMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!mainMatch) return null;

    const year = mainMatch[1];
    const month = mainMatch[2].padStart(2, "0");
    const day = mainMatch[3].padStart(2, "0");
    const dateStart = `${year}-${month}-${day}`;

    // 開催日の範囲のみ抽出（〆切・締切部分は除外）
    // 「＊」や「*」以降は締切情報なので除外
    const asteriskIdx = text.search(/[＊*]/);
    const cutoff = asteriskIdx >= 0 ? asteriskIdx : text.length;
    const datePart = text.substring(0, cutoff);

    // 終了日パターン:
    // ・24日, ～24日, 29日(日) (直後に別の日付がある場合)
    const endMatch = datePart.match(
      /\d{1,2}日\s*\([^)]*\)\s*[・～〜~]?\s*(\d{1,2})日/
    );
    const dateEnd = endMatch
      ? `${year}-${month}-${endMatch[1].padStart(2, "0")}`
      : undefined;

    return { dateStart, dateEnd };
  };

  for (const block of blocks) {
    const content = block.content as Record<string, unknown> | undefined;
    if (!content) continue;
    const category = block.category as string;

    if (category === "List") {
      // List型ブロック
      const items = content.items as
        | { items?: Record<string, unknown>[] }
        | undefined;
      const listItems = items?.items || [];
      for (const item of listItems) {
        const itemContent = item.content as Record<string, unknown> | undefined;
        if (!itemContent) continue;

        const text0 = itemContent.text0 as
          | { data?: { text?: string } }
          | undefined;
        const text1 = itemContent.text1 as
          | { data?: { text?: string } }
          | undefined;
        const primaryCTA = itemContent.primaryCTA as
          | { data?: { targetFileUuid?: string; label?: string }; visible?: boolean }
          | undefined;
        const secondaryCTA = itemContent.secondaryCTA as
          | { data?: { targetFileUuid?: string; label?: string }; visible?: boolean }
          | undefined;

        const nameHtml = text0?.data?.text || "";
        const dateHtml = text1?.data?.text || "";
        const name = extractEventName(nameHtml);
        const parsed = parseDateToISO(dateHtml);

        if (!name || !parsed) continue;

        // 要項PDFのUUIDを取得（primaryCTA優先、なければsecondaryCTA）
        let pdfUrl: string | undefined;
        const fileUuid =
          primaryCTA?.data?.targetFileUuid ||
          secondaryCTA?.data?.targetFileUuid;
        if (fileUuid) {
          pdfUrl = resolveFileUrl(fileUuid);
        }

        events.push({
          name,
          dateText: parsed.dateEnd
            ? `${parsed.dateStart}~${parsed.dateEnd}`
            : parsed.dateStart,
          pdfUrl,
          detailUrl: pdfUrl || config.url,
        });
      }
    } else if (category === "Columns") {
      // Columns型ブロック：タイトルと日付がcontent.textに入っている
      const textBlock = content.text as
        | { data?: { text?: string } }
        | undefined;
      const textHtml = textBlock?.data?.text || "";
      const name = extractEventName(textHtml);
      const parsed = parseDateToISO(textHtml);

      if (!name || !parsed) continue;

      // 最初のcolumnのprimaryCTAから要項PDFを取得
      const columns = content.columns as
        | { items?: Record<string, unknown>[] }
        | undefined;
      let pdfUrl: string | undefined;
      const firstCol = columns?.items?.[0];
      if (firstCol) {
        const colContent = firstCol.content as
          | Record<string, unknown>
          | undefined;
        const cta = colContent?.primaryCTA as
          | { data?: { targetFileUuid?: string }; visible?: boolean }
          | undefined;
        if (cta?.data?.targetFileUuid) {
          pdfUrl = resolveFileUrl(cta.data.targetFileUuid);
        }
      }

      events.push({
        name,
        dateText: parsed.dateEnd
          ? `${parsed.dateStart}~${parsed.dateEnd}`
          : parsed.dateStart,
        pdfUrl,
        detailUrl: pdfUrl || config.url,
      });
    }
  }

  return events;
}

// ──────────────────────────────────────────
// 札幌陸協パーサー（2段階スクレイピング）
// 1. スケジュールページ: table.nomal-table の行を解析
//    列構造: 月(rowspan) / 日 / 曜日 / 大会名(td.name) / 会場
// 2. 要項ページ: h3大会名 → 直後のul内のPDFリンク
// 3. 大会名の部分一致でPDFを紐付け
// ──────────────────────────────────────────
function parseSapporo(
  scheduleHtml: string,
  guidelineHtml: string,
  config: SiteConfig
): ScrapedEventRaw[] {
  const $ = cheerio.load(scheduleHtml);
  const events: ScrapedEventRaw[] = [];
  const year = new Date().getFullYear().toString();

  // Step 1: スケジュールテーブル解析
  const rows = $("table.nomal-table tr");
  let currentMonth = "";

  rows.each((_i, row) => {
    const tds = $(row).find("td");
    if (tds.length === 0) return;

    const cellTexts: string[] = [];
    const cellClasses: string[] = [];
    tds.each((_j, td) => {
      cellTexts.push($(td).text().trim());
      cellClasses.push($(td).attr("class") || "");
    });

    // 月カラム（rowspanで複数行にまたがる）
    // 5列 = 月あり: 月/日/曜/大会名/会場
    // 4列 = 月なし: 日/曜/大会名/会場
    // 2列 = 日付のみ（複数日開催の2日目以降）: 日/曜
    let day: string;
    let eventName: string;
    let venue: string;

    if (cellTexts.length >= 5) {
      // 5列 = 月あり行: 月/日/曜/大会名/会場
      const monthText = cellTexts[0].replace(/\s/g, "");
      if (monthText && /^\d+$/.test(monthText)) currentMonth = monthText;
      day = cellTexts[1];
      eventName = cellTexts[3];
      venue = cellTexts[4];
    } else if (cellTexts.length >= 4 && cellClasses.some((c) => c === "name")) {
      // 4列 = 月なし行（大会名あり）: 日/曜/大会名/会場
      day = cellTexts[0];
      eventName = cellTexts[2];
      venue = cellTexts[3];
    } else {
      // 2列（複数日開催の追加日など）→スキップ
      return;
    }

    if (!currentMonth || !day || !eventName) return;
    // 審判講習会/研修会はスキップ
    if (eventName.includes("審判講習会") || eventName.includes("審判研修会"))
      return;
    // 時刻プレフィックスを除去（例: "（13時30分）審判講習会", "～13時）...", "13時～）..."）
    eventName = eventName.replace(/^[（(～~]?[^）)]*[時分][^）)]*[）)]\s*/, "").trim();
    if (!eventName) return;

    const dayNum = day.replace(/[^0-9]/g, "");
    if (!dayNum) return;

    const dateText = `${year}-${currentMonth.padStart(2, "0")}-${dayNum.padStart(2, "0")}`;

    // 大会名に会場を付加
    const fullName = venue ? `${eventName}　${venue}` : eventName;

    events.push({
      name: fullName,
      dateText,
      detailUrl: config.url,
    });
  });

  // Step 2: 要項ページからPDFリンクをマッピング
  const $g = cheerio.load(guidelineHtml);
  const guidelineMap: { name: string; pdfUrl: string }[] = [];

  $g("h3").each((_i, h3) => {
    const name = $g(h3).text().trim();
    if (!name) return;
    // h3の次のdiv内のul.doc-listから最初のPDFリンクを取得
    const nextDiv = $g(h3).next("div");
    const pdfLink = nextDiv.find("a[href$='.pdf']").first();
    if (pdfLink.length > 0) {
      const href = pdfLink.attr("href") || "";
      const pdfUrl = href.startsWith("http")
        ? href
        : new URL(href, config.guidelineUrl).toString();
      guidelineMap.push({ name, pdfUrl });
    }
  });

  // Step 3: 部分一致でPDFを紐付け
  const normalizeName = (name: string): string =>
    name
      .replace(/\s+/g, "")
      .replace(/[０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
      )
      .replace(/（[^）]*）/g, "") // 括弧内を除去（「（高校一般）」等）
      .replace(/^\d{4}/, ""); // 先頭の年を除去（「2025」等）

  for (const event of events) {
    // イベント名から会場部分を除いて比較
    const eventNameOnly = event.name.replace(/[　\s]+[^\s　]+$/, "");
    const matched = guidelineMap.find((g) => {
      const gNorm = normalizeName(g.name);
      const eNorm = normalizeName(eventNameOnly);
      return gNorm.includes(eNorm) || eNorm.includes(gNorm);
    });
    if (matched) {
      event.pdfUrl = matched.pdfUrl;
      event.detailUrl = matched.pdfUrl;
    }
  }

  return events;
}

// ──────────────────────────────────────────
// 北海道陸協パーサー
// 構造: h3(大会名) → dl > dt(開催地/日程/要項) + dd(値)
// ──────────────────────────────────────────
function parseHokkaido(html: string, config: SiteConfig): ScrapedEventRaw[] {
  const $ = cheerio.load(html);
  const events: ScrapedEventRaw[] = [];

  $("h3").each((_i, h3) => {
    const name = $(h3).text().trim();
    if (!name) return;
    // 「2025年度大会要項」のようなセクションタイトルをスキップ
    if (name.includes("年度") && name.includes("要項")) return;

    const dl = $(h3).next("dl");
    if (!dl.length) return;

    let location = "";
    let dateText = "";
    let pdfUrl: string | undefined;

    dl.find("dt").each((_j, dt) => {
      const dtText = $(dt).text().trim();
      const dd = $(dt).next("dd");
      const ddText = dd.text().trim();

      if (dtText === "開催地") {
        location = ddText;
      } else if (dtText === "日程") {
        // 「2025年7月12日（土）～13日（日）」のような形式
        dateText = ddText;
      } else if (dtText === "要項") {
        // 最初のPDFリンクを取得
        const link = dd.find("a[href$='.pdf']").first();
        if (link.length > 0) {
          const href = link.attr("href") || "";
          pdfUrl = href.startsWith("http")
            ? href
            : new URL(href, config.url).toString();
        }
      }
    });

    if (!name || !dateText) return;

    // 日付パース: 「2025年7月12日（土）～13日（日）」
    const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return;

    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, "0");
    const day = dateMatch[3].padStart(2, "0");
    const dateStart = `${year}-${month}-${day}`;

    // 終了日
    const endMatch = dateText.match(/[～〜~]\s*(\d{1,2})日/);
    const dateEnd = endMatch
      ? `${year}-${month}-${endMatch[1].padStart(2, "0")}`
      : undefined;

    // 大会名に場所を付加（既存のextractLocationFromNameと互換性のため）
    const fullName = location ? `${name}　${location}` : name;

    events.push({
      name: fullName,
      dateText: dateEnd ? `${dateStart}~${dateEnd}` : dateStart,
      pdfUrl,
      detailUrl: pdfUrl || config.url,
    });
  });

  return events;
}

/**
 * PDFをダウンロードしてバイナリデータを返す
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to download PDF: ${res.status} ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
