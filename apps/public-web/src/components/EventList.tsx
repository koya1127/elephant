"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import type { Discipline, Event, Entry, ScrapeResult } from "@/lib/types";
import { findHistoricalDisciplines, normalizeForHistoricalMatch } from "@/lib/event-utils";
import { EventCard } from "./EventCard";
import {
  VENUE_MAP,
  matchVenue,
  normalizeGradeCategory,
  disciplineSortKey,
  normalizeDiscipline,
  sanitizeEvent,
  groupByMonth,
} from "@/lib/event-helpers";
import { SOURCE_LABELS } from "@/config/sites";
import styles from "./EventList.module.css";


export function EventList() {
  const { isSignedIn } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enteredEventIds, setEnteredEventIds] = useState<Set<string>>(new Set());

  // Filter state — default open so users see it immediately
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(
    new Set()
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(
    new Set()
  );
  const [showPastEvents, setShowPastEvents] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/scrape");
        const data: ScrapeResult[] = await res.json();
        const rawEvents = data.flatMap((r) => r.events).map(sanitizeEvent);
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
    fetchEvents();
  }, []);

  // ログインユーザーのエントリー済みイベントID取得
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/entries")
      .then((r) => r.json())
      .then((d) => {
        const ids = new Set<string>(
          ((d.entries ?? []) as Entry[]).map((e: Entry) => e.eventId)
        );
        setEnteredEventIds(ids);
      })
      .catch(() => {});
  }, [isSignedIn]);

  // Build normalized filter options
  const filterOptions = useMemo(() => {
    const months: Set<string> = new Set();
    const gradeCategories: Set<string> = new Set();
    const disciplines: Set<string> = new Set();
    const sources: Set<string> = new Set();

    for (const event of events) {
      const [y, m] = event.date.split("-");
      months.add(`${y}-${m}`);
      if (event.sourceId) sources.add(event.sourceId);

      for (const d of event.disciplines) {
        disciplines.add(d.name);
        const grades = Array.isArray(d.grades) ? d.grades : [];
        for (const g of grades) {
          gradeCategories.add(normalizeGradeCategory(g));
        }
      }
    }

    const venueSet = new Set<string>();
    for (const event of events) {
      const vid = matchVenue(event);
      if (vid) venueSet.add(vid);
    }
    const venues = VENUE_MAP.filter((v) => venueSet.has(v.id));

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

    // Sort sources by the order defined in SOURCE_LABELS
    const sourceOrder = Object.keys(SOURCE_LABELS);
    const sortedSources = Array.from(sources).sort(
      (a, b) => (sourceOrder.indexOf(a) === -1 ? 99 : sourceOrder.indexOf(a)) -
                (sourceOrder.indexOf(b) === -1 ? 99 : sourceOrder.indexOf(b))
    );

    return {
      months: sortedMonths,
      grades: sortedGrades,
      disciplines: sortedDisciplines,
      disciplineGroups,
      sources: sortedSources,
      venues,
    };
  }, [events]);

  // 過去大会の種目マッチング
  const historicalDisciplinesMap = useMemo(() => {
    const map = new Map<string, Discipline[]>();
    for (const event of events) {
      const hist = findHistoricalDisciplines(event, events);
      if (hist) map.set(event.id, hist);
    }
    return map;
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

      // Exclude Runnet-only events (events not listed on any athletic association site)
      if (event.sourceId === "runnet") return false;

      if (selectedSources.size > 0) {
        if (!selectedSources.has(event.sourceId)) return false;
      }

      if (selectedVenues.size > 0) {
        const vid = matchVenue(event);
        if (!vid || !selectedVenues.has(vid)) return false;
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
  }, [events, selectedMonths, selectedGrades, selectedDisciplines, selectedSources, selectedVenues]);

  const activeFilterCount =
    selectedMonths.size + selectedGrades.size + selectedDisciplines.size + selectedSources.size + selectedVenues.size;
  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = () => {
    setSelectedMonths(new Set());
    setSelectedGrades(new Set());
    setSelectedDisciplines(new Set());
    setSelectedSources(new Set());
    setSelectedVenues(new Set());
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
    } else if (selectedSources.has(value)) {
      toggleFilter(selectedSources, setSelectedSources, value);
    } else if (selectedVenues.has(value)) {
      toggleFilter(selectedVenues, setSelectedVenues, value);
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
    for (const s of selectedSources) {
      const info = SOURCE_LABELS[s];
      tags.push({ key: s, label: info ? info.short : s });
    }
    for (const v of selectedVenues) {
      const venue = VENUE_MAP.find((vm) => vm.id === v);
      tags.push({ key: v, label: venue ? venue.label : v });
    }
    return tags;
  }, [selectedMonths, selectedGrades, selectedDisciplines, selectedSources, selectedVenues]);

  const eventsByMonth = groupByMonth(filteredEvents);

  // 昨年あって今年まだない個別大会を月ごとに収集
  const lastYearReferenceByMonth = useMemo(() => {
    if (showPastEvents) return new Map<string, Event[]>();

    const today = new Date();
    const currentYear = today.getFullYear();
    const lastYear = currentYear - 1;
    const currentMonth = today.getMonth() + 1;

    // 今年のイベント名を月ごとに正規化して収集
    const currentYearNamesByMonth = new Map<string, Set<string>>();
    for (const event of events) {
      const [y, m] = event.date.split("-");
      if (Number(y) === currentYear) {
        if (!currentYearNamesByMonth.has(m)) currentYearNamesByMonth.set(m, new Set());
        currentYearNamesByMonth.get(m)!.add(normalizeForHistoricalMatch(event.name));
      }
    }

    const result = new Map<string, Event[]>();
    for (let i = 0; i < 6; i++) {
      const m = ((currentMonth - 1 + i) % 12) + 1;
      const y = currentYear + Math.floor((currentMonth - 1 + i) / 12);
      if (y !== currentYear) continue;

      const monthStr = String(m).padStart(2, "0");
      const currentNames = currentYearNamesByMonth.get(monthStr) || new Set();

      const unmatched = events.filter(e => {
        const [ey, em] = e.date.split("-");
        if (Number(ey) !== lastYear || em !== monthStr) return false;
        return !currentNames.has(normalizeForHistoricalMatch(e.name));
      });

      if (unmatched.length > 0) {
        unmatched.sort((a, b) => a.date.localeCompare(b.date));
        result.set(`${y}年${m}月`, unmatched);
      }
    }

    return result;
  }, [events, showPastEvents]);

  // 通常セクションに昨年実績を統合
  const allSections = useMemo(() => {
    type Section = {
      key: string;
      monthNum: number;
      sortKey: string;
      label: string;
      events: Event[];
      referenceEvents: Event[];
    };

    const sections = new Map<string, Section>();

    for (const [month, monthEvents] of Object.entries(eventsByMonth)) {
      const match = month.match(/(\d{4})年(\d+)月/);
      if (match) {
        sections.set(month, {
          key: month,
          monthNum: parseInt(match[2]),
          sortKey: `${match[1]}-${match[2].padStart(2, "0")}`,
          label: month,
          events: monthEvents,
          referenceEvents: [],
        });
      }
    }

    for (const [monthKey, refEvents] of lastYearReferenceByMonth) {
      if (sections.has(monthKey)) {
        sections.get(monthKey)!.referenceEvents = refEvents;
      } else {
        const match = monthKey.match(/(\d{4})年(\d+)月/);
        if (match) {
          sections.set(monthKey, {
            key: monthKey,
            monthNum: parseInt(match[2]),
            sortKey: `${match[1]}-${match[2].padStart(2, "0")}`,
            label: monthKey,
            events: [],
            referenceEvents: refEvents,
          });
        }
      }
    }

    return Array.from(sections.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [eventsByMonth, lastYearReferenceByMonth]);

  return (
    <div className={styles.cardListFade}>
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

              {/* Source (陸協) filter */}
              {filterOptions.sources.length > 0 && (
                <details className={styles.filterGroup} open>
                  <summary className={styles.filterLabel}>陸協・団体</summary>
                  <div className={styles.filterChips}>
                    {filterOptions.sources.map((s) => {
                      const info = SOURCE_LABELS[s];
                      return (
                        <button
                          key={s}
                          className={
                            selectedSources.has(s)
                              ? styles.chipActive
                              : styles.chip
                          }
                          onClick={() =>
                            toggleFilter(selectedSources, setSelectedSources, s)
                          }
                          title={info?.region}
                        >
                          {info ? `${info.short}` : s}
                          <span className={styles.chipSub}>{info?.region}</span>
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Venue (開催場所) filter */}
              {filterOptions.venues.length > 0 && (
                <details className={styles.filterGroup} open>
                  <summary className={styles.filterLabel}>開催場所</summary>
                  <div className={styles.filterChips}>
                    {filterOptions.venues.map((v) => (
                      <button
                        key={v.id}
                        className={
                          selectedVenues.has(v.id)
                            ? styles.chipActive
                            : styles.chip
                        }
                        onClick={() =>
                          toggleFilter(selectedVenues, setSelectedVenues, v.id)
                        }
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}

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
        allSections.map((section) => {
          const hasCurrentEvents = section.events.length > 0;
          const hasRefEvents = section.referenceEvents.length > 0;
          const isReferenceOnly = !hasCurrentEvents && hasRefEvents;

          return (
            <section key={section.key} className={styles.monthSection}>
              <div className={isReferenceOnly ? styles.monthHeaderReference : styles.monthHeader}>
                <div className={isReferenceOnly ? styles.monthNumberReference : styles.monthNumber}>
                  {section.monthNum}
                </div>
                <div>
                  <span className={styles.monthLabel}>
                    {isReferenceOnly ? `${section.monthNum}月の大会（昨年実績）` : section.label}
                  </span>
                  {isReferenceOnly && (
                    <div className={styles.monthSubLabel}>昨年の同時期に開催された大会です</div>
                  )}
                </div>
              </div>

              {section.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  highlightDisciplines={selectedDisciplines}
                  highlightGrades={selectedGrades}
                  normalizeGrade={normalizeGradeCategory}
                  enteredEventIds={enteredEventIds}
                  historicalDisciplines={historicalDisciplinesMap.get(event.id)}
                />
              ))}

              {hasCurrentEvents && hasRefEvents && (
                <div className={styles.referenceSubHeader}>
                  <span className={styles.referenceSubTitle}>昨年の{section.monthNum}月の大会</span>
                  <span className={styles.referenceSubText}>今年はまだ登録されていない大会です</span>
                </div>
              )}

              {hasRefEvents && section.referenceEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLastYearReference
                  normalizeGrade={normalizeGradeCategory}
                  enteredEventIds={enteredEventIds}
                />
              ))}
            </section>
          );
        })
      }
    </div >
  );
}

