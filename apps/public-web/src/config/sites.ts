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

/** 全サイト定義 */
export const siteConfigs: SiteConfig[] = [sorachiConfig, kushiroConfig];
