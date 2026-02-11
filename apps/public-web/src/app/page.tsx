import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>陸上クラブ</h1>
      <p>大会スケジュールとエントリー管理</p>
      <Link href="/events" style={{ color: "#0070f3", textDecoration: "underline" }}>
        大会一覧を見る →
      </Link>
    </main>
  );
}
