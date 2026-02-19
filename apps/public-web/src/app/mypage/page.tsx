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

  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const memberStatus = meta?.memberStatus as string | undefined;
  const planName = (meta?.planName as string) ?? null;
  const entryLimit = (meta?.entryLimit as number) ?? 0;
  const entriesUsed = (meta?.entriesUsed as number) ?? 0;
  const remaining = Math.max(0, entryLimit - entriesUsed);
  const pct = entryLimit > 0 ? Math.min(100, (entriesUsed / entryLimit) * 100) : 0;

  const sorted = [...entries].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>マイページ</h1>

      {/* プラン情報カード */}
      <div className={styles.planCard}>
        <div className={styles.planHeader}>
          <span className={styles.planName}>
            {planName ?? "未入会"}
          </span>
          {memberStatus === "active" ? (
            <span className={styles.planStatus}>Active</span>
          ) : memberStatus === "pending" ? (
            <span className={styles.planStatusPending}>お支払い待ち</span>
          ) : (
            <span className={styles.planStatusNone}>未入会</span>
          )}
        </div>

        {memberStatus === "active" && (
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>エントリー利用状況</span>
              <span>{entriesUsed} / {entryLimit}</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={pct >= 80 ? styles.progressFillWarning : styles.progressFill}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={styles.remaining}>
              残り {remaining} 回エントリー可能
            </div>
          </div>
        )}

        {!memberStatus && (
          <Link href="/join" className={styles.joinCta}>
            入会する
          </Link>
        )}
        {memberStatus === "pending" && (
          <Link href="/join" className={styles.joinCta}>
            お支払いを完了する
          </Link>
        )}
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
