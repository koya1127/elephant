"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export default function CompletePage() {
  const { user, isLoaded } = useUser();

  const planName = isLoaded
    ? ((user?.publicMetadata as Record<string, unknown>)?.planName as string) ||
      ""
    : "";

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "64px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 48,
          marginBottom: 16,
        }}
      >
        🎉
      </div>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "#111",
          marginBottom: 8,
        }}
      >
        入会ありがとうございます！
      </h1>
      <p style={{ fontSize: 15, color: "#666", marginBottom: 24 }}>
        お支払いが完了しました。
        {planName && (
          <>
            <br />
            <strong>{planName}</strong>でご登録いただきました。
          </>
        )}
      </p>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 32 }}>
        大会一覧ページからエントリーリクエストが送れるようになりました。
      </p>
      <Link
        href="/events"
        style={{
          display: "inline-block",
          padding: "14px 40px",
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
          background: "linear-gradient(135deg, #f97316, #fb923c)",
          borderRadius: 12,
          textDecoration: "none",
        }}
      >
        大会一覧を見る
      </Link>
    </div>
  );
}
