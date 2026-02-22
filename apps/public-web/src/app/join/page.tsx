"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ENTRY_SERVICE_FEE } from "@/config/fees";
import styles from "./page.module.css";

export default function JoinPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  if (!isLoaded) return null;

  return (
    <div className={styles.main}>
      <h1 className={styles.title}>エントリー方法</h1>
      <p className={styles.subtitle}>
        エレファント陸上クラブでは、大会ごとの都度エントリー制を採用しています。
      </p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>料金について</h2>
        <div className={styles.feeExplainer}>
          <div className={styles.feeItem}>
            <div className={styles.feeLabel}>参加費（実費）</div>
            <div className={styles.feeDesc}>
              大会ごとに異なります。要項PDFから自動取得、または管理者が設定します。
            </div>
          </div>
          <div className={styles.feeItem}>
            <div className={styles.feeLabel}>
              手数料 ¥{ENTRY_SERVICE_FEE.toLocaleString()}
            </div>
            <div className={styles.feeDesc}>
              エントリー代行・事務手数料として、1エントリーあたり一律でいただきます。
            </div>
          </div>
          <div className={styles.feeItem}>
            <div className={styles.feeLabel}>決済手数料</div>
            <div className={styles.feeDesc}>
              Stripe決済手数料（3.6%）が上乗せされます。
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>エントリーの流れ</h2>
        <ol className={styles.stepList}>
          <li>大会一覧から出場したい大会を選ぶ</li>
          <li>種目を選択して「支払いへ進む」をクリック</li>
          <li>Stripeの決済ページでお支払い</li>
          <li>決済完了後、自動でエントリーが確定されます</li>
        </ol>
      </div>

      <div className={styles.submitArea}>
        {isSignedIn ? (
          <button
            className={styles.submitBtn}
            onClick={() => router.push("/events")}
          >
            大会一覧を見る
          </button>
        ) : (
          <SignInButton mode="modal">
            <button className={styles.submitBtn}>
              ログインして大会一覧を見る
            </button>
          </SignInButton>
        )}
      </div>
    </div>
  );
}
