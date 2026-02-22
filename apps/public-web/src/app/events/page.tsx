import type { Metadata } from "next";
import { EventList } from "@/components/EventList";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "大会スケジュール",
  description:
    "北海道の陸上競技大会スケジュール一覧。月別・種目別に検索でき、そのままエントリー申込が可能です。",
  openGraph: {
    title: "北海道 陸上大会スケジュール | エレファント陸上クラブ",
    description:
      "北海道の陸上競技大会スケジュールを一覧で確認。月別・種目別フィルターで簡単検索。",
  },
};

export default function EventsPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>大会スケジュール</h1>
      </header>
      <EventList />
    </main>
  );
}
