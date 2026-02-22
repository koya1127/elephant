"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
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

export function EntryButton({ eventName, eventId, eventDate, disciplines, fee }: EntryButtonProps) {
  const { isSignedIn, isLoaded } = useUser();
  const [showModal, setShowModal] = useState(false);

  if (!isLoaded) return null;

  // 未ログイン
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={styles.nonMember}>ログインしてエントリー</button>
      </SignInButton>
    );
  }

  // ログイン済み → EntryModal表示
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
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
