import { describe, it, expect } from "vitest";
import {
  normalizeDisciplines,
  normalizeMaxEntries,
  normalizeString,
  normalizePdfResult,
} from "@/lib/pdfParser";

// ---------------------------------------------------------------------------
// normalizeDisciplines
// ---------------------------------------------------------------------------
describe("normalizeDisciplines", () => {
  it("配列はそのまま返す", () => {
    const arr = [{ name: "100m", grades: ["一般"] }];
    expect(normalizeDisciplines(arr)).toBe(arr);
  });

  it("{male:[], female:[]} をフラット配列にマージする", () => {
    const val = {
      male: [{ name: "100m", grades: ["一般男子"] }],
      female: [{ name: "100m", grades: ["一般女子"] }],
    };
    const result = normalizeDisciplines(val);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("100m");
    expect(result[0].grades).toEqual(expect.arrayContaining(["一般男子", "一般女子"]));
  });

  it("同名種目のgradesを統合しつつ重複除去する", () => {
    const val = {
      male: [{ name: "200m", grades: ["一般"] }],
      female: [{ name: "200m", grades: ["一般", "高校"] }],
    };
    const result = normalizeDisciplines(val);
    expect(result).toHaveLength(1);
    const grades = result[0].grades;
    expect(grades).toEqual(expect.arrayContaining(["一般", "高校"]));
    // 重複なし
    expect(new Set(grades).size).toBe(grades.length);
  });

  it("null を空配列にする", () => {
    expect(normalizeDisciplines(null)).toEqual([]);
  });

  it("空オブジェクトを空配列にする", () => {
    expect(normalizeDisciplines({})).toEqual([]);
  });

  it("nameなしエントリをスキップする", () => {
    const val = {
      male: [{ grades: ["一般"] }, { name: "100m", grades: [] }],
    };
    const result = normalizeDisciplines(val);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("100m");
  });

  it("noteを保持する", () => {
    const val = {
      events: [{ name: "砲丸投", grades: ["一般"], note: "4kg" }],
    };
    const result = normalizeDisciplines(val);
    expect(result).toHaveLength(1);
    expect(result[0].note).toBe("4kg");
  });
});

// ---------------------------------------------------------------------------
// normalizeMaxEntries
// ---------------------------------------------------------------------------
describe("normalizeMaxEntries", () => {
  it("数値はそのまま返す", () => {
    expect(normalizeMaxEntries(3)).toBe(3);
  });

  it("{individual: 3} から数値を抽出する", () => {
    expect(normalizeMaxEntries({ individual: 3 })).toBe(3);
  });

  it("individualが非数値の場合はundefined", () => {
    expect(normalizeMaxEntries({ individual: "three" })).toBeUndefined();
  });

  it("null はundefined", () => {
    expect(normalizeMaxEntries(null)).toBeUndefined();
  });

  it("undefined はundefined", () => {
    expect(normalizeMaxEntries(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeString
// ---------------------------------------------------------------------------
describe("normalizeString", () => {
  it("文字列はそのまま返す", () => {
    expect(normalizeString("hello")).toBe("hello");
  });

  it("null はundefined", () => {
    expect(normalizeString(null)).toBeUndefined();
  });

  it("undefined はundefined", () => {
    expect(normalizeString(undefined)).toBeUndefined();
  });

  it("オブジェクトの最初のstring値を返す", () => {
    expect(normalizeString({ date: "2025-04-01", num: 123 })).toBe("2025-04-01");
  });

  it("string値がないオブジェクトはJSON文字列にする", () => {
    const result = normalizeString({ a: 1, b: 2 });
    expect(result).toBe(JSON.stringify({ a: 1, b: 2 }));
  });

  it("数値はString変換する", () => {
    expect(normalizeString(42)).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// normalizePdfResult
// ---------------------------------------------------------------------------
describe("normalizePdfResult", () => {
  it("完全な入力を正しく変換する", () => {
    const raw = {
      location: "円山競技場",
      disciplines: [{ name: "100m", grades: ["一般"] }],
      maxEntries: 3,
      entryDeadline: "2025-04-01",
      note: "雨天決行",
    };
    const result = normalizePdfResult(raw);
    expect(result.location).toBe("円山競技場");
    expect(result.disciplines).toHaveLength(1);
    expect(result.maxEntries).toBe(3);
    expect(result.entryDeadline).toBe("2025-04-01");
    expect(result.note).toBe("雨天決行");
  });

  it("disciplinesがオブジェクト形式でもフラット化される", () => {
    const raw = {
      location: "円山",
      disciplines: {
        male: [{ name: "100m", grades: ["一般男子"] }],
        female: [{ name: "200m", grades: ["一般女子"] }],
      },
    };
    const result = normalizePdfResult(raw);
    expect(result.disciplines).toHaveLength(2);
  });

  it("locationがない場合は空文字になる", () => {
    const result = normalizePdfResult({});
    expect(result.location).toBe("");
    expect(result.disciplines).toEqual([]);
  });
});
