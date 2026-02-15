import * as cheerio from "cheerio";
import { execSync } from "child_process";
import { parseSchedulePdfWithClaude } from "./pdfParser";
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

  // 高体連: ページからスケジュールPDFを見つけてClaude APIで解析
  if (config.parser === "koutairen") {
    return parseKoutairen(html, config);
  }

  // マスターズ: schedule.php + news.phpの2段階
  if (config.parser === "masters") {
    return parseMasters(html, config);
  }

  // ランネット: 複数ページ取得
  if (config.parser === "runnet") {
    return parseRunnet(html, config);
  }

  return await parseEventsFromHtml(html, config);
}

async function fetchHtml(
  url: string,
  encoding: string = "utf-8"
): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

function fetchHtmlWithCurl(url: string): string {
  try {
    // 403回避のための簡易策 (User-Agent偽装)
    const cmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;
    return execSync(cmd).toString();
  } catch (e) {
    console.error(`Curl failed for ${url}:`, e);
    return "";
  }
}

export async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download PDF: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

  if (config.parser === "sorachi") {
    // 空知: テーブル形式
    $(config.selectors.eventRow).each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length === 0) return;

      const dateText = $(tds[config.selectors.dateColumn as number])
        .text()
        .trim();
      const name = $(tds[config.selectors.nameColumn as number])
        .text()
        .trim();
      // PDFリンク
      const pdfLink = $(tds[config.selectors.pdfLinkColumn as number])
        .find("a")
        .attr("href");

      if (dateText && name) {
        // 全角英数字を半角に
        const normalizedDate = dateText.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        );

        // 日付フォーマット整形 (例: 4月10日 -> 2025-04-10)
        // 空知は "4/12", "5/3-4" のような形式
        const year = 2025; // TODO: ページから年度取得
        const dateMatch = normalizedDate.match(/(\d+)\/(\d+)(?:-(\d+))?/);

        if (dateMatch) {
          const month = dateMatch[1].padStart(2, "0");
          const day = dateMatch[2].padStart(2, "0");
          const endDay = dateMatch[3] ? dateMatch[3].padStart(2, "0") : null;
          const dateStr = endDay
            ? `${year}-${month}-${day}~${year}-${month}-${endDay}`
            : `${year}-${month}-${day}`;

          const detailUrl = pdfLink
            ? new URL(pdfLink, config.baseUrl).toString()
            : config.url;

          // 除外条件（タイトル行など）
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
  } else if (config.parser === "kushiro") {
    // 釧路: テーブル形式
    $(config.selectors.eventRow).each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length === 0) return;

      const dateText = $(tds[config.selectors.dateColumn as number])
        .text()
        .trim();
      const name = $(tds[config.selectors.nameColumn as number])
        .text()
        .trim();
      const pdfLink = $(tds[config.selectors.pdfLinkColumn as number])
        .find("a")
        .attr("href");

      if (dateText && name) {
        const normalizedDate = dateText.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        );
        // 釧路: "4月29日(土)"
        // 4月29日(土)～30日(日)
        const dateMatch = normalizedDate.match(/(\d+)月(\d+)日/);

        if (dateMatch) {
          const year = 2025;
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
    const year = 2025;
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
    const year = 2025;
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
    const year = 2025;
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
  }

  return events;
}

function parseSapporo(
  scheduleHtml: string,
  guidelineHtml: string,
  config: SiteConfig
): ScrapedEventRaw[] {
  const events: ScrapedEventRaw[] = [];
  const $s = cheerio.load(scheduleHtml);
  const $g = cheerio.load(guidelineHtml);

  // 1. スケジュールから基本情報を取得
  const scheduleMap = new Map<string, { date: string; location: string }>();

  $s(config.selectors.eventRow).each((_, el) => {
    const tds = $s(el).find("td");
    if (tds.length < 5) return;

    const month = $s(tds[0]).text().trim(); // "4"
    const day = $s(tds[1]).text().trim(); // "29"
    // const wday = $s(tds[2]).text().trim();
    const name = $s(tds[3]).text().trim();
    const location = $s(tds[4]).text().trim();

    if (month && day && name) {
      // 日付の正規化 (範囲は対応が難しいので開始日のみ)
      const dayClean = day.split("～")[0].split("~")[0].replace(/\D/g, "");
      const year = 2025; // 簡易
      const dateStr = `${year}-${month.padStart(2, "0")}-${dayClean.padStart(
        2,
        "0"
      )}`;

      scheduleMap.set(name, { date: dateStr, location });
    }
  });

  // 2. 要項ページからPDFリンクと正式名称を取得し、スケジュール情報とマージ
  // 札幌陸協の構造: <h3 class="ttl-h3">大会名</h3> ... <ul class="link-list"><li><a>要項</a></li></ul>
  $g(".ttl-h3").each((_, el) => {
    const name = $g(el).text().trim();
    // 次のulを探す
    const nextUl = $g(el).nextAll("ul.link-list").first();
    const pdfLink = nextUl.find("a").attr("href"); // 最初のリンクを要項とみなす

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
    const year = 2025;

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

    const year = 2025;
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

        const year = 2025;
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
