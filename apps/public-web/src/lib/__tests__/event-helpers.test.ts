import { describe, it, expect } from "vitest";
import {
  VENUE_MAP,
  matchVenue,
  normalizeGradeCategory,
  disciplineSortKey,
  normalizeDiscipline,
  sanitizeEvent,
  groupByMonth,
} from "@/lib/event-helpers";
import type { Event } from "@/lib/types";

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "test-id",
  name: "テスト大会",
  date: "2025-06-01",
  location: "",
  disciplines: [],
  detailUrl: "",
  sourceId: "test",
  ...overrides,
});

// ---------------------------------------------------------------------------
// disciplineSortKey
// ---------------------------------------------------------------------------
describe("disciplineSortKey", () => {
  it("短距離: 100m → 100", () => {
    expect(disciplineSortKey("100m")).toBe(100);
  });

  it("短距離: 200m → 200", () => {
    expect(disciplineSortKey("200m")).toBe(200);
  });

  it("ハードル: 110mH → 10110", () => {
    expect(disciplineSortKey("110mH")).toBe(10110);
  });

  it("ハードルキーワード → 10500", () => {
    expect(disciplineSortKey("ハードル")).toBe(10500);
  });

  it("SC → 11000", () => {
    expect(disciplineSortKey("3000mSC")).toBe(11000);
  });

  it("リレー → 12000", () => {
    expect(disciplineSortKey("4×100mR")).toBe(12000);
  });

  it("競歩 → 13000", () => {
    expect(disciplineSortKey("5000m競歩")).toBe(13000);
  });

  it("走高跳 → 20000", () => {
    expect(disciplineSortKey("走高跳")).toBe(20000);
  });

  it("走幅跳 → 20200", () => {
    expect(disciplineSortKey("走幅跳")).toBe(20200);
  });

  it("砲丸投 → 21000", () => {
    expect(disciplineSortKey("砲丸投")).toBe(21000);
  });

  it("やり投 → 21300", () => {
    expect(disciplineSortKey("やり投")).toBe(21300);
  });

  it("混成 → 22000", () => {
    expect(disciplineSortKey("八種競技")).toBe(22000);
  });

  it("不明 → 30000", () => {
    expect(disciplineSortKey("不明な種目")).toBe(30000);
  });

  it("ソート順: 短距離 < ハードル < 跳躍 < 投擲 < 混成", () => {
    expect(disciplineSortKey("100m")).toBeLessThan(disciplineSortKey("110mH"));
    expect(disciplineSortKey("110mH")).toBeLessThan(disciplineSortKey("走高跳"));
    expect(disciplineSortKey("走高跳")).toBeLessThan(disciplineSortKey("砲丸投"));
    expect(disciplineSortKey("砲丸投")).toBeLessThan(disciplineSortKey("八種競技"));
  });
});

// ---------------------------------------------------------------------------
// normalizeGradeCategory
// ---------------------------------------------------------------------------
describe("normalizeGradeCategory", () => {
  it("一般男子 → 一般", () => {
    expect(normalizeGradeCategory("一般男子")).toBe("一般");
  });

  it("中学女子 → 中学", () => {
    expect(normalizeGradeCategory("中学女子")).toBe("中学");
  });

  it("中3 → 中学", () => {
    expect(normalizeGradeCategory("中3")).toBe("中学");
  });

  it("小学4年 → 小学生", () => {
    expect(normalizeGradeCategory("小学4年")).toBe("小学生");
  });

  it("小4 → 小学生", () => {
    expect(normalizeGradeCategory("小4")).toBe("小学生");
  });

  it("高校 → 高校", () => {
    expect(normalizeGradeCategory("高校")).toBe("高校");
  });

  it("マスターズ → マスターズ", () => {
    expect(normalizeGradeCategory("マスターズ")).toBe("マスターズ");
  });

  it("空文字 → 一般", () => {
    expect(normalizeGradeCategory("")).toBe("一般");
  });

  it("前後のスペースを除去して判定", () => {
    expect(normalizeGradeCategory("  高校  ")).toBe("高校");
  });
});

// ---------------------------------------------------------------------------
// normalizeDiscipline
// ---------------------------------------------------------------------------
describe("normalizeDiscipline", () => {
  it("男子100m → 100m", () => {
    expect(normalizeDiscipline("男子100m")).toBe("100m");
  });

  it("全角１００ｍ → 100m", () => {
    expect(normalizeDiscipline("１００ｍ")).toBe("100m");
  });

  it("中2-100m → 2100m（中を除去、数字+ハイフンは残る）", () => {
    // "中" が除去され "2-100m" → ハイフン除去で "2100m"
    expect(normalizeDiscipline("中2-100m")).toBe("2100m");
  });

  it("小100m → 100m（学校プレフィックス除去）", () => {
    expect(normalizeDiscipline("小100m")).toBe("100m");
  });

  it("括弧を除去する", () => {
    expect(normalizeDiscipline("砲丸投(4kg)")).toBe("砲丸投");
  });

  it("女子 prefix を除去する", () => {
    expect(normalizeDiscipline("女子走幅跳")).toBe("走幅跳");
  });

  it("すでに正規化された種目名はそのまま", () => {
    expect(normalizeDiscipline("100m")).toBe("100m");
  });

  it("全角Ｈ → H", () => {
    expect(normalizeDiscipline("１１０ｍＨ")).toBe("110mH");
  });
});

// ---------------------------------------------------------------------------
// matchVenue
// ---------------------------------------------------------------------------
describe("matchVenue", () => {
  it("locationで一致する", () => {
    const event = makeEvent({ location: "円山競技場" });
    expect(matchVenue(event)).toBe("maruyama");
  });

  it("nameで一致する", () => {
    const event = makeEvent({ name: "花咲スポーツ公園記録会" });
    expect(matchVenue(event)).toBe("hanasaki");
  });

  it("一致なし → null", () => {
    const event = makeEvent({ name: "どこか大会", location: "" });
    expect(matchVenue(event)).toBeNull();
  });

  it("複数キーワードのうち1つが一致すればOK", () => {
    const event = makeEvent({ location: "ヤクルトスタジアム" });
    expect(matchVenue(event)).toBe("midorigaoka");
  });

  it("VENUE_MAPに全17会場が定義されている", () => {
    expect(VENUE_MAP).toHaveLength(17);
  });
});

// ---------------------------------------------------------------------------
// sanitizeEvent
// ---------------------------------------------------------------------------
describe("sanitizeEvent", () => {
  it("配列disciplinesはそのまま", () => {
    const event = makeEvent({ disciplines: [{ name: "100m", grades: [] }] });
    const result = sanitizeEvent(event);
    expect(result.disciplines).toHaveLength(1);
  });

  it("オブジェクトdisciplinesをフラット配列に変換する", () => {
    const event = makeEvent();
    // @ts-expect-error テスト用にオブジェクト形式を設定
    event.disciplines = { male: [{ name: "100m", grades: [] }], female: [{ name: "200m", grades: [] }] };
    const result = sanitizeEvent(event);
    expect(Array.isArray(result.disciplines)).toBe(true);
    expect(result.disciplines).toHaveLength(2);
  });

  it("null disciplinesを空配列にする", () => {
    const event = makeEvent();
    // @ts-expect-error テスト用にnullを設定
    event.disciplines = null;
    const result = sanitizeEvent(event);
    expect(result.disciplines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// groupByMonth
// ---------------------------------------------------------------------------
describe("groupByMonth", () => {
  it("同月のイベントをグループ化する", () => {
    const events = [
      makeEvent({ date: "2025-06-01" }),
      makeEvent({ date: "2025-06-15" }),
      makeEvent({ date: "2025-07-01" }),
    ];
    const groups = groupByMonth(events);
    expect(Object.keys(groups)).toEqual(["2025年6月", "2025年7月"]);
    expect(groups["2025年6月"]).toHaveLength(2);
    expect(groups["2025年7月"]).toHaveLength(1);
  });

  it("月番号にゼロ埋めなし（4月 not 04月）", () => {
    const events = [makeEvent({ date: "2025-04-01" })];
    const groups = groupByMonth(events);
    expect(Object.keys(groups)).toEqual(["2025年4月"]);
  });

  it("空配列は空オブジェクト", () => {
    expect(groupByMonth([])).toEqual({});
  });
});
