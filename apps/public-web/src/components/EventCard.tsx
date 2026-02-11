import type { Event } from "@/lib/types";
import { EntryButton } from "./EntryButton";
import styles from "./EventCard.module.css";

interface EventCardProps {
  event: Event;
}

const DOW = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function EventCard({ event }: EventCardProps) {
  const { month, day, dow } = parseDate(event.date);
  const dateRange = event.dateEnd ? `〜${parseDate(event.dateEnd).day}日` : "";

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        {/* 日付ブロック */}
        <div className={styles.dateBlock}>
          <span className={styles.dateMonth}>{month}月</span>
          <span className={styles.dateDay}>{day}{dateRange && <span style={{ fontSize: "14px", fontWeight: 500 }}>{dateRange}</span>}</span>
          {dow !== null && <span className={styles.dateDow}>{DOW[dow]}</span>}
        </div>

        {/* 情報エリア */}
        <div className={styles.info}>
          <div className={styles.infoMain}>
            <div className={styles.eventName}>{event.name}</div>
            <div className={styles.meta}>
              {event.location && (
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}>&#x1F4CD;</span>
                  {event.location}
                </span>
              )}
              {event.maxEntries && (
                <span className={styles.metaItem}>
                  <span className={styles.metaIcon}>&#x1F3AB;</span>
                  上限 {stringify(event.maxEntries)}
                </span>
              )}
              {event.entryDeadline && (
                <span className={`${styles.metaItem} ${styles.deadline}`}>
                  <span className={styles.metaIcon}>&#x23F0;</span>
                  締切 {formatShortDate(event.entryDeadline)}
                </span>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <EntryButton eventName={event.name} />
            {event.detailUrl && (
              <a
                href={event.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                要項PDF &rarr;
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 種目一覧 */}
      {event.disciplines.length > 0 && (
        <div className={styles.disciplines}>
          <div className={styles.discHeader}>
            種目（{event.disciplines.length}種目）
          </div>
          <div className={styles.discGrid}>
            {event.disciplines.map((d, i) => {
              const grades = normalizeGrades(d.grades);
              return (
                <span key={i} className={styles.discTag}>
                  {String(d.name || "")}
                  {grades.length > 0 && (
                    <span className={styles.discGrade}>
                      {grades.join(" / ")}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          {event.note && (
            <div className={styles.note}>{stringify(event.note)}</div>
          )}
        </div>
      )}
    </article>
  );
}

function stringify(val: unknown): string {
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (typeof val === "object" && val !== null) {
    return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(" / ");
  }
  return String(val ?? "");
}

function normalizeGrades(grades: unknown): string[] {
  if (Array.isArray(grades)) return grades.map((g) => String(g));
  if (grades && typeof grades === "object") return Object.keys(grades);
  return [];
}

function parseDate(dateStr: string): { month: number; day: number; dow: number | null } {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return { month: m || 0, day: d || 0, dow: null };
  const date = new Date(y, m - 1, d);
  return { month: m, day: d, dow: date.getDay() };
}

function formatShortDate(dateStr: string): string {
  const { month, day } = parseDate(dateStr);
  return `${month}/${day}`;
}
