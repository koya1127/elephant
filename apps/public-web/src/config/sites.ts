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
  scheduleUrl: "https://hokkaido-rikkyo.jp/schedule/index.html",
  baseUrl: "https://www.hokkaido-rikkyo.jp/",
  parser: "hokkaido",
  selectors: {
    eventRow: "h3",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/**
 * 十勝陸上競技協会
 * HTML: Shift_JIS, テーブル形式（日付/大会名/会場/要項PDF）
 */
export const tokachiConfig: SiteConfig = {
  id: "tokachi",
  name: "十勝陸上競技協会",
  url: "https://tokachi-tf.sakura.ne.jp/2025/kako2025.html",
  baseUrl: "https://tokachi-tf.sakura.ne.jp/2025/",
  encoding: "shift_jis",
  parser: "tokachi",
  selectors: {
    eventRow: "table tr",
    nameColumn: 1,
    dateColumn: 0,
    pdfLinkColumn: 3,
  },
};

/**
 * 北海道中学体育連盟（中体連）
 * HTML: Shift_JIS, テーブル形式（期日/大会名/開催地/要項/詳細）
 */
export const chuutairenConfig: SiteConfig = {
  id: "chuutairen",
  name: "北海道中学体育連盟",
  url: "https://hokkaido-rikkyo.jp/do/games.html",
  baseUrl: "https://hokkaido-rikkyo.jp/do/",
  encoding: "shift_jis",
  parser: "chuutairen",
  selectors: {
    eventRow: "table tr",
    nameColumn: 1,
    dateColumn: 0,
    pdfLinkColumn: 3,
  },
};

/**
 * 北海道高等学校体育連盟陸上競技専門部（高体連）
 * HTML: UTF-8, 大会日程ページにスケジュールPDFが1つ → Claude APIで解析
 */
export const koutairenConfig: SiteConfig = {
  id: "koutairen",
  name: "北海道高体連陸上競技専門部",
  url: "https://www.doukoutairen-rikujyou.com/%E5%A4%A7%E4%BC%9A%E6%97%A5%E7%A8%8B/",
  baseUrl: "https://www.doukoutairen-rikujyou.com/",
  parser: "koutairen",
  selectors: {
    eventRow: "",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/**
 * 北海道学生陸上競技連盟（学連）
 * HTML: UTF-8, Google Sites Classicのテキスト＋リンク
 */
export const gakurenConfig: SiteConfig = {
  id: "gakuren",
  name: "北海道学生陸上競技連盟",
  url: "https://sites.google.com/site/hokkaidogakuren2016/%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1",
  baseUrl: "https://sites.google.com/",
  parser: "gakuren",
  selectors: {
    eventRow: "",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/**
 * 北海道マスターズ陸上競技連盟
 * HTML: UTF-8, schedule.php + news.php
 */
export const mastersConfig: SiteConfig = {
  id: "masters",
  name: "北海道マスターズ陸上競技連盟",
  url: "https://hokkaido-masters.jp/schedule.php",
  baseUrl: "https://hokkaido-masters.jp/",
  parser: "masters",
  selectors: {
    eventRow: "",
    nameColumn: 0,
    dateColumn: 0,
  },
};

/**
 * ランネット（北海道のマラソン・ロードレース）
 * HTML: UTF-8, 検索結果ページ
 */
export const runnetConfig: SiteConfig = {
  id: "runnet",
  name: "ランネット（北海道）",
  url: "https://runnet.jp/entry/runtes/user/pc/RaceSearchZZSDetailAction.do?command=search&prefectureIds=01",
  baseUrl: "https://runnet.jp/",
  parser: "runnet",
  selectors: {
    eventRow: "",
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
  tokachiConfig,
  chuutairenConfig,
  koutairenConfig,
  gakurenConfig,
  mastersConfig,
  runnetConfig,
];
