import { describe, it, expect } from "vitest";
import {
  generateId,
  extractLocationFromName,
  normalizeName,
  isDuplicate,
  normalizeForDedup,
  pickKeeper,
  mergeEventInfo,
  deduplicateCrossSite,
} from "@/lib/event-utils";
import type { Event, ScrapeResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe("generateId", () => {
  it("基本: sourceId-date-slug を生成する", () => {
    expect(generateId("空知記録会", "2025-04-01", "sorachi"))
      .toBe("sorachi-2025-04-01-空知記録会");
  });

  it("特殊文字（スペース・記号）を除去する", () => {
    expect(generateId("第1回 空知大会！", "2025-05-01", "sorachi"))
      .toBe("sorachi-2025-05-01-第1回空知大会");
  });

  it("30文字で切り詰める", () => {
    const longName = "あ".repeat(40);
    const id = generateId(longName, "2025-01-01", "test");
    const slug = id.replace("test-2025-01-01-", "");
    expect(slug).toHaveLength(30);
  });

  it("空文字の名前でも動作する", () => {
    expect(generateId("", "2025-01-01", "test")).toBe("test-2025-01-01-");
  });
});

// ---------------------------------------------------------------------------
// extractLocationFromName
// ---------------------------------------------------------------------------
describe("extractLocationFromName", () => {
  it("全角スペースの後の場所名を抽出する", () => {
    expect(extractLocationFromName("空知陸上競技記録会 第1戦　深川")).toBe("深川");
  });

  it("半角スペースの後の場所名を抽出する", () => {
    expect(extractLocationFromName("記録会 札幌")).toBe("札幌");
  });

  it("場所名がない場合は空文字を返す", () => {
    expect(extractLocationFromName("空知陸上競技記録会")).toBe("");
  });

  it("複数スペースがある場合は最後のトークンを返す", () => {
    expect(extractLocationFromName("大会名 場所1　場所2")).toBe("場所2");
  });
});

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------
describe("normalizeName", () => {
  it("全角数字を半角に変換する", () => {
    expect(normalizeName("第１回大会")).toBe("第1回大会");
  });

  it("全角英字を半角に変換する", () => {
    expect(normalizeName("Ａクラス")).toBe("Aクラス");
  });

  it("スペース（半角・全角）を除去する", () => {
    expect(normalizeName("空知 記録会　第1戦")).toBe("空知記録会第1戦");
  });

  it("先頭の年号(2025等)を除去する", () => {
    expect(normalizeName("2025苫小牧記録会")).toBe("苫小牧記録会");
  });

  it("先頭以外の年号は除去しない", () => {
    expect(normalizeName("苫小牧2025記録会")).toBe("苫小牧2025記録会");
  });

  it("既に正規化済みの文字列はそのまま返す", () => {
    expect(normalizeName("空知記録会")).toBe("空知記録会");
  });
});

// ---------------------------------------------------------------------------
// normalizeForDedup
// ---------------------------------------------------------------------------
describe("normalizeForDedup", () => {
  it("コネクタ文字（兼・／）を除去する", () => {
    expect(normalizeForDedup("大会A兼大会B")).toBe("大会A大会B");
    expect(normalizeForDedup("大会A・大会B")).toBe("大会A大会B");
    expect(normalizeForDedup("大会A／大会B")).toBe("大会A大会B");
  });
});

// ---------------------------------------------------------------------------
// isDuplicate
// ---------------------------------------------------------------------------
describe("isDuplicate", () => {
  const makeEvent = (name: string, sourceId = "test", location = ""): Event => ({
    id: "test-id",
    name,
    date: "2025-06-01",
    location,
    disciplines: [],
    detailUrl: "",
    sourceId,
  });

  it("名前包含（10文字以上＋50%以上）で重複判定する", () => {
    const a = makeEvent("空知陸上競技記録会第2戦");
    const b = makeEvent("北海道空知陸上競技記録会第2戦", "hokkaido");
    expect(isDuplicate(a, b)).toBe(true);
  });

  it("短い名前（10文字未満）でも地域キーワード一致で重複になる（条件6）", () => {
    // "記録会第2戦"(sorachi) は5文字以上で longer に包含され、
    // sorachiの地域キーワード"空知"が longer に含まれるため条件6で重複
    const a = makeEvent("記録会第2戦", "sorachi");
    const b = makeEvent("空知陸上競技記録会第2戦", "hokkaido");
    expect(isDuplicate(a, b)).toBe(true);
  });

  it("短い名前で地域キーワードが含まれない場合は重複にならない", () => {
    // "test"サイトは地域キーワードがないので条件6に引っかからない
    const a = makeEvent("記録会第2戦", "test");
    const b = makeEvent("空知陸上競技記録会第2戦", "hokkaido");
    expect(isDuplicate(a, b)).toBe(false);
  });

  it("同じ場所 + 先頭6文字一致で重複判定する", () => {
    const a = makeEvent("空知陸上春季大会ABC", "sorachi", "深川");
    const b = makeEvent("空知陸上春季大会DEF", "hokkaido", "深川");
    expect(isDuplicate(a, b)).toBe(true);
  });

  it("日付が異なる場合は別イベント（deduplicateCrossSiteが日付でグループ化）", () => {
    // isDuplicate自体は日付を見ないが、deduplicateCrossSiteが日付グループ内でのみ呼ぶ
    const a = makeEvent("空知陸上競技記録会第2戦");
    const b = makeEvent("空知陸上競技記録会第2戦", "hokkaido");
    expect(isDuplicate(a, b)).toBe(true); // 名前は同じなので重複
  });

  it("完全に異なる名前は重複にならない", () => {
    const a = makeEvent("空知春季大会", "sorachi");
    const b = makeEvent("十勝選手権大会", "tokachi");
    expect(isDuplicate(a, b)).toBe(false);
  });

  it("長い共通プレフィックス（条件5）で重複判定する", () => {
    const a = makeEvent("道北記録会第3戦花咲スポーツ公園", "dohoku");
    const b = makeEvent("道北記録会第3戦旭川", "hokkaido");
    expect(isDuplicate(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pickKeeper
// ---------------------------------------------------------------------------
describe("pickKeeper", () => {
  const makeEntry = (event: Partial<Event>) => ({
    event: {
      id: "id", name: "name", date: "2025-01-01", location: "",
      disciplines: [], detailUrl: "", sourceId: "test", ...event,
    } as Event,
    result: { sourceId: "test", scrapedAt: "", events: [] } as ScrapeResult,
    index: 0,
    removed: false,
  });

  it("disciplines数が多い方をkeeperにする", () => {
    const a = makeEntry({ disciplines: [{ name: "100m", grades: [] }] });
    const b = makeEntry({ disciplines: [] });
    const [keeper, loser] = pickKeeper(a, b);
    expect(keeper).toBe(a);
    expect(loser).toBe(b);
  });

  it("location有りがスコアに加算される", () => {
    const a = makeEntry({ location: "円山" });
    const b = makeEntry({ location: "" });
    const [keeper] = pickKeeper(a, b);
    expect(keeper).toBe(a);
  });
});

// ---------------------------------------------------------------------------
// mergeEventInfo
// ---------------------------------------------------------------------------
describe("mergeEventInfo", () => {
  it("keeperに欠けている情報をloserから補完する", () => {
    const keeper: Event = {
      id: "k", name: "test", date: "2025-01-01", location: "",
      disciplines: [], detailUrl: "", sourceId: "a",
    };
    const loser: Event = {
      id: "l", name: "test", date: "2025-01-01", location: "円山",
      disciplines: [{ name: "100m", grades: [] }], detailUrl: "", sourceId: "b",
      entryDeadline: "2025-04-01", note: "備考",
    };
    mergeEventInfo(keeper, loser);
    expect(keeper.location).toBe("円山");
    expect(keeper.disciplines).toHaveLength(1);
    expect(keeper.entryDeadline).toBe("2025-04-01");
    expect(keeper.note).toBe("備考");
  });

  it("keeperに既にある情報は上書きしない", () => {
    const keeper: Event = {
      id: "k", name: "test", date: "2025-01-01", location: "深川",
      disciplines: [{ name: "200m", grades: [] }], detailUrl: "", sourceId: "a",
    };
    const loser: Event = {
      id: "l", name: "test", date: "2025-01-01", location: "円山",
      disciplines: [{ name: "100m", grades: [] }], detailUrl: "", sourceId: "b",
    };
    mergeEventInfo(keeper, loser);
    expect(keeper.location).toBe("深川");
    expect(keeper.disciplines[0].name).toBe("200m");
  });
});

// ---------------------------------------------------------------------------
// deduplicateCrossSite
// ---------------------------------------------------------------------------
describe("deduplicateCrossSite", () => {
  it("異なるsourceIdの重複イベントを除去する", () => {
    const results: ScrapeResult[] = [
      {
        sourceId: "sorachi",
        scrapedAt: "",
        events: [{
          id: "s1", name: "空知陸上競技記録会第2戦", date: "2025-06-01",
          location: "深川", disciplines: [{ name: "100m", grades: [] }],
          detailUrl: "", sourceId: "sorachi",
        }],
      },
    ];
    const existing: ScrapeResult[] = [
      {
        sourceId: "hokkaido",
        scrapedAt: "",
        events: [{
          id: "h1", name: "北海道空知陸上競技記録会第2戦", date: "2025-06-01",
          location: "", disciplines: [], detailUrl: "", sourceId: "hokkaido",
        }],
      },
    ];
    deduplicateCrossSite(results, existing);
    // sorachiの方がdisciplinesが多いのでkeeper、hokkaidoがloserで除去
    expect(results[0].events).toHaveLength(1);
    expect(existing[0].events).toHaveLength(0);
  });

  it("同じsourceIdのイベントは重複除去しない", () => {
    const results: ScrapeResult[] = [
      {
        sourceId: "sorachi",
        scrapedAt: "",
        events: [
          { id: "s1", name: "空知陸上記録会", date: "2025-06-01", location: "", disciplines: [], detailUrl: "", sourceId: "sorachi" },
          { id: "s2", name: "空知陸上記録会", date: "2025-06-01", location: "", disciplines: [], detailUrl: "", sourceId: "sorachi" },
        ],
      },
    ];
    deduplicateCrossSite(results, []);
    expect(results[0].events).toHaveLength(2);
  });

  it("日付が異なるイベントは重複除去しない", () => {
    const results: ScrapeResult[] = [
      {
        sourceId: "sorachi",
        scrapedAt: "",
        events: [{ id: "s1", name: "空知陸上競技記録会第2戦", date: "2025-06-01", location: "", disciplines: [], detailUrl: "", sourceId: "sorachi" }],
      },
    ];
    const existing: ScrapeResult[] = [
      {
        sourceId: "hokkaido",
        scrapedAt: "",
        events: [{ id: "h1", name: "空知陸上競技記録会第2戦", date: "2025-06-02", location: "", disciplines: [], detailUrl: "", sourceId: "hokkaido" }],
      },
    ];
    deduplicateCrossSite(results, existing);
    expect(results[0].events).toHaveLength(1);
    expect(existing[0].events).toHaveLength(1);
  });
});
