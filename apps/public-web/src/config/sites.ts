import type { SiteConfig } from "@/lib/types";

/**
 * 空知陸上競技協会
 * HTML: Shift_JIS, テーブル形式（月/日/曜日/大会名/要項PDF/申込書）
 */
export const sorachiConfig: SiteConfig = {
  id: "sorachi",
  name: "空知陸上競技協会",
  url: "https://sorachi-rikkyo.com/event/2025/requirements.html",
  baseUrl: "https://sorachi-rikkyo.com/event/2025/",
  encoding: "shift_jis",
  parser: "sorachi",
  selectors: {
    eventRow: "table tr",
    nameColumn: 3,
    dateColumn: 1,
    pdfLinkColumn: 4,
  },
};

/**
 * 釧路地方陸上競技協会
 * HTML: UTF-8, テーブル形式（日付/大会名/書類リンク）
 */
export const kushiroConfig: SiteConfig = {
  id: "kushiro",
  name: "釧路地方陸上競技協会",
  url: "https://kushirorikujo.com/r7competitionschedule.html",
  baseUrl: "https://kushirorikujo.com/",
  parser: "kushiro",
  selectors: {
    eventRow: "table tr",
    nameColumn: 1,
    dateColumn: 0,
    pdfLinkColumn: 2,
  },
};

/**
 * 道央陸上競技協会
 * HTML: UTF-8, Jimdoサイト（window.__WEBSITE_PROPS__ JSON内にデータ）
 * 403対策: User-Agentヘッダー必須
 */
export const douoConfig: SiteConfig = {
  id: "douo",
  name: "道央陸上競技協会",
  url: "https://www.douo-tandf.com/%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1/",
  baseUrl: "https://www.douo-tandf.com/",
  parser: "douo",
  useCurl: true,
  selectors: {
    eventRow: "",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/**
 * 札幌陸上競技協会
 * スケジュール + 要項の2段階スクレイピング
 * スケジュール: table.nomal-table（月/日/曜/大会名/会場）
 * 要項: h3大会名 + ul>li>a PDFリンク
 */
export const sapporoConfig: SiteConfig = {
  id: "sapporo",
  name: "札幌陸上競技協会",
  url: "https://jaaf-sapporo.jp/schedule/index.html",
  baseUrl: "https://jaaf-sapporo.jp/",
  guidelineUrl: "https://jaaf-sapporo.jp/guideline/index.html",
  parser: "sapporo",
  selectors: {
    eventRow: "table.nomal-table tr",
    nameColumn: "td.name",
    dateColumn: 0,
  },
};

/**
 * 北海道陸上競技協会
 * HTML: UTF-8, セマンティックHTML（h3大会名 → dl>dt/dd）
 */
export const hokkaidoConfig: SiteConfig = {
  id: "hokkaido",
  name: "北海道陸上競技協会",
  url: "https://www.hokkaido-rikkyo.jp/information/index.html",
  baseUrl: "https://www.hokkaido-rikkyo.jp/",
  parser: "hokkaido",
  selectors: {
    eventRow: "h3",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/** 全サイト定義 */
export const siteConfigs: SiteConfig[] = [
  sorachiConfig,
  kushiroConfig,
  douoConfig,
  sapporoConfig,
  hokkaidoConfig,
];
