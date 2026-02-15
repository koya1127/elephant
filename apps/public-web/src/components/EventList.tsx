"use client";

import { useState, useEffect, useMemo } from "react";
import type { Event, ScrapeResult } from "@/lib/types";
import { EventCard } from "./EventCard";
import styles from "./EventList.module.css";

/** グレードを5大カテゴリに正規化 */
function normalizeGradeCategory(raw: string): string {
  const s = raw.trim();
  if (/マスターズ/.test(s)) return "マスターズ";
  if (/小学|小\d/.test(s)) return "小学生";
  if (/中学|中\d/.test(s)) return "中学";
  if (/高校/.test(s)) return "高校";
  return "一般";
}

/** 種目ソート用スコア: トラック短距離→長距離→ハードル→フィールド→その他 */
function disciplineSortKey(name: string): number {
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

export function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  // Filter state — default open so users see it immediately
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(
    new Set()
  );
  const [showPastEvents, setShowPastEvents] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scrape");
      const data: ScrapeResult[] = await res.json();
      const rawEvents = data.flatMap((r) => r.events).map(sanitizeEvent);
      // ID重複を排除（先に出現したものを優先）
      const seen = new Set<string>();
      const allEvents = rawEvents.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      allEvents.sort((a, b) => a.date.localeCompare(b.date));
      setEvents(allEvents);
      setError(null);
    } catch (err) {
      setError("データの取得に失敗しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (skipPdf: boolean) => {
    if (!adminKey) {
      setError("管理者キーを入力してください");
      return;
    }
    try {
      setScraping(true);
      setError(null);
      const url = skipPdf ? "/api/scrape?skipPdf=true" : "/api/scrape";
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        signal: AbortSignal.timeout(300_000),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "スクレイピングに失敗しました");
      }
      await fetchEvents();
    } catch (err) {
      setError(String(err));
    } finally {
      setScraping(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Build normalized filter options
  const filterOptions = useMemo(() => {
    const months: Set<string> = new Set();
    const gradeCategories: Set<string> = new Set();
    const disciplines: Set<string> = new Set();

    for (const event of events) {
      const [y, m] = event.date.split("-");
      months.add(`${y}-${m}`);

      for (const d of event.disciplines) {
        disciplines.add(d.name);
        const grades = Array.isArray(d.grades) ? d.grades : [];
        for (const g of grades) {
          gradeCategories.add(normalizeGradeCategory(g));
        }
      }
    }

    const sortedMonths = Array.from(months).sort();
    const gradeOrder = ["一般", "高校", "中学", "小学生", "マスターズ"];
    const sortedGrades = gradeOrder.filter((g) => gradeCategories.has(g));

    // Sort disciplines first
    const sortedDisciplines = Array.from(disciplines).sort((a, b) => {
      return disciplineSortKey(a) - disciplineSortKey(b);
    });

    // Group disciplines
    const groups: Record<string, string[]> = {
      "短距離": [],
      "中距離": [],
      "長距離": [],
      "ハードル": [],
      "跳躍": [],
      "投擲": [],
      "混成": [],
      "リレー": [],
      "競歩": [],
      "マラソン・ロード": [],
      "駅伝": [],
      "その他": [],
    };

    /**
     * Normalize discipline name for categorization (remove gender, grade, school type prefixes)
     * e.g. "小100m" -> "100m", "女子800m" -> "800m", "中2-100m" -> "100m"
     */
    const normalizeDiscipline = (name: string): string => {
      let n = name;

      // Normalize full-width characters (numbers and 'm', 'H', 'W', 'R')
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
      n = n.replace(/^(\d+年)/, ""); // e.g. "1年", "2年"
      n = n.replace(/-/, ""); // "中2-100m" -> "2100m"? No, usually "中2-100m" -> "100m". 
      // Better regex for "中2-100m" -> remove "中2-"
      n = n.replace(/^[小中高](\d+)[-]?/, "");
      n = n.replace(/^[小中高]/, ""); // Catch remaining single char
      n = n.replace(/\(.*\)/, ""); // Remove anything in parens e.g. (8.0m)
      // Remove spaces
      n = n.trim();
      return n;
    };

    for (const d of sortedDisciplines) {
      const norm = normalizeDiscipline(d);

      // Hurdles (Check original name for "H" to be safe, but norm is good for distance)
      // "80mH", "100mH", "110mH", "400mH", "110mYH"
      if (/H$|H\d|ハードル|SC|障害/.test(d)) {
        // SC (Steeplechase) is distinct? usually Track. 
        // User complained about Hurdles in Other. 
        // Let's put SC in "長距離" or "中距離" or separate? 
        // Usually SC is 3000mSC -> Long. But "Hardle" category specifically requested.
        // Let's put standard Hurdles in "Hardle". 
        if (/SC|障害/.test(d)) {
          // 3000mSC is technical, often grouped with Long or separate. 
          // Let's put in "長距離" for now unless "Hurdle" is strictly "Hurdle".
          // Actually user said "Hurdles also entered (in Other)".
          if (/SC/.test(d)) groups["長距離"].push(d); // 3000mSC -> Long
          else groups["ハードル"].push(d);
        } else {
          groups["ハードル"].push(d);
        }
        continue;
      }

      // Sprints: 100m, 200m, 400m, 50m, 60m, 80m
      // Check normalized name for simple distance
      // Allow "100" (implicit m) or "100m"
      const distMatch = norm.match(/^(\d+)m?$/);
      if (distMatch) {
        const dist = Number(distMatch[1]);
        if (dist <= 400) {
          groups["短距離"].push(d);
        } else if (dist <= 1500) { // 800, 1000, 1500
          groups["中距離"].push(d);
        } else { // 3000, 5000, 10000+
          groups["長距離"].push(d);
        }
        continue;
      }

      // Relays
      if (/リレー|R$/.test(d)) {
        groups["リレー"].push(d);
        continue;
      }

      // Walks
      if (/競歩|W$/.test(d)) {
        groups["競歩"].push(d);
        continue;
      }

      // Road / Marathon
      if (/マラソン|ロード|クロカン/.test(d)) {
        groups["マラソン・ロード"].push(d);
        continue;
      }

      // Ekiden
      if (/駅伝/.test(d)) {
        groups["駅伝"].push(d);
        continue;
      }

      // Field: Jumps
      if (/走高|棒高|走幅|三段|跳/.test(d)) {
        groups["跳躍"].push(d);
        continue;
      }

      // Field: Throws (including Javelin Ball/Vortex)
      if (/砲丸|円盤|ハンマー|やり|投|ジャベリ|ボール/.test(d)) {
        groups["投擲"].push(d);
        continue;
      }

      // Combined
      if (/混成|種|コンバインド|トライアスロン/.test(d)) {
        // "四種競技" -> "種"?
        groups["混成"].push(d);
        continue;
      }

      // Fallback
      groups["その他"].push(d);
    }

    // Convert to array of { category, items } for easy rendering, removing empty groups
    const disciplineGroups = Object.entries(groups)
      .map(([category, items]) => ({ category, items }))
      .filter((g) => g.items.length > 0);

    return {
      months: sortedMonths,
      grades: sortedGrades,
      disciplines: sortedDisciplines, // Keep flat list check logic if needed, or remove if unused in favor of groups
      disciplineGroups,
    };
  }, [events]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedMonths.size > 0) {
        const [y, m] = event.date.split("-");
        if (!selectedMonths.has(`${y}-${m}`)) return false;
      }

      // Filter past events defaults
      if (!showPastEvents) {
        const eventDate = new Date(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate < today) return false;
      }

      if (selectedGrades.size > 0) {
        if (event.disciplines.length === 0) return false;
        const eventGradeCats = new Set(
          event.disciplines.flatMap((d) =>
            (Array.isArray(d.grades) ? d.grades : []).map((g) => normalizeGradeCategory(g))
          )
        );
        const hasMatch = Array.from(selectedGrades).some((g) =>
          eventGradeCats.has(g)
        );
        if (!hasMatch) return false;
      }

      if (selectedDisciplines.size > 0) {
        if (event.disciplines.length === 0) return false;
        const eventDiscNames = new Set(
          event.disciplines.map((d) => d.name)
        );
        const hasMatch = Array.from(selectedDisciplines).some((d) =>
          eventDiscNames.has(d)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [events, selectedMonths, selectedGrades, selectedDisciplines]);

  const activeFilterCount =
    selectedMonths.size + selectedGrades.size + selectedDisciplines.size;
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSelectedMonths(new Set());
    setSelectedGrades(new Set());
    setSelectedDisciplines(new Set());
  };

  const toggleFilter = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    setter(next);
  };

  const removeFilter = (value: string) => {
    if (selectedMonths.has(value)) {
      toggleFilter(selectedMonths, setSelectedMonths, value);
    } else if (selectedGrades.has(value)) {
      toggleFilter(selectedGrades, setSelectedGrades, value);
    } else if (selectedDisciplines.has(value)) {
      toggleFilter(selectedDisciplines, setSelectedDisciplines, value);
    }
  };

  const formatMonth = (key: string) => {
    const [, m] = key.split("-");
    return `${parseInt(m)}月`;
  };

  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string }[] = [];
    for (const m of selectedMonths) {
      tags.push({ key: m, label: formatMonth(m) });
    }
    for (const g of selectedGrades) {
      tags.push({ key: g, label: g });
    }
    for (const d of selectedDisciplines) {
      tags.push({ key: d, label: d });
    }
    return tags;
  }, [selectedMonths, selectedGrades, selectedDisciplines]);

  const eventsByMonth = groupByMonth(filteredEvents);

  return (
    <div className={styles.cardListFade}>
      {/* 管理者パネル（トグル式） */}
      <div className={styles.adminToggle}>
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className={styles.adminToggleBtn}
        >
          {showAdmin ? "管理パネルを閉じる" : "管理者"}
        </button>
      </div>

      {showAdmin && (
        <div className={styles.adminPanel}>
          <input
            type="password"
            placeholder="管理者キー"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className={styles.adminInput}
          />
          <div className={styles.toolbar}>
            <button
              onClick={() => handleScrape(true)}
              disabled={scraping}
              className={styles.btnLight}
            >
              {scraping && <span className={styles.spinner} />}
              {scraping ? "取得中..." : "大会情報を更新"}
            </button>
            <button
              onClick={() => handleScrape(false)}
              disabled={scraping}
              className={styles.btnPrimary}
            >
              {scraping && <span className={styles.spinner} />}
              {scraping ? "解析中..." : "PDF解析で詳細取得"}
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>読み込み中...</div>}

      {/* Filter bar */}
      {!loading && events.length > 0 && (
        <div className={styles.filterBar}>
          {/* Collapsed: summary bar */}
          <div
            className={styles.filterSummary}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <div className={styles.filterSummaryLeft}>
              <span className={styles.filterIcon}>&#x1F50D;</span>
              <div className={styles.filterTitleGroup}>
                <span className={styles.filterTitle}>
                  大会を絞り込む
                </span>
                <span className={styles.filterSubtitle}>
                  月・対象・種目で探せます
                </span>
              </div>
            </div>
            <div className={styles.filterSummaryRight}>
              {hasActiveFilters && (
                <span className={styles.filterBadge}>{activeFilterCount}</span>
              )}
              <span className={styles.resultCount}>
                {hasActiveFilters
                  ? `${filteredEvents.length} / ${events.length} 件`
                  : `${events.length} 件`}
              </span>
              <span
                className={filterOpen ? styles.chevronOpen : styles.chevron}
              >
                &#x25BC;
              </span>
            </div>
          </div>

          {/* Active filter tags (shown when collapsed) */}
          {!filterOpen && hasActiveFilters && (
            <div className={styles.activeFilters}>
              {activeFilterTags.map((tag) => (
                <span key={tag.key} className={styles.activeTag}>
                  {tag.label}
                  <button
                    className={styles.activeTagRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFilter(tag.key);
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Filter body (expanded) */}
          {filterOpen && (
            <div className={styles.filterBody}>
              {/* Top actions (Close button) */}
              <div className={styles.filterHeader}>
                <span className={styles.filterHeaderTitle}>絞り込み条件</span>
                <button
                  className={styles.closeFilterBtn}
                  onClick={() => setFilterOpen(false)}
                >
                  閉じる &times;
                </button>
              </div>

              {/* Month filter */}
              {filterOptions.months.length > 0 && (
                <details className={styles.filterGroup} open>
                  <summary className={styles.filterLabel}>開催月</summary>
                  <div className={styles.filterChips}>
                    {filterOptions.months.map((m) => {
                      const [y, mon] = m.split("-");
                      const isPast = new Date(m + "-01") < new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                      if (!showPastEvents && isPast) return null; // Skip past months if toggle off

                      return (
                        <button
                          key={m}
                          className={
                            selectedMonths.has(m)
                              ? styles.chipActive
                              : styles.chip
                          }
                          onClick={() =>
                            toggleFilter(selectedMonths, setSelectedMonths, m)
                          }
                        >
                          {y}年{parseInt(mon)}月
                        </button>
                      )
                    })}
                  </div>
                  <div className={styles.pastToggle}>
                    <label>
                      <input
                        type="checkbox"
                        checked={showPastEvents}
                        onChange={(e) => setShowPastEvents(e.target.checked)}
                      />
                      過去の大会を表示する
                    </label>
                  </div>
                </details>
              )}

              {/* Grade filter */}
              {filterOptions.grades.length > 0 && (
                <details className={styles.filterGroup} open>
                  <summary className={styles.filterLabel}>対象</summary>
                  <div className={styles.filterChips}>
                    {filterOptions.grades.map((g) => (
                      <button
                        key={g}
                        className={
                          selectedGrades.has(g)
                            ? styles.chipActive
                            : styles.chip
                        }
                        onClick={() =>
                          toggleFilter(selectedGrades, setSelectedGrades, g)
                        }
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </details>
              )}

              {/* Discipline filter (Categorized) */}
              {filterOptions.disciplines.length > 0 && (
                <details className={styles.filterGroup} open>
                  <summary className={styles.filterLabel}>種目</summary>
                  <div className={styles.disciplineList}>
                    {filterOptions.disciplineGroups.map((group) => {
                      const hasActiveItem = group.items.some(d => selectedDisciplines.has(d));
                      return (
                        <details key={group.category} className={styles.disciplineCategory} open={hasActiveItem}>
                          <summary className={styles.categoryLabel}>{group.category}</summary>
                          <div className={styles.filterChips}>
                            {group.items.map((d) => (
                              <button
                                key={d}
                                className={
                                  selectedDisciplines.has(d)
                                    ? styles.chipActive
                                    : styles.chip
                                }
                                onClick={() =>
                                  toggleFilter(
                                    selectedDisciplines,
                                    setSelectedDisciplines,
                                    d
                                  )
                                }
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </details>
              )}

              {/* Bottom actions */}
              <div className={styles.filterActions}>
                <div>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className={styles.clearBtn}>
                      すべてクリア
                    </button>
                  )}
                </div>
                <button
                  className={styles.closeFilterBtn}
                  onClick={() => setFilterOpen(false)}
                >
                  {hasActiveFilters
                    ? `${filteredEvents.length}件の大会を表示`
                    : "閉じる"}
                  <span>&#x25B2;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {
        !loading && events.length === 0 && (
          <div className={styles.empty}>大会データがありません。</div>
        )
      }

      {
        !loading && hasActiveFilters && filteredEvents.length === 0 && (
          <div className={styles.empty}>条件に一致する大会がありません。</div>
        )
      }

      {
        Object.entries(eventsByMonth).map(([month, monthEvents]) => {
          const monthNum = month.replace(/[^0-9]/g, "").slice(-2);
          return (
            <section key={month} className={styles.monthSection}>
              <div className={styles.monthHeader}>
                <div className={styles.monthNumber}>{parseInt(monthNum)}</div>
                <span className={styles.monthLabel}>{month}</span>
              </div>
              {monthEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  highlightDisciplines={selectedDisciplines}
                  highlightGrades={selectedGrades}
                  normalizeGrade={normalizeGradeCategory}
                />
              ))}
            </section>
          );
        })
      }
    </div >
  );
}

/** Blobに保存済みのデータが想定外の形式でも安全に表示できるよう正規化 */
function sanitizeEvent(event: Event): Event {
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

function groupByMonth(events: Event[]): Record<string, Event[]> {
  const groups: Record<string, Event[]> = {};
  for (const event of events) {
    const [y, m] = event.date.split("-");
    const key = `${y}年${parseInt(m)}月`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }
  return groups;
}
