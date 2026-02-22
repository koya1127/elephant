"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Discipline } from "@/lib/types";
import { EntryModal } from "./EntryModal";
import styles from "./EntryButton.module.css";

interface EntryButtonProps {
  eventName: string;
  eventId: string;
  eventDate: string;
  disciplines: Discipline[];
  fee?: number;
}

type MemberStatus = "active" | "pending" | undefined;

export function EntryButton({ eventName, eventId, eventDate, disciplines, fee }: EntryButtonProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

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

  // 4. エントリー上限到達 → 追加エントリー購入
  if (entriesUsed >= entryLimit) {
    const handleAdditional = async () => {
      try {
        const res = await fetch("/api/stripe/additional-entry", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.location.href = data.url;
      } catch (err) {
        console.error("追加エントリー購入エラー:", err);
      }
    };

    return (
      <button className={styles.additional} onClick={handleAdditional}>
        追加エントリーを購入
      </button>
    );
  }

  // 5. 会員（active）→ EntryModal表示
  return (
    <>
      <button
        className={styles.member}
        onClick={() => setShowModal(true)}
      >
        エントリーする
      </button>
      {showModal && (
        <EntryModal
          eventId={eventId}
          eventName={eventName}
          eventDate={eventDate}
          disciplines={disciplines}
          fee={fee}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            // Clerk のメタデータはリロードで反映されるが、
            // ここでは閉じるだけにする
          }}
        />
      )}
    </>
  );
}
