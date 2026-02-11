import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "陸上クラブ - 大会スケジュール",
  description: "大会スケジュールとエントリー管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
