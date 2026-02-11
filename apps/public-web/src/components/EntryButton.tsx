"use client";

import { useCallback } from "react";
import styles from "./EntryButton.module.css";

// TODO: 認証実装後に置き換え
const MOCK_IS_MEMBER = false;

const ENTRY_URL = "https://forms.gle/example"; // 仮のエントリーURL
const REGISTER_URL = "/register"; // 会員登録ページ（未実装）

interface EntryButtonProps {
  eventName: string;
}

export function EntryButton({ eventName }: EntryButtonProps) {
  const handleClick = useCallback(() => {
    if (MOCK_IS_MEMBER) {
      window.open(ENTRY_URL, "_blank", "noopener");
    } else {
      const msg = `「${eventName}」にエントリーするには会員登録が必要です。\n会員登録画面へ移動しますか？`;
      if (window.confirm(msg)) {
        window.location.href = REGISTER_URL;
      }
    }
  }, [eventName]);

  return (
    <button
      onClick={handleClick}
      className={MOCK_IS_MEMBER ? styles.member : styles.nonMember}
    >
      {MOCK_IS_MEMBER ? "エントリー" : "エントリー"}
    </button>
  );
}
