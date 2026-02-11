/** 種目のグレード（対象カテゴリ） */
export type DisciplineGrade =
  | "一般"
  | "高校"
  | "中学"
  | "小学生"
  | "マスターズ"
  | string;

/** 種目情報 */
export interface Discipline {
  /** 種目名（例: "100m", "走幅跳"） */
  name: string;
  /** 対象グレード一覧 */
  grades: DisciplineGrade[];
  /** 備考 */
  note?: string;
}

/** 大会情報 */
export interface Event {
  /** 一意なID（大会名+日付から生成） */
  id: string;
  /** 大会名 */
  name: string;
  /** 開催日（YYYY-MM-DD） */
  date: string;
  /** 開催日（終了日、複数日開催の場合） */
  dateEnd?: string;
  /** 開催場所 */
  location: string;
  /** 種目一覧 */
  disciplines: Discipline[];
  /** エントリー可能な種目数 */
  maxEntries?: number;
  /** 詳細リンク（元PDF or ページURL） */
  detailUrl: string;
  /** データ取得元サイトのID */
  sourceId: string;
  /** エントリー締切日 */
  entryDeadline?: string;
  /** 備考 */
  note?: string;
}

/** スクレイピングで取得した大会の生データ（PDFリンク含む） */
export interface ScrapedEventRaw {
  /** 大会名 */
  name: string;
  /** 日付テキスト（パース前） */
  dateText: string;
  /** PDFリンクURL */
  pdfUrl?: string;
  /** 詳細ページURL */
  detailUrl?: string;
}

/** サイト定義 */
export interface SiteConfig {
  /** サイトID */
  id: string;
  /** サイト名 */
  name: string;
  /** スクレイピング対象URL */
  url: string;
  /** ベースURL（相対パス解決用） */
  baseUrl: string;
  /** HTMLからイベント一覧を抽出するためのセレクタ設定 */
  selectors: {
    /** イベント行のセレクタ */
    eventRow: string;
    /** 大会名カラムのインデックス or セレクタ */
    nameColumn: number | string;
    /** 日付カラムのインデックス or セレクタ */
    dateColumn: number | string;
    /** PDFリンクがあるカラムのインデックス or セレクタ */
    pdfLinkColumn?: number | string;
  };
}

/** スクレイピング結果全体 */
export interface ScrapeResult {
  /** 取得元サイトID */
  sourceId: string;
  /** 取得日時 */
  scrapedAt: string;
  /** 大会一覧 */
  events: Event[];
}
