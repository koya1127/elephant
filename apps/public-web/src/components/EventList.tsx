"use client";

import { useState, useEffect } from "react";
import type { Event, ScrapeResult } from "@/lib/types";
import { EventCard } from "./EventCard";
import styles from "./EventList.module.css";

export function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/scrape");
      const data: ScrapeResult[] = await res.json();
      const allEvents = data.flatMap((r) => r.events);
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

  const eventsByMonth = groupByMonth(events);

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

      {!loading && events.length === 0 && (
        <div className={styles.empty}>
          大会データがありません。
        </div>
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
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        );
      })}
    </div>
  );
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
