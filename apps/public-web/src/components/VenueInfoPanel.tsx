"use client";

import { useMemo, useState } from "react";
import type { Venue, Event } from "@/lib/types";
import styles from "./VenueInfoPanel.module.css";

const TYPE_LABELS: Record<string, string> = {
  stadium: "競技場",
  practice: "練習スポット",
  powermax: "パワーマックス",
};

export function VenueInfoPanel({
  venue,
  events,
  currentUserId,
  isAdmin,
  onClose,
  onDelete,
}: {
  venue: Venue;
  events: Event[];
  currentUserId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // 競技場の場合、keywordsでマッチするイベントを表示
  const matchedEvents = useMemo(() => {
    if (venue.type !== "stadium" || !venue.keywords?.length) return [];
    return events.filter((event) => {
      const text = `${event.location || ""} ${event.name}`;
      return (venue.keywords as string[]).some((kw) => text.includes(kw));
    });
  }, [venue, events]);

  const canDelete = currentUserId === venue.userId || isAdmin;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.typeBadge} data-type={venue.type}>
          {TYPE_LABELS[venue.type] || venue.type}
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>

      <h2 className={styles.name}>{venue.name}</h2>

      {venue.description && (
        <p className={styles.description}>{venue.description}</p>
      )}

      {venue.address && (
        <div className={styles.field}>
          <span className={styles.fieldIcon}>📍</span>
          <span>{venue.address}</span>
        </div>
      )}

      {venue.url && (
        <div className={styles.field}>
          <span className={styles.fieldIcon}>🔗</span>
          <a
            href={venue.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Webサイト
          </a>
        </div>
      )}

      {/* 今後の大会一覧（競技場のみ） */}
      {matchedEvents.length > 0 && (
        <div className={styles.eventsSection}>
          <h3 className={styles.eventsTitle}>今後の大会</h3>
          <ul className={styles.eventsList}>
            {matchedEvents.slice(0, 10).map((event) => (
              <li key={event.id} className={styles.eventItem}>
                <span className={styles.eventDate}>
                  {formatDate(event.date)}
                </span>
                <span className={styles.eventName}>{event.name}</span>
              </li>
            ))}
          </ul>
          {matchedEvents.length > 10 && (
            <p className={styles.moreEvents}>
              他 {matchedEvents.length - 10} 件
            </p>
          )}
        </div>
      )}

      {canDelete && (
        <div className={styles.deleteArea}>
          {confirming ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>本当に削除しますか？</span>
              <button
                className={styles.confirmYes}
                onClick={() => onDelete(venue.id)}
              >
                削除する
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              className={styles.deleteBtn}
              onClick={() => setConfirming(true)}
            >
              この施設を削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
