import * as cheerio from "cheerio";
import { execSync } from "child_process";
import { parseSchedulePdfWithClaude } from "./pdfParser";
import type { SiteConfig, ScrapedEventRaw } from "./types";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * 指定サイトのHTMLを取得してイベント一覧を抽出する
 * @param noFallback trueの場合、年フォールバックを無効化（健康診断用）
 */
export async function scrapeEvents(
  config: SiteConfig,
  noFallback = false
): Promise<ScrapedEventRaw[]> {
  const currentYear = new Date().getFullYear();
  const reiwa = currentYear - 2018;

  let html = config.useCurl
    ? fetchHtmlWithCurl(config.url)
    : await fetchHtml(config.url, config.encoding);

  let effectiveConfig: SiteConfig = { ...config, effectiveYear: config.effectiveYear ?? currentYear };

  // 前年URLを計算（年依存URLかどうか判定）
  const prevUrl = config.url
    .replace(String(currentYear), String(currentYear - 1))
    .replace(`r${reiwa}`, `r${reiwa - 1}`);
  const isYearDependent = !noFallback && prevUrl !== config.url;

  // 前年URLに切り替えるヘルパー
  const applyPrevYear = async (): Promise<boolean> => {
    console.log(`[Fallback] ${config.id}: trying previous year URL: ${prevUrl}`);
    const prevHtml = config.useCurl
      ? fetchHtmlWithCurl(prevUrl)
      : await fetchHtml(prevUrl, config.encoding);
    if (!prevHtml || prevHtml.trim() === "") return false;
    html = prevHtml;
    effectiveConfig = {
      ...config,
      url: prevUrl,
      baseUrl: config.baseUrl
        .replace(String(currentYear), String(currentYear - 1))
        .replace(`r${reiwa}`, `r${reiwa - 1}`),
      effectiveYear: currentYear - 1,
    };
    console.log(`[Fallback] ${config.id}: using year ${currentYear - 1}`);
    return true;
  };

  // HTML空の場合は即フォールバック
  if (isYearDependent && (!html || html.trim() === "")) {
    await applyPrevYear();
  }

  // 札幌は要項ページも取得して2段階でパース
  if (effectiveConfig.parser === "sapporo" && effectiveConfig.guidelineUrl) {
    const guidelineHtml = await fetchHtml(effectiveConfig.guidelineUrl);
    return parseSapporo(html, guidelineHtml, effectiveConfig);
  }

  // 高体連: ページからスケジュールPDFを見つけてClaude APIで解析
  if (effectiveConfig.parser === "koutairen") {
    return parseKoutairen(html, effectiveConfig);
  }

  // 道北: スケジュールページからPDFを見つけてClaude APIで解析
  if (effectiveConfig.parser === "dohoku") {
    return parseDohoku(html, effectiveConfig);
  }

  // 道南: 複数ページのリスト + 個別ページのPDFリンク
  if (effectiveConfig.parser === "donan") {
    return parseDonan(html, effectiveConfig);
  }

  // 小樽後志: WordPress投稿一覧 → 個別投稿から日付・PDF取得
  if (effectiveConfig.parser === "osrk") {
    return parseOsrk(html, effectiveConfig);
  }

  // マスターズ: schedule.php + news.phpの2段階
  if (effectiveConfig.parser === "masters") {
    return parseMasters(html, effectiveConfig);
  }

  // ランネット: 複数ページ取得
  if (effectiveConfig.parser === "runnet") {
    return parseRunnet(html, effectiveConfig);
  }

  // 一般パーサー: パース後も0件なら前年にフォールバック
  // （年が変わったが新年ページが未更新でHTML自体は存在するケース）
  const events = await parseEventsFromHtml(html, effectiveConfig);
  if (isYearDependent && events.length === 0) {
    const didFallback = await applyPrevYear();
    if (didFallback) {
      return await parseEventsFromHtml(html, effectiveConfig);
    }
  }
  return events;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchHtml(
  url: string,
  encoding: string = "utf-8"
): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    console.error(`[Fetch] ${url} returned ${res.status}`);
    return "";
  }
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

function fetchHtmlWithCurl(url: string): string {
  // Vercelではcurlが使えないため空文字を返す（Cloudflare保護サイト用）
  if (process.env.VERCEL) {
    console.log(`[Curl] Skipped on Vercel: ${url}`);
    return "";
  }
  try {
    const cmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;
    return execSync(cmd).toString();
  } catch (e) {
    console.error(`Curl failed for ${url}:`, e);
    return "";
  }
}

export async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download PDF: ${res.status} ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // PDFマジックバイト検証: HTMLエラーページ(200 OK)を誤検知しないようにする
  if (buffer.length < 4 || buffer.slice(0, 4).toString("ascii") !== "%PDF") {
    throw new Error(`Not a valid PDF (got HTML or other content): ${url}`);
  }
  return buffer;
}

async function parseEventsFromHtml(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];

  // 北海道陸協はPDFパースロジックを含むため特別扱い
  if (config.parser === "hokkaido") {
    return parseHokkaido(html, config);
  }

  const $ = cheerio.load(html);

  const year = config.effectiveYear ?? CURRENT_YEAR;

  if (config.parser === "sorachi") {
    // 空知: テーブル形式（月と日が別セル、月列はrowspan）
    // td=6: [月, 日, 曜, 大会名, 要項, 申込] ← 月の最初の行
    // td=5: [日, 曜, 大会名, 要項, 申込] ← 同月の続き行
    let currentMonth = "";
    $(config.selectors.eventRow).each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 5) return;

      let month: string, day: string, name: string, pdfLink: string | undefined;
      if (tds.length >= 6) {
        // 月の最初の行
        currentMonth = $(tds[0]).text().trim();
        day = $(tds[1]).text().trim();
        name = $(tds[3]).text().trim();
        pdfLink = $(tds[4]).find("a").attr("href");
      } else {
        // 同月の続き行
        day = $(tds[0]).text().trim();
        name = $(tds[2]).text().trim();
        pdfLink = $(tds[3]).find("a").attr("href");
      }
      month = currentMonth;

      if (!month || !day || !name) return;
      if (name === "大会名") return;

      // 全角→半角
      month = month.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
      day = day.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

      // 日の範囲対応 "3-4" → dateEnd
      const dayMatch = day.match(/(\d+)(?:-(\d+))?/);
      if (!dayMatch) return;

      const dayStart = dayMatch[1].padStart(2, "0");
      const dayEnd = dayMatch[2] ? dayMatch[2].padStart(2, "0") : null;
      const monthPad = month.padStart(2, "0");
      const dateStr = dayEnd
        ? `${year}-${monthPad}-${dayStart}~${year}-${monthPad}-${dayEnd}`
        : `${year}-${monthPad}-${dayStart}`;

      const detailUrl = pdfLink
        ? new URL(pdfLink, config.baseUrl).toString()
        : config.url;

      events.push({
        name,
        dateText: dateStr,
        pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
        detailUrl,
      });
    });
  } else if (config.parser === "kushiro") {
    // 釧路: テーブル形式（日付は<th>、大会名・PDF等は<td>）
    $(config.selectors.eventRow).each((_, el) => {
      const tds = $(el).find("td");
      const ths = $(el).find("th");
      if (tds.length === 0) return;

      // 日付は<th>に入っている
      const dateText = ths.length > 0 ? $(ths[0]).text().trim() : "";
      const name = $(tds[0]).text().trim();
      const pdfLink = tds.length > 1
        ? $(tds[1]).find("a").attr("href") || $(tds[2]).find("a").attr("href")
        : undefined;

      if (dateText && name) {
        const normalizedDate = dateText.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        );
        // 釧路: "4月29日(土)"
        // 4月29日(土)～30日(日)
        const dateMatch = normalizedDate.match(/(\d+)月(\d+)日/);

        if (dateMatch) {
          const month = dateMatch[1].padStart(2, "0");
          const day = dateMatch[2].padStart(2, "0");

          // 終了日の抽出（簡易実装）
          const endDateMatch = normalizedDate.match(/～(\d+)日/);
          const endDay = endDateMatch
            ? endDateMatch[1].padStart(2, "0")
            : null;

          const dateStr = endDay
            ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
            : `${year}-${month}-${day}`;

          const detailUrl = pdfLink
            ? new URL(pdfLink, config.baseUrl).toString()
            : config.url;

          if (name === "大会名") return;

          events.push({
            name,
            dateText: dateStr,
            pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
            detailUrl,
          });
        }
      }
    });
  } else if (config.parser === "douo") {
    // 道央: Jimdo JSONパース
    // window.__WEBSITE_PROPS__を探すのは複雑なので、HTML構造から頑張って取る
    // div.j-module.n.j-text > p
    // "2025年 4月19日（土）" ...
    $(".j-module.n.j-text p").each((_, el) => {
      const text = $(el).text().trim();
      // 例: "2025年 4月19日（土） 第１回道央陸上競技記録会 （千歳）"
      const match = text.match(
        /(\d{4})年\s*(\d{1,2})月(\d{1,2})日(?:[(（].*?[)）])?(?:\s*～\s*(\d{1,2})日)?\s*(.*)/
      );

      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        const day = match[3].padStart(2, "0");
        const endDay = match[4] ? match[4].padStart(2, "0") : null;
        const name = match[5].trim();

        const dateStr = endDay
          ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
          : `${year}-${month}-${day}`;

        // PDFリンクはこのpタグ内か近くにあるはずだが、一旦省略
        events.push({
          name,
          dateText: dateStr,
          detailUrl: config.url,
        });
      }
    });
  } else if (config.parser === "tokachi") {
    // 十勝: テーブル形式（日付/大会名/会場/要項PDF等）
    $("table tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 3) return;

      const dateText = $(tds[0]).text().trim();
      // colspanがある場合があるため、大会名は2番目のtd（colspan=2の可能性あり）
      const name = $(tds[1]).text().trim();

      if (!dateText || !name) return;

      // 全角→半角
      const normalizedDate = dateText.replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      );

      // "3月22日(土)" or "7月5日(土)～6日(日)"
      const dateMatch = normalizedDate.match(/(\d+)月(\d+)日/);
      if (!dateMatch) return;

      const month = dateMatch[1].padStart(2, "0");
      const day = dateMatch[2].padStart(2, "0");
      const endMatch = normalizedDate.match(/～(\d+)日/);
      const endDay = endMatch ? endMatch[1].padStart(2, "0") : null;

      const dateStr = endDay
        ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
        : `${year}-${month}-${day}`;

      // PDFリンク: 全tdから最初の.pdfリンクを検索
      let pdfHref: string | undefined;
      tds.each((_, td) => {
        if (pdfHref) return;
        const link = $(td).find("a[href$='.pdf']").attr("href");
        if (link) pdfHref = link;
      });

      const detailUrl = pdfHref
        ? new URL(pdfHref, config.baseUrl).toString()
        : config.url;

      // 会場（3番目のtd、存在すれば）
      const location = tds.length >= 3 ? $(tds[2]).text().trim() : "";

      events.push({
        name: location ? `${name}　${location}` : name,
        dateText: dateStr,
        pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
        detailUrl,
      });
    });
  } else if (config.parser === "chuutairen") {
    // 中体連: テーブル形式（月日/大会名/開催地/要項/申込書/その他）
    $("table tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 3) return;

      const dateText = $(tds[0]).text().trim();
      const name = $(tds[1]).text().trim();
      const location = $(tds[2]).text().trim();

      if (!dateText || !name) return;

      // ヘッダー行スキップ
      if (name.includes("大　会　名") || name.includes("大会名")) return;

      const normalizedDate = dateText.replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      );

      const dateMatch = normalizedDate.match(/(\d+)月(\d+)日/);
      if (!dateMatch) return;

      const month = dateMatch[1].padStart(2, "0");
      const day = dateMatch[2].padStart(2, "0");
      const endMatch = normalizedDate.match(/[～〜](\d+)日/);
      const endDay = endMatch ? endMatch[1].padStart(2, "0") : null;

      const dateStr = endDay
        ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
        : `${year}-${month}-${day}`;

      // 要項PDFリンク（td[3]内のa要素、絶対URLの場合あり）
      let pdfHref: string | undefined;
      if (tds.length > 3) {
        const link = $(tds[3]).find("a").attr("href");
        if (link) {
          pdfHref = link.startsWith("http")
            ? link
            : new URL(link, config.baseUrl).toString();
        }
      }

      const detailUrl = pdfHref || config.url;

      events.push({
        name: location ? `${name}　${location}` : name,
        dateText: dateStr,
        pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
        detailUrl,
      });
    });
  } else if (config.parser === "gakuren") {
    // 学連: Google Sites Classic — テキスト＋リンクから正規表現で抽出
    // ページ全体のテキストから「M/D(曜) 大会名 @会場」パターンを検索
    const text = $.text();
    // パターン: "5/3(土) 2025年度北海道学連競技会第1戦 @円山公園陸上競技場"
    const lines = text.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      // "M/D(曜)" or "M/D(曜)～D(曜)" のパターン
      const match = trimmed.match(
        /(\d{1,2})\/(\d{1,2})\([日月火水木金土]\)(?:\s*[～~]\s*(\d{1,2})\/(\d{1,2})\([日月火水木金土]\))?\s+(.+?)(?:\s+@(.+))?$/
      );
      if (match) {
        const month = match[1].padStart(2, "0");
        const day = match[2].padStart(2, "0");
        const endMonth = match[3] ? match[3].padStart(2, "0") : null;
        const endDay = match[4] ? match[4].padStart(2, "0") : null;
        const name = match[5].trim();
        const location = match[6] ? match[6].trim() : "";

        const dateStr = endDay
          ? `${year}-${month}-${day}~${year}-${endMonth || month}-${endDay}`
          : `${year}-${month}-${day}`;

        events.push({
          name: location ? `${name}　${location}` : name,
          dateText: dateStr,
          detailUrl: config.url,
        });
      }
    }
  } else if (config.parser === "tomakomai") {
    // 苫小牧: Jimdo Creator — .j-hgrid ブロックごとに大会情報を抽出
    // 左カラム: 大会名（font-size:22px）+ 開催日（赤文字、令和表記）
    // 後続の .j-imageSubtitle: 要項PDFリンク

    // 全角数字→半角変換ヘルパー
    const toHalf = (s: string) =>
      s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

    // 令和→西暦変換ヘルパー
    const reiwToYear = (r: number) => 2018 + r;

    $(".j-hgrid").each((_, el) => {
      const block = $(el);

      // 大会名: 左カラム内の font-size:22px テキストを全て結合
      const nameParts: string[] = [];
      block.find("b, span, strong").each((_, tag) => {
        const style = $(tag).attr("style") || "";
        if (style.includes("font-size") && style.includes("22")) {
          const t = $(tag).text().trim();
          if (t) nameParts.push(t);
        }
      });
      // フォールバック: 色付き大きめテキスト
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
      // 分割された名前を結合（「第１」+「戦」→「第１戦」）
      const name = nameParts.join("")
        .replace(/\s*E-mail:.*$/i, "")   // フッターのメール情報除去
        .replace(/\s*※.*$/, "")           // 注釈除去
        .trim();
      if (!name || name.includes("@")) return; // メールアドレスを含むゴミブロック除外

      // 開催日: 赤文字テキストから「開催日」行を探す
      let dateText = "";
      block.find("span, b, strong, font").each((_, tag) => {
        const style = $(tag).attr("style") || "";
        const color = $(tag).attr("color") || "";
        const text = $(tag).text().trim();
        if ((style.includes("#ff0000") || style.includes("red") || color.includes("#ff0000") || color.includes("red"))
            && text.includes("開催日")) {
          dateText = text;
        }
      });
      // フォールバック: ブロック全体のテキストから開催日を探す
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

      const reiwaNum = parseInt(reiwaMatch[1], 10);
      const westernYear = reiwToYear(reiwaNum);
      const month = reiwaMatch[2].padStart(2, "0");
      const day = reiwaMatch[3].padStart(2, "0");

      // 終了日（〜 で2日以上の場合）
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

      // PDFリンク: hgridの後続兄弟から .j-imageSubtitle を探す
      let pdfUrl: string | undefined;
      let sibling = block.next();
      // 次の .j-hgrid に到達するまで探す（最大5要素）
      for (let i = 0; i < 5 && sibling.length; i++) {
        if (sibling.hasClass("j-hgrid")) break;
        sibling.find(".j-imageSubtitle figure a, .j-imageSubtitle a, a").each((_, a) => {
          if (pdfUrl) return;
          const href = $(a).attr("href") || "";
          const caption = $(a).closest("figure").find("figcaption").text()
            || $(a).text();
          if (href && (caption.includes("要項") || caption.includes("大会要項"))) {
            pdfUrl = href.startsWith("http") ? href : new URL(href, config.baseUrl).toString();
          }
        });
        if (pdfUrl) break;
        sibling = sibling.next();
      }

      const detailUrl = pdfUrl || config.url;

      events.push({
        name,
        dateText: dateStr,
        pdfUrl: pdfUrl?.endsWith(".pdf") ? pdfUrl : undefined,
        detailUrl,
      });
    });
  } else if (config.parser === "muroriku") {
    // 室蘭: Wixサイト、プレーンテキスト形式
    // "２０２５年度" ヘッダーから年を取得
    const rawText = $.text();
    // 全角数字→半角変換
    const toHalf = (s: string) =>
      s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    const normalizedText = toHalf(rawText);

    // 年度抽出
    const yearMatch2 = normalizedText.match(/(\d{4})年度/);
    const scheduleYear = yearMatch2 ? parseInt(yearMatch2[1]) : year;

    // "M月D日（曜）大会名" 行をパース（半角数字）
    for (const line of normalizedText.split("\n")) {
      const trimmed = line.trim();
      // 単日: "M月 D日（曜）大会名"
      const match = trimmed.match(
        /(\d{1,2})月\s*(\d{1,2})日[（(][日月火水木金土・祝][）)]\s*(.+)/
      );
      if (!match) continue;

      const month = match[1].padStart(2, "0");
      const day = match[2].padStart(2, "0");
      let name = match[3]
        .replace(/【終了】/g, "")
        .replace(/（終了）/g, "")
        .replace(/\(終了\)/g, "")
        .trim();
      if (!name) continue;

      // 複数日: "～ M2月D2日" or "～ D2日"
      const endMatch = trimmed.match(/[～~]\s*(?:(\d{1,2})月\s*)?(\d{1,2})日/);
      let dateStr: string;
      if (endMatch) {
        const endMonth = endMatch[1] ? endMatch[1].padStart(2, "0") : month;
        const endDay = endMatch[2].padStart(2, "0");
        // 大会名から終了日部分を除去
        name = name.replace(/[～~].*/, "").trim();
        dateStr = `${scheduleYear}-${month}-${day}~${scheduleYear}-${endMonth}-${endDay}`;
      } else {
        dateStr = `${scheduleYear}-${month}-${day}`;
      }

      events.push({ name, dateText: dateStr, detailUrl: config.url });
    }
  } else if (config.parser === "ork") {
    // オホーツク: HTMLテーブル（月|日|曜日|競技会名|開催地|関連ページ|結果）
    // 年度はページヘッダーから取得
    const pageText = $.text();
    const yrMatch = pageText.match(/(\d{4})年度/);
    const scheduleYear = yrMatch ? parseInt(yrMatch[1]) : year;

    $("table").first().find("tbody tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length < 4) return;

      const monthStr = $(tds[0]).text().trim();
      const dayStr = $(tds[1]).text().trim();
      const name = $(tds[3]).text().trim();
      const location = tds.length > 4 ? $(tds[4]).text().trim().replace(/[\s　]+/g, "") : "";
      const linkHref = tds.length > 5 ? $(tds[5]).find("a").attr("href") || "" : "";

      if (!monthStr || !dayStr || !name) return;
      const month = parseInt(monthStr);
      const dayMatch2 = dayStr.match(/(\d+)/);
      if (!month || !dayMatch2) return;

      const monthPad = month.toString().padStart(2, "0");
      const dayPad = parseInt(dayMatch2[1]).toString().padStart(2, "0");

      // 複数日: "10～11"
      const dayEndMatch = dayStr.match(/[～~]\s*(\d+)/);
      const dateStr = dayEndMatch
        ? `${scheduleYear}-${monthPad}-${dayPad}~${scheduleYear}-${monthPad}-${parseInt(dayEndMatch[1]).toString().padStart(2, "0")}`
        : `${scheduleYear}-${monthPad}-${dayPad}`;

      const detailUrl = linkHref
        ? linkHref.startsWith("http")
          ? linkHref
          : new URL(linkHref, config.baseUrl).toString()
        : config.url;

      events.push({
        name: location ? `${name}　${location}` : name,
        dateText: dateStr,
        detailUrl,
      });
    });
  }

  return events;
}

function parseSapporo(
  scheduleHtml: string,
  guidelineHtml: string,
  config: SiteConfig
): ScrapedEventRaw[] {
  const year = config.effectiveYear ?? CURRENT_YEAR;
  const events: ScrapedEventRaw[] = [];
  const $s = cheerio.load(scheduleHtml);
  const $g = cheerio.load(guidelineHtml);

  // 1. スケジュールから基本情報を取得
  const scheduleMap = new Map<string, { date: string; location: string }>();

  // 札幌スケジュール: 月列にrowspanあり
  // td=5: [月, 日, 曜, 大会名, 会場] ← 月の最初の行
  // td=4: [日, 曜, 大会名, 会場] ← 同月の続き行
  // td=2～3: 備考行など
  let currentMonth = "";
  $s(config.selectors.eventRow).each((_, el) => {
    const tds = $s(el).find("td");
    if (tds.length < 4) return;

    let month: string, day: string, name: string, location: string;
    if (tds.length >= 5) {
      currentMonth = $s(tds[0]).text().trim();
      day = $s(tds[1]).text().trim();
      name = $s(tds[3]).text().trim();
      location = $s(tds[4]).text().trim();
    } else {
      day = $s(tds[0]).text().trim();
      name = $s(tds[2]).text().trim();
      location = tds.length >= 4 ? $s(tds[3]).text().trim() : "";
    }
    month = currentMonth;

    if (month && day && name) {
      const dayClean = day.split("～")[0].split("~")[0].replace(/\D/g, "");
      if (!dayClean) return;
      const dateStr = `${year}-${month.padStart(2, "0")}-${dayClean.padStart(2, "0")}`;
      scheduleMap.set(name, { date: dateStr, location });
    }
  });

  // 2. 要項ページからPDFリンクと正式名称を取得し、スケジュール情報とマージ
  // 札幌陸協の構造: <h3>大会名</h3> ... <ul class="doc-list"><li><a>要項PDF</a></li></ul>
  $g("h3").each((_, el) => {
    const name = $g(el).text().trim();
    if (!name) return;
    // 次のdoc-listを探す
    const nextUl = $g(el).nextAll("ul.doc-list").first();
    // 要項PDFリンク（"youkou"を含むか、最初のPDFリンク）
    let pdfLink: string | undefined;
    nextUl.find("a[href$='.pdf']").each((_, a) => {
      const href = $g(a).attr("href") || "";
      if (!pdfLink || href.includes("youkou")) {
        pdfLink = href;
      }
    });

    // 名前でスケジュールを検索（完全一致しない場合が多いので部分一致推奨だが、一旦完全一致でtrial）
    // 札幌陸協は表記揺れが少ないが、スペース有無などでずれるかも
    let scheduleInfo = scheduleMap.get(name);

    // 見つからない場合、scheduleMapのキーをループして包含チェック
    if (!scheduleInfo) {
      for (const [key, val] of scheduleMap.entries()) {
        if (key.includes(name) || name.includes(key)) {
          scheduleInfo = val;
          break;
        }
      }
    }

    if (scheduleInfo) {
      const detailUrl = pdfLink
        ? new URL(pdfLink, config.baseUrl).toString()
        : config.guidelineUrl || config.url;

      events.push({
        name: name + (scheduleInfo.location ? `　${scheduleInfo.location}` : ""), // 場所を名前に付加して保存
        dateText: scheduleInfo.date,
        pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
        detailUrl,
      });
    }
  });

  return events;
}

async function parseHokkaido(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const year = config.effectiveYear ?? CURRENT_YEAR;
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(html);

  // 1. HTMLから個別大会を取得（dl.web_guidelines構造）
  $("dl.web_guidelines").each((_, el) => {
    const dt = $(el).find("dt");
    const name = dt.text().trim();
    const dd = $(el).find("dd");

    let prev = $(el).prev();
    while (prev.length && !prev.is("h3")) {
      prev = prev.prev();
    }
    const dateTextSource = prev.text().trim();

    const dateMatch = dateTextSource.match(
      /(\d{1,2})月(\d{1,2})日(?:[～~](\d{1,2})日)?/
    );
    if (!dateMatch) return;

    const month = dateMatch[1].padStart(2, "0");
    const day = dateMatch[2].padStart(2, "0");
    const endDay = dateMatch[3] ? dateMatch[3].padStart(2, "0") : null;

    const dateStr = endDay
      ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
      : `${year}-${month}-${day}`;

    const pdfLink = dd.find("a").filter((_, a) => $(a).text().includes("要項")).attr("href")
      || dd.find("a[href$='.pdf']").attr("href");

    const detailUrl = pdfLink
      ? new URL(pdfLink, config.baseUrl).toString()
      : config.url;

    events.push({
      name,
      dateText: dateStr,
      pdfUrl: detailUrl.endsWith(".pdf") ? detailUrl : undefined,
      detailUrl,
    });
  });

  // 2. スケジュールPDFをClaude APIで解析してマージ
  if (config.scheduleUrl) {
    try {
      console.log(`[Hokkaido] Fetching schedule page: ${config.scheduleUrl}`);
      const scheduleHtml = await fetchHtml(config.scheduleUrl);
      const $s = cheerio.load(scheduleHtml);

      // 「全競技会日程」を優先
      let pdfLink = $s("a").filter((_, el) => {
        const text = $s(el).text();
        const href = $s(el).attr("href") || "";
        return text.includes("全競技会") && href.endsWith(".pdf");
      }).first();

      // なければ「日程」を含むPDF
      if (!pdfLink.length) {
        pdfLink = $s("a").filter((_, el) => {
          const text = $s(el).text();
          const href = $s(el).attr("href") || "";
          return text.includes("日程") && href.endsWith(".pdf");
        }).first();
      }

      // 最終フォールバック: 任意のPDF
      if (!pdfLink.length) {
        pdfLink = $s("a[href$='.pdf']").first();
      }

      if (pdfLink.length > 0) {
        const href = pdfLink.attr("href") || "";
        const pdfUrl = href.startsWith("http") ? href : new URL(href, config.scheduleUrl).toString();
        console.log(`[Hokkaido] Found schedule PDF: ${pdfUrl}`);

        const pdfBuffer = await downloadPdf(pdfUrl);
        const pdfEvents = await parseSchedulePdfWithClaude(pdfBuffer);
        console.log(`[Hokkaido] Claude extracted ${pdfEvents.length} events from schedule PDF`);

        // マージ（HTML側を優先、PDF側で新規のもののみ追加）
        for (const pe of pdfEvents) {
          const peDate = pe.date;
          const peName = pe.name.replace(/\s+/g, "");
          const exists = events.some(ie => {
            const ieDate = ie.dateText.split("~")[0];
            const ieName = ie.name.replace(/\s+/g, "");
            return ieDate === peDate && (ieName.includes(peName.substring(0, 5)) || peName.includes(ieName.substring(0, 5)));
          });
          if (!exists) {
            const dateStr = pe.dateEnd
              ? `${pe.date}~${pe.dateEnd}`
              : pe.date;
            events.push({
              name: pe.location ? `${pe.name}　${pe.location}` : pe.name,
              dateText: dateStr,
              pdfUrl,
              detailUrl: pdfUrl,
            });
          }
        }
      }
    } catch (e) {
      console.error("[Hokkaido] Failed to parse schedule PDF:", e);
    }
  }

  return events;
}

/**
 * 高体連: ページからスケジュールPDFを見つけてClaude APIで全大会を抽出
 * Jimdoサイト（Cloudflare保護あり）— __WEBSITE_PROPS__ JSON内にPDFリンクが埋まっている
 */
async function parseKoutairen(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];

  try {
    // Jimdo構造: __WEBSITE_PROPS__ JSON内のdownload URLを探す
    // または j-downloadDocument 内のリンク
    const $ = cheerio.load(html);

    // 方法1: <a>タグから.pdfリンクを直接検索
    let pdfUrl: string | undefined;
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes(".pdf") && (href.includes("大会") || href.includes("日程") || href.includes("schedule"))) {
        pdfUrl = href.startsWith("http") ? href : new URL(href, config.baseUrl).toString();
        return false; // break
      }
    });

    // 方法2: __WEBSITE_PROPS__ JSONからPDFリンクを抽出
    if (!pdfUrl) {
      const propsMatch = html.match(/window\.__WEBSITE_PROPS__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (propsMatch) {
        // ブレースカウントで完全なJSONを抽出（非貪欲正規表現は不可）
        const startIdx = html.indexOf("window.__WEBSITE_PROPS__");
        if (startIdx !== -1) {
          const jsonStart = html.indexOf("{", startIdx);
          let depth = 0;
          let jsonEnd = jsonStart;
          for (let i = jsonStart; i < html.length; i++) {
            if (html[i] === "{") depth++;
            if (html[i] === "}") depth--;
            if (depth === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
          const jsonStr = html.substring(jsonStart, jsonEnd);
          // PDF URLを正規表現で検索（JSON全体をパースする必要なし）
          const pdfMatches = jsonStr.match(/https?:[^"]*\.pdf/g);
          if (pdfMatches && pdfMatches.length > 0) {
            // 「日程」「大会」を含むPDFを優先
            pdfUrl = pdfMatches.find(u => u.includes("日程") || u.includes("大会"))
              || pdfMatches[0];
            pdfUrl = pdfUrl.replace(/\\\//g, "/"); // JSONエスケープ解除
          }
        }
      }
    }

    // 方法3: download系のリンクを探す
    if (!pdfUrl) {
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.includes("/app/download/") || href.includes(".pdf")) {
          pdfUrl = href.startsWith("http") ? href : new URL(href, config.baseUrl).toString();
          return false;
        }
      });
    }

    if (pdfUrl) {
      console.log(`[Koutairen] Found schedule PDF: ${pdfUrl}`);
      const pdfBuffer = await downloadPdf(pdfUrl);
      const pdfEvents = await parseSchedulePdfWithClaude(pdfBuffer);
      console.log(`[Koutairen] Claude extracted ${pdfEvents.length} events from schedule PDF`);

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
      console.warn("[Koutairen] No schedule PDF found on page");
    }
  } catch (e) {
    console.error("[Koutairen] Failed to parse:", e);
  }

  return events;
}

/**
 * マスターズ: schedule.php からスケジュールテーブル取得、
 * なければ news.php のニュース一覧から大会情報を抽出
 */
async function parseMasters(
  scheduleHtml: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const year = config.effectiveYear ?? CURRENT_YEAR;
  const events: ScrapedEventRaw[] = [];
  const $ = cheerio.load(scheduleHtml);

  // 1. schedule.php にスケジュールテーブルがあるか確認
  $("table tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;

    const dateText = $(tds[0]).text().trim();
    const name = $(tds[1]).text().trim();

    if (!dateText || !name) return;

    const dateMatch = dateText.match(/(\d+)月(\d+)日/);
    if (!dateMatch) return;

    const month = dateMatch[1].padStart(2, "0");
    const day = dateMatch[2].padStart(2, "0");

    events.push({
      name,
      dateText: `${year}-${month}-${day}`,
      detailUrl: config.url,
    });
  });

  // 2. スケジュールが取れなかった場合、news.php から大会情報を抽出
  if (events.length === 0) {
    try {
      const newsHtml = await fetchHtml(config.baseUrl + "news.php");
      const $n = cheerio.load(newsHtml);

      $n(".NEWSBox4").each((_, el) => {
        const text = $n(el).find(".NEWSBox4Text").text().trim();
        // ニュースタイトルから大会関連のものを抽出
        // パターン: "M月D日開催" or "M/D開催" + 大会名
        const dateInTitle = text.match(/(\d+)月(\d+)日(?:[（(][日月火水木金土・祝]+[）)])?(?:\s*開催)?/);
        if (!dateInTitle) return;

        // 大会名に関連するキーワードがあるかチェック
        if (!text.match(/大会|記録会|選手権|競技会/)) return;
        const month = dateInTitle[1].padStart(2, "0");
        const day = dateInTitle[2].padStart(2, "0");

        // リンクからPDFを探す
        const newsLink = $n(el).parent("a").attr("href");
        const detailUrl = newsLink
          ? new URL(newsLink, config.baseUrl).toString()
          : config.url;

        // 大会名を抽出（日付部分を除去）
        let name = text
          .replace(/(\d+)月(\d+)日[（(][日月火水木金土・祝]+[）)]\s*開催\s*/, "")
          .replace(/要[項綱].*$/, "")
          .replace(/をアップ.*$/, "")
          .trim();
        if (!name) name = text;

        // 重複チェック
        const exists = events.some(e => e.dateText === `${year}-${month}-${day}` && e.name.includes(name.substring(0, 5)));
        if (!exists) {
          events.push({
            name,
            dateText: `${year}-${month}-${day}`,
            detailUrl,
          });
        }
      });
    } catch (e) {
      console.error("[Masters] Failed to fetch news.php:", e);
    }
  }

  return events;
}

/**
 * ランネット: 北海道の大会検索結果ページから大会一覧を取得
 * 複数ページ対応（pageIndex=2）
 */
async function parseRunnet(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];

  // ページ1をパース
  parseRunnetPage(html, config, events);

  // ページ2があれば取得
  try {
    const page2Url = config.url + "&pageIndex=2";
    const html2 = await fetchHtml(page2Url);
    parseRunnetPage(html2, config, events);
  } catch (e) {
    console.log("[Runnet] No page 2 or fetch failed:", e);
  }

  // ページ間の重複排除（同一名+同一日付）
  const seen = new Set<string>();
  const deduped = events.filter((e) => {
    const key = `${e.dateText}-${e.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}

function parseRunnetPage(
  html: string,
  config: SiteConfig,
  events: ScrapedEventRaw[]
): void {
  const $ = cheerio.load(html);

  $("li.item").each((_, el) => {
    // 大会名: .item-title a
    const titleLink = $(el).find(".item-title a");
    const name = titleLink.text().trim();
    const href = titleLink.attr("href") || "";

    // 日付: p.date or .body-head .date — "2026年5月17日(日)"
    const dateText = $(el).find("p.date").text().trim();

    // 開催地: p.place — "北海道（洞爺湖町）"
    const place = $(el).find("p.place").text().trim();

    // 種目: .infoTable の種目行
    const disciplines = $(el).find(".infoTable tr").first().find("td").text().trim();

    if (!name || !dateText) return;

    // 日付パース: "2026年5月17日(日)"
    const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return;

    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, "0");
    const day = dateMatch[3].padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // raceIdを抽出して詳細URLを生成
    const raceIdMatch = href.match(/raceId=(\d+)/);
    const detailUrl = raceIdMatch
      ? `https://runnet.jp/entry/runtes/user/pc/competitionDetailAction.do?raceId=${raceIdMatch[1]}&div=1`
      : config.url;

    // 大会名に場所と距離情報を付加
    const locationClean = place.replace(/^北海道[（(]/, "").replace(/[）)]$/, "");
    const fullName = locationClean
      ? `${name}　${locationClean}`
      : name;

    events.push({
      name: fullName,
      dateText: dateStr,
      detailUrl,
    });
  });
}

/**
 * 道北: スケジュールページからPDFリンクを見つけてClaude APIで全大会を抽出
 * cf139878.cloudfree.jp/schedule/schedule.htm → YEAR_schedule.pdf
 */
async function parseDohoku(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  if (!html || html.trim() === "") return [];

  const $ = cheerio.load(html);

  // スケジュールPDFリンクを検索 (例: 2025_schedule.pdf)
  let pdfUrl: string | undefined;
  $("a").each((_, el) => {
    if (pdfUrl) return;
    const href = $(el).attr("href") || "";
    if (href.endsWith("_schedule.pdf") || (href.includes("schedule") && href.endsWith(".pdf"))) {
      pdfUrl = href.startsWith("http")
        ? href
        : new URL(href, config.baseUrl).toString();
    }
  });

  if (!pdfUrl) {
    console.warn("[Dohoku] No schedule PDF found on page");
    return [];
  }

  console.log(`[Dohoku] Found schedule PDF: ${pdfUrl}`);
  try {
    const pdfBuffer = await downloadPdf(pdfUrl);
    const pdfEvents = await parseSchedulePdfWithClaude(pdfBuffer);
    console.log(`[Dohoku] Claude extracted ${pdfEvents.length} events`);
    return pdfEvents.map((pe) => ({
      name: pe.location ? `${pe.name}　${pe.location}` : pe.name,
      dateText: pe.dateEnd ? `${pe.date}~${pe.dateEnd}` : pe.date,
      pdfUrl,
      detailUrl: pdfUrl!,
    }));
  } catch (e) {
    console.error("[Dohoku] Failed to download/parse PDF:", e);
    return [];
  }
}

/**
 * 道南: ul.athletics_infolist から複数ページ取得 + 個別ページから要項PDF
 * donan-rikkyo.jp/athletics/ (ページネーション対応)
 */
async function parseDonan(
  html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const events: ScrapedEventRaw[] = [];

  const parseListHtml = (pageHtml: string) => {
    const $p = cheerio.load(pageHtml);
    $p("ul.athletics_infolist li").each((_, el) => {
      const a = $p(el).find("a");
      const detailHref = a.attr("href") || "";
      const name = $p(el).find(".athletics_infotitle").text().trim();
      const dateText = $p(el).find("time").text().trim();
      if (!name || !dateText) return;

      const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (!dateMatch) return;

      const y = dateMatch[1];
      const m = dateMatch[2].padStart(2, "0");
      const d = dateMatch[3].padStart(2, "0");
      const endMatch = dateText.match(/[～~]\s*(?:(\d+)月)?(\d+)日/);
      const dateStr = endMatch
        ? `${y}-${m}-${d}~${y}-${(endMatch[1] || dateMatch[2]).padStart(2, "0")}-${endMatch[2].padStart(2, "0")}`
        : `${y}-${m}-${d}`;

      events.push({
        name,
        dateText: dateStr,
        detailUrl: detailHref || config.url,
      });
    });
  };

  // ページ1
  parseListHtml(html);

  // 追加ページを取得
  const $ = cheerio.load(html);
  const pageUrls = new Set<string>();
  $("a.page-numbers").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("/page/")) pageUrls.add(href);
  });
  for (const pageUrl of pageUrls) {
    const pageHtml = await fetchHtml(pageUrl);
    parseListHtml(pageHtml);
  }

  // 個別ページから要項PDFリンクを取得（3件並列）
  const BATCH = 3;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (ev) => {
        if (!ev.detailUrl || ev.detailUrl === config.url) return;
        try {
          const dHtml = await fetchHtml(ev.detailUrl);
          const $d = cheerio.load(dHtml);
          $d("a").each((_, a) => {
            if (ev.pdfUrl) return;
            const href = $d(a).attr("href") || "";
            const text = $d(a).text().trim();
            if (
              href.endsWith(".pdf") &&
              (text.includes("要項") || text.includes("開催要項"))
            ) {
              ev.pdfUrl = href.startsWith("http")
                ? href
                : new URL(href, config.baseUrl).toString();
            }
          });
        } catch {
          // 詳細ページ取得失敗は無視
        }
      })
    );
  }

  return events;
}

/**
 * 小樽後志: WordPress REST API で大会情報カテゴリ(id=4)の投稿を取得
 * HTMLスクレイピングはVercelからブロックされるためAPI経由に変更
 */
async function parseOsrk(
  _html: string,
  config: SiteConfig
): Promise<ScrapedEventRaw[]> {
  const toHalf = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  const apiUrl =
    "https://osrk.jp/wp-json/wp/v2/posts?categories=4&per_page=100&orderby=date&order=desc";

  let posts: Array<{
    title: { rendered: string };
    content: { rendered: string };
    link: string;
  }>;

  try {
    const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
    console.log(`[Osrk] WP API status: ${res.status}, ok: ${res.ok}`);
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Osrk] WP API error body: ${body.substring(0, 200)}`);
      return [];
    }
    posts = await res.json();
    console.log(`[Osrk] WP API returned ${posts.length} posts`);
  } catch (e) {
    console.error("[Osrk] Failed to fetch WP API:", e);
    return [];
  }

  const events: ScrapedEventRaw[] = [];

  for (const post of posts) {
    const $ = cheerio.load(post.content.rendered);
    // 全角→半角変換後にテキスト検索
    const bodyText = toHalf($.text());

    // 日付パース: "YYYY年...M月D日" (全角→半角後)
    // 例1: "令和8年（2026年）2月7日" → 2026-02-07
    // 例2: "2025年（R7）10月13日" → 2025-10-13
    const dateMatch = bodyText.match(/(\d{4})年[^月\n]*?(\d{1,2})月\s*(\d{1,2})日/);
    if (!dateMatch) continue;

    const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    // 要項PDFリンク
    let pdfUrl: string | undefined;
    $("a").each((_, a) => {
      if (pdfUrl) return;
      const href = $(a).attr("href") || "";
      const text = $(a).text().trim();
      if (href.endsWith(".pdf") && text.includes("要項")) {
        pdfUrl = href.startsWith("http")
          ? href
          : new URL(href, config.baseUrl).toString();
      }
    });

    // タイトルのHTMLエンティティをデコード
    const name = cheerio.load(post.title.rendered).text().trim();
    if (!name) continue;

    events.push({
      name,
      dateText: dateStr,
      detailUrl: post.link,
      pdfUrl,
    });
  }

  return events;
}
