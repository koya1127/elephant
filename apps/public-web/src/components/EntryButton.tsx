"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import styles from "./EntryButton.module.css";

interface EntryButtonProps {
  eventName: string;
  eventId: string;
}

type MemberStatus = "active" | "pending" | undefined;

export function EntryButton({ eventName, eventId }: EntryButtonProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  if (!isLoaded) return null;

  // 1. 未ログイン
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={styles.nonMember}>ログインしてエントリー</button>
      </SignInButton>
    );
  }

  const meta = user.publicMetadata as Record<string, unknown>;
  const memberStatus = meta?.memberStatus as MemberStatus;
  const entryLimit = (meta?.entryLimit as number) || 0;
  const entriesUsed = (meta?.entriesUsed as number) || 0;

  // 2. ログイン済み・未入会
  if (!memberStatus) {
    return (
      <button
        className={styles.join}
        onClick={() => router.push("/join")}
      >
        入会する
      </button>
    );
  }

  // 3. 支払い待ち
  if (memberStatus === "pending") {
    return (
      <button
        className={styles.pending}
        onClick={() => router.push("/join")}
      >
        お支払いを完了する
      </button>
    );
  }

  // 4. エントリー上限到達
  if (entriesUsed >= entryLimit) {
    return (
      <button className={styles.disabled} disabled>
        エントリー上限
      </button>
    );
  }

  // 5. 会員（active）→ エントリーリクエスト可能
  // TODO: Phase 2でEntryModalに差し替え
  return (
    <button
      className={styles.member}
      onClick={() => {
        // Phase 2: EntryModal表示に差し替え予定
        alert(`「${eventName}」へのエントリー機能は準備中です`);
      }}
    >
      エントリーする
    </button>
  );
}
