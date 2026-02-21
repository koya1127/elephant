import { describe, it, expect, vi } from "vitest";
import { parseEventsFromHtml } from "@/lib/scraper";
import {
  sorachiConfig,
  tokachiConfig,
  gakurenConfig,
  murorikaConfig,
  orkConfig,
  tomakomaiConfig,
} from "@/config/sites";

// LLM呼び出しをスタブ化（ネットワーク/API不要）
vi.mock("@/lib/pdfParser", () => ({
  parseSchedulePdfWithClaude: vi.fn().mockResolvedValue([]),
}));

// テスト用の年（CURRENT_YEAR に依存しないよう固定）
const YEAR = 2025;

// ---------------------------------------------------------------
// muroriku (室蘭)
// ---------------------------------------------------------------
describe("muroriku parser", () => {
  it("単日イベントをパースできる", async () => {
    const html = `<html><body>
      <p>2025年度陸上競技大会スケジュール</p>
      <p>6月8日（日）室蘭市陸上競技大会</p>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...murorikaConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-06-08");
    expect(events[0].name).toBe("室蘭市陸上競技大会");
  });

  it("複数日イベントを正しくパースできる", async () => {
    const html = `<html><body>
      <p>2025年度陸上競技大会スケジュール</p>
      <p>5月21日（水）～5月23日（金）高体連室蘭支部大会</p>
      <p>6月8日（日）室蘭市陸上競技大会</p>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...murorikaConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(2);
    expect(events[0].dateText).toBe("2025-05-21~2025-05-23");
    expect(events[0].name).toBe("高体連室蘭支部大会");
    expect(events[1].dateText).toBe("2025-06-08");
  });
});

// ---------------------------------------------------------------
// sorachi (空知) — rowspan テーブル
// ---------------------------------------------------------------
describe("sorachi parser", () => {
  it("テーブルから件数と日付をパースできる", async () => {
    const html = `<html><body><table>
      <tr><td>4</td><td>1</td><td>月</td><td>空知陸上春季大会</td><td><a href="test.pdf">要項</a></td><td></td></tr>
      <tr><td>2</td><td>火</td><td>空知記録会</td><td><a href="test2.pdf">要項</a></td><td></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...sorachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(2);
    expect(events[0].dateText).toBe("2025-04-01");
    expect(events[0].name).toBe("空知陸上春季大会");
    expect(events[1].dateText).toBe("2025-04-02");
    expect(events[1].name).toBe("空知記録会");
  });
});

// ---------------------------------------------------------------
// tokachi (十勝)
// ---------------------------------------------------------------
describe("tokachi parser", () => {
  it("テーブルから日付と大会名をパースできる", async () => {
    const html = `<html><body><table>
      <tr><td>3月22日(土)</td><td>春季記録会</td><td>帯広</td><td><a href="test.pdf">要項</a></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...tokachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-03-22");
    expect(events[0].name).toContain("春季記録会");
  });

  it("複数日イベント（～）をパースできる", async () => {
    const html = `<html><body><table>
      <tr><td>7月5日(土)～6日(日)</td><td>十勝選手権</td><td>帯広緑ヶ丘</td><td></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...tokachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-07-05~2025-07-06");
  });
});

// ---------------------------------------------------------------
// gakuren (学連) — M/D(曜) テキストパターン
// ---------------------------------------------------------------
describe("gakuren parser", () => {
  it("単日イベントをパースできる", async () => {
    const html = `<html><body>
      <p>5/3(土) 北海道学連競技会第1戦 @円山</p>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...gakurenConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-05-03");
    expect(events[0].name).toContain("北海道学連競技会第1戦");
  });

  it("跨日イベント（M/D～M/D形式）をパースできる", async () => {
    const html = `<html><body>
      <p>6/15(日)～6/16(月) 学連選手権 @北広島</p>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...gakurenConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-06-15~2025-06-16");
  });
});

// ---------------------------------------------------------------
// tomakomai (苫小牧) — 令和→西暦変換
// ---------------------------------------------------------------
describe("tomakomai parser", () => {
  it("令和7年を2025年に変換できる", async () => {
    const html = `<html><body>
      <div class="j-hgrid">
        <span style="font-size:22px;">苫小牧陸上春季大会</span>
        <span style="color:#ff0000;">開催日：令和7年4月20日</span>
      </div>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...tomakomaiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-04-20");
    expect(events[0].name).toBe("苫小牧陸上春季大会");
  });
});

// ---------------------------------------------------------------
// ork (オホーツク)
// ---------------------------------------------------------------
describe("ork parser", () => {
  it("テーブルから件数と日付をパースできる", async () => {
    const html = `<html><body>
      <h1>2025年度大会日程</h1>
      <table><tbody>
        <tr><td>4</td><td>20</td><td>日</td><td>オホーツク春季大会</td><td>網走</td><td></td></tr>
        <tr><td>9</td><td>6～7</td><td>土</td><td>オホーツク陸上選手権</td><td>北見</td><td></td></tr>
      </tbody></table>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...orkConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(2);
    expect(events[0].dateText).toBe("2025-04-20");
    expect(events[0].name).toContain("オホーツク春季大会");
    expect(events[1].dateText).toBe("2025-09-06~2025-09-07");
  });
});
