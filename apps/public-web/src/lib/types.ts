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
  /** PDFファイルサイズ（バイト数、差分解析用） */
  pdfSize?: number;
  /** 参加費（JPY） */
  fee?: number;
  /** 実績費用（大会後に管理者入力） */
  actualFee?: number;
  /** 参加費のソース: 'pdf' | 'manual' */
  feeSource?: string;
}

/** エントリー情報 */
export interface Entry {
  /** 一意なID */
  id: string;
  /** Clerk User ID */
  userId: string;
  /** Event.id */
  eventId: string;
  /** Event.name */
  eventName: string;
  /** Event.date */
  eventDate: string;
  /** 選択した種目名 */
  disciplines: string[];
  /** ステータス */
  status: "submitted" | "pending_payment";
  /** 参加費として支払った額 */
  feePaid?: number;
  /** 手数料として支払った額 */
  serviceFeePaid?: number;
  /** Stripe Checkout Session ID */
  stripeSessionId?: string;
  /** 作成日時（ISO string） */
  createdAt: string;
}

/** 施設情報（競技場マップ） */
export type VenueType = "stadium" | "practice" | "powermax";

export interface Venue {
  id: string;
  type: VenueType;
  name: string;
  description?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  keywords?: string[];
  url?: string | null;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
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

/** サイトのHTMLパーサータイプ */
export type SiteParserType = "sorachi" | "kushiro" | "douo" | "sapporo" | "hokkaido"
  | "tokachi" | "chuutairen" | "koutairen" | "gakuren" | "masters" | "runnet" | "tomakomai"
  | "dohoku" | "donan" | "osrk" | "muroriku" | "ork";

/** サイト定義 */
export interface SiteConfig {
  /** サイトID */
  id: string;
  /** サイト名 */
  name: string;
  /** スクレイピング対象URL */
  url: string;
  /** スケジュールPDF一覧ページURL（北海道など） */
  scheduleUrl?: string;
  /** ベースURL（相対パス解決用） */
  baseUrl: string;
  /** 文字エンコーディング（デフォルト: utf-8） */
  encoding?: string;
  /** HTMLパーサータイプ */
  parser: SiteParserType;
  /** 要項ページURL（札幌用：2段階スクレイピング） */
  guidelineUrl?: string;
  /** Cloudflare保護回避のためcurl経由でHTMLを取得する */
  useCurl?: boolean;
  /** フォールバック時に設定される実効年（パーサーで使用） */
  effectiveYear?: number;
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

/** 年別の健康診断データ */
export interface YearHealth {
  year: number;
  eventCount: number;
  pdfTotal: number;
  pdfOk: number;
  pdfErrors: string[];
}

/** サイト健康診断結果 */
export interface SiteHealthResult {
  siteId: string;
  siteName: string;
  checkedAt: string;
  years: YearHealth[];
  error?: string;
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
