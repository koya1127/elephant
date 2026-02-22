import { describe, it, expect, vi } from "vitest";
import { parseEventsFromHtml, detectYearFromContent } from "@/lib/scraper";
import {
  sorachiConfig,
  kushiroConfig,
  douoConfig,
  tokachiConfig,
  chuutairenConfig,
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
// エッジケース（汎用）
// ---------------------------------------------------------------
describe("エッジケース", () => {
  it("空のHTMLは0件を返す", async () => {
    const events = await parseEventsFromHtml("<html><body></body></html>", {
      ...sorachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(0);
  });

  it("全角数字の月日を正しく半角変換する（sorachi）", async () => {
    const html = `<html><body><table>
      <tr><td>４</td><td>１</td><td>月</td><td>全角テスト大会</td><td></td><td></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...sorachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-04-01");
  });

  it("【終了】マークを大会名から除去する（muroriku）", async () => {
    const html = `<html><body>
      <p>2025年度陸上競技大会スケジュール</p>
      <p>6月8日（日）室蘭市陸上競技大会【終了】</p>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...murorikaConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("室蘭市陸上競技大会");
  });
});

// ---------------------------------------------------------------
// muroriku (室蘭) — Wix、<p>ごとにパース
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

  it("複数日イベント（～M月D日形式）を正しくパースできる", async () => {
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
  it("月の最初の行と続き行を正しくパースできる", async () => {
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

  it("「大会名」ヘッダー行をスキップする", async () => {
    const html = `<html><body><table>
      <tr><td>4</td><td>1</td><td>月</td><td>大会名</td><td></td><td></td></tr>
      <tr><td>2</td><td>火</td><td>空知記録会</td><td></td><td></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...sorachiConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------
// kushiro (釧路) — <th>に日付、<td>に大会名
// ---------------------------------------------------------------
describe("kushiro parser", () => {
  it("単日イベントをパースできる", async () => {
    const html = `<html><body><table>
      <tr><th>4月29日(土)</th><td>釧路春季記録会</td><td><a href="test.pdf">要項</a></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...kushiroConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-04-29");
    expect(events[0].name).toBe("釧路春季記録会");
  });

  it("複数日イベント（～D日形式）をパースできる", async () => {
    const html = `<html><body><table>
      <tr><th>5月10日(土)～11日(日)</th><td>釧路選手権</td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...kushiroConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-05-10~2025-05-11");
  });
});

// ---------------------------------------------------------------
// douo (道央) — Jimdo、.j-module.n.j-text p から正規表現
// ---------------------------------------------------------------
describe("douo parser", () => {
  it("単日イベントをパースできる", async () => {
    const html = `<html><body>
      <div class="j-module n j-text">
        <p>2025年 4月19日（土） 道央春季記録会</p>
      </div>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...douoConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-04-19");
    expect(events[0].name).toBe("道央春季記録会");
  });

  it("複数日イベント（～D日形式）をパースできる", async () => {
    const html = `<html><body>
      <div class="j-module n j-text">
        <p>2025年 5月17日（土）～18日 道央陸上選手権</p>
      </div>
    </body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...douoConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-05-17~2025-05-18");
    expect(events[0].name).toBe("道央陸上選手権");
  });
});

// ---------------------------------------------------------------
// tokachi (十勝) — テーブル形式
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

  it("複数日イベント（～D日形式）をパースできる", async () => {
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
// chuutairen (中体連) — テーブル形式、ヘッダースキップ
// ---------------------------------------------------------------
describe("chuutairen parser", () => {
  it("ヘッダー行（大会名）をスキップして正しく1件だけパースできる", async () => {
    const html = `<html><body><table>
      <tr><td>期日</td><td>大会名</td><td>開催地</td></tr>
      <tr><td>5月3日(土)</td><td>中体連春季大会</td><td>函館</td><td><a href="test.pdf">要項</a></td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...chuutairenConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-05-03");
    expect(events[0].name).toContain("中体連春季大会");
  });

  it("複数日イベント（～形式）をパースできる", async () => {
    const html = `<html><body><table>
      <tr><td>8月1日(金)〜3日(日)</td><td>全道中学陸上</td><td>札幌</td></tr>
    </table></body></html>`;
    const events = await parseEventsFromHtml(html, {
      ...chuutairenConfig,
      effectiveYear: YEAR,
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateText).toBe("2025-08-01~2025-08-03");
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
// tomakomai (苫小牧) — Jimdo Creator、令和→西暦変換
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
// ork (オホーツク) — テーブル、月と日が別セル
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

// ---------------------------------------------------------------
// detectYearFromContent — HTMLから年を自動検出
// ---------------------------------------------------------------
describe("detectYearFromContent", () => {
  it("「2025年度」が複数あれば2025を返す", () => {
    const html = `<p>2025年度陸上競技スケジュール</p><p>2025年度第1回記録会</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2025);
  });

  it("「令和7年」→ 2025を返す", () => {
    const html = `<p>令和7年度大会日程</p><p>令和7年4月20日開催</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2025);
  });

  it("年パターンなし → defaultYearを返す", () => {
    const html = `<p>大会スケジュール一覧</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2026);
  });

  it("混在時は最頻出を返す", () => {
    const html = `<p>2025年度スケジュール</p><p>2025年5月大会</p><p>2026年1月記録会</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2025);
  });

  it("現在年のコンテンツならdefaultYearと同じ値を返す", () => {
    const html = `<p>2026年度大会日程</p><p>2026年4月記録会</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2026);
  });

  it("範囲外の年は無視する", () => {
    const html = `<p>2020年の記録</p><p>2025年度スケジュール</p>`;
    expect(detectYearFromContent(html, 2026)).toBe(2025);
  });
});
