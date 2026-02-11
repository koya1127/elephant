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
  selectors: {
    eventRow: "table tr",
    nameColumn: 3,
    dateColumn: 1,
    pdfLinkColumn: 4,
  },
};

/** 全サイト定義 */
export const siteConfigs: SiteConfig[] = [sorachiConfig];
