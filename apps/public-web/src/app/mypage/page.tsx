"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import styles from "./page.module.css";

export default function MyPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetch("/api/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isLoaded) return <div className={styles.loading}>読み込み中...</div>;

  if (!isSignedIn) {
    return (
      <div className={styles.loginPrompt}>
        <p>マイページを表示するにはログインしてください</p>
        <SignInButton mode="modal">
          <button className={styles.joinCta} style={{ marginTop: 16 }}>
            ログイン
          </button>
        </SignInButton>
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );
  const confirmedCount = entries.filter((e) => e.status === "submitted").length;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>マイページ</h1>

      {/* エントリー概要カード */}
      <div className={styles.planCard}>
        <div className={styles.planHeader}>
          <span className={styles.planName}>
            {user?.firstName
              ? `${user.lastName ?? ""} ${user.firstName}`.trim()
              : "会員"}
          </span>
          <span className={styles.planStatus}>
            {confirmedCount}件エントリー済み
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link href="/events" className={styles.joinCta}>
            大会一覧を見る
          </Link>
        </div>
      </div>

      {/* エントリー履歴 */}
      <h2 className={styles.sectionTitle}>エントリー履歴</h2>

      {loading ? (
        <div className={styles.loading}>読み込み中...</div>
      ) : sorted.length === 0 ? (
        <div className={styles.empty}>エントリー履歴はありません</div>
      ) : (
        sorted.map((e) => (
          <div key={e.id} className={styles.entryCard}>
            <div className={styles.entryHeader}>
              <span className={styles.entryEventName}>{e.eventName}</span>
              <span className={styles.entryDate}>{formatDate(e.eventDate)}</span>
            </div>
            {e.disciplines.length > 0 && (
              <div className={styles.entryDisciplines}>
                {e.disciplines.map((d, i) => (
                  <span key={i} className={styles.entryTag}>{d}</span>
                ))}
              </div>
            )}
            <div className={styles.entryCreatedAt}>
              申込日: {new Date(e.createdAt).toLocaleDateString("ja-JP")}
              {e.feePaid != null && (
                <span style={{ marginLeft: 12 }}>
                  支払額: ¥{(e.feePaid + (e.serviceFeePaid ?? 0)).toLocaleString()}
                </span>
              )}
              {e.status === "pending_payment" && (
                <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 600 }}>
                  決済待ち
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!m || !d) return dateStr;
  return `${y}/${m}/${d}`;
}
