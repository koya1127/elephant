"use client";

import styles from "./EntryButton.module.css";

// エントリー機能は現在準備中
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EntryButtonProps {
  eventName: string;
  eventId: string;
  eventDate: string;
  disciplines: { name: string; grades: string[] }[];
  fee?: number;
}

export function EntryButton(_props: EntryButtonProps) {
  return (
    <button className={styles.nonMember} disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
      現在準備中です
    </button>
  );
}
