import type { Event } from "./types";

/** 競技場マッピング: event.location / event.name からマッチ */
export const VENUE_MAP: { id: string; label: string; keywords: string[] }[] = [
  { id: "maruyama", label: "円山", keywords: ["円山"] },
  { id: "hanasaki", label: "花咲", keywords: ["花咲"] },
  { id: "aoba", label: "青葉(千歳)", keywords: ["青葉"] },
  { id: "obihiro", label: "帯広の森", keywords: ["帯広の森"] },
  { id: "irie", label: "入江(室蘭)", keywords: ["入江"] },
  { id: "chiyodai", label: "千代台(函館)", keywords: ["千代台"] },
  { id: "midorigaoka", label: "緑が丘(苫小牧)", keywords: ["緑が丘", "ヤクルト"] },
  { id: "shibetsu", label: "士別", keywords: ["士別"] },
  { id: "kushiro", label: "釧路", keywords: ["釧路市民"] },
  { id: "abashiri", label: "網走", keywords: ["網走"] },
  { id: "kitami", label: "北見(東陵)", keywords: ["東陵", "北見市"] },
  { id: "fukagawa", label: "深川", keywords: ["深川市"] },
  { id: "iwamizawa", label: "岩見沢", keywords: ["岩見沢", "東山公園"] },
  { id: "hamanaka", label: "浜中(留萌)", keywords: ["浜中"] },
  { id: "atsuma", label: "厚真", keywords: ["厚真"] },
  { id: "shintoku", label: "新得", keywords: ["新得"] },
  { id: "oval", label: "明治オーバル(帯広)", keywords: ["オーバル"] },
];

export function matchVenue(event: Event): string | null {
  const text = `${event.location || ""} ${event.name}`;
  for (const venue of VENUE_MAP) {
    if (venue.keywords.some((kw) => text.includes(kw))) return venue.id;
  }
  return null;
}

/** グレードを5大カテゴリに正規化 */
export function normalizeGradeCategory(raw: string): string {
  const s = raw.trim();
  if (/マスターズ/.test(s)) return "マスターズ";
  if (/小学|小\d/.test(s)) return "小学生";
  if (/中学|中\d/.test(s)) return "中学";
  if (/高校/.test(s)) return "高校";
  return "一般";
}

/** 種目ソート用スコア: トラック短距離→長距離→ハードル→フィールド→その他 */
export function disciplineSortKey(name: string): number {
  const distMatch = name.match(/^(\d+)m$/);
  if (distMatch) return Number(distMatch[1]);

  const hurdleMatch = name.match(/^(\d+)m?H/i);
  if (hurdleMatch) return 10000 + Number(hurdleMatch[1]);
  if (/ハードル|YH/i.test(name)) return 10500;

  if (/SC/.test(name)) return 11000;
  if (/リレー|×.*R$|R$/.test(name)) return 12000;
  if (/競歩|W$/.test(name)) return 13000;
  if (/駅伝/.test(name)) return 13500;

  if (/走高/.test(name)) return 20000;
  if (/棒高/.test(name)) return 20100;
  if (/走幅/.test(name)) return 20200;
  if (/三段跳/.test(name)) return 20300;
  if (/跳/.test(name)) return 20400;

  if (/砲丸/.test(name)) return 21000;
  if (/円盤/.test(name)) return 21100;
  if (/ハンマー/.test(name)) return 21200;
  if (/やり投/.test(name)) return 21300;
  if (/ジャベリック/.test(name)) return 21400;
  if (/投/.test(name)) return 21500;

  if (/コンバインド|混成|八種|十種|七種|四種|五種/.test(name)) return 22000;

  return 30000;
}

/**
 * 種目名正規化（性別/学年プレフィックス除去、全角変換）
 */
export function normalizeDiscipline(name: string): string {
  let n = name;

  // Normalize full-width characters (numbers and letters)
  n = n.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  n = n.replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

  // Explicitly replace full-width chars that might be missed or specific units
  n = n.replace(/ｍ/g, "m");
  n = n.replace(/Ｈ/g, "H");
  n = n.replace(/Ｗ/g, "W");
  n = n.replace(/Ｒ/g, "R");

  // Remove common prefixes/suffixes
  n = n.replace(/^(男子|女子|混合|男女)/, "");
  n = n.replace(/^(小学|中学|高校|一般|共通|小|中|高|大|マス|壮年)/, "");
  n = n.replace(/^(\d+年)/, "");
  n = n.replace(/-/, "");
  n = n.replace(/^[小中高](\d+)[-]?/, "");
  n = n.replace(/^[小中高]/, "");
  n = n.replace(/\(.*\)/, "");
  n = n.trim();
  return n;
}

/** Blobに保存済みのデータが想定外の形式でも安全に表示できるよう正規化 */
export function sanitizeEvent(event: Event): Event {
  let disciplines = event.disciplines;
  if (!Array.isArray(disciplines)) {
    // {male:[...], female:[...]} のようなオブジェクト → フラット配列化
    if (disciplines && typeof disciplines === "object") {
      disciplines = Object.values(disciplines as Record<string, unknown>).flat() as typeof disciplines;
    } else {
      disciplines = [];
    }
  }
  return { ...event, disciplines };
}

export function groupByMonth(events: Event[]): Record<string, Event[]> {
  const groups: Record<string, Event[]> = {};
  for (const event of events) {
    const [y, m] = event.date.split("-");
    const key = `${y}年${parseInt(m)}月`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }
  return groups;
}
