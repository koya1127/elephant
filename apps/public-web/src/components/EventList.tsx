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
  const [filterOpen, setFilterOpen] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(
    new Set()
  );

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scrape");
      const data: ScrapeResult[] = await res.json();
      const allEvents = data.flatMap((r) => r.events).map(sanitizeEvent);
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
        for (const g of d.grades) {
          gradeCategories.add(normalizeGradeCategory(g));
        }
      }
    }

    const sortedMonths = Array.from(months).sort();
    const gradeOrder = ["一般", "高校", "中学", "小学生", "マスターズ"];
    const sortedGrades = gradeOrder.filter((g) => gradeCategories.has(g));
    const sortedDisciplines = Array.from(disciplines).sort((a, b) => {
      return disciplineSortKey(a) - disciplineSortKey(b);
    });

    return {
      months: sortedMonths,
      grades: sortedGrades,
      disciplines: sortedDisciplines,
    };
  }, [events]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedMonths.size > 0) {
        const [y, m] = event.date.split("-");
        if (!selectedMonths.has(`${y}-${m}`)) return false;
      }

      if (selectedGrades.size > 0) {
        if (event.disciplines.length === 0) return false;
        const eventGradeCats = new Set(
          event.disciplines.flatMap((d) =>
            d.grades.map((g) => normalizeGradeCategory(g))
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
    <div>
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
              {/* Month filter */}
              {filterOptions.months.length > 0 && (
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>月</span>
                  <div className={styles.filterChips}>
                    {filterOptions.months.map((m) => (
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
                        {formatMonth(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grade filter */}
              {filterOptions.grades.length > 0 && (
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>対象</span>
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
                </div>
              )}

              {/* Discipline filter */}
              {filterOptions.disciplines.length > 0 && (
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>種目</span>
                  <div className={styles.filterChips}>
                    {filterOptions.disciplines.map((d) => (
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
                </div>
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

      {!loading && events.length === 0 && (
        <div className={styles.empty}>大会データがありません。</div>
      )}

      {!loading && hasActiveFilters && filteredEvents.length === 0 && (
        <div className={styles.empty}>条件に一致する大会がありません。</div>
      )}

      {Object.entries(eventsByMonth).map(([month, monthEvents]) => {
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
      })}
    </div>
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
