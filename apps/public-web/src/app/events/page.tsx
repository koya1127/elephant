import { EventList } from "@/components/EventList";
import styles from "./page.module.css";

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
