"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import styles from "./EntryButton.module.css";

const ENTRY_URL = "https://forms.gle/example"; // 仮のエントリーURL

interface EntryButtonProps {
  eventName: string;
}

export function EntryButton({ eventName }: EntryButtonProps) {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <button
        onClick={() => window.open(`${ENTRY_URL}?event=${encodeURIComponent(eventName)}`, "_blank", "noopener")}
        className={styles.member}
      >
        エントリー
      </button>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className={styles.nonMember}>
        ログインしてエントリー
      </button>
    </SignInButton>
  );
}
