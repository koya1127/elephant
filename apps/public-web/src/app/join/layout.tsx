import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "エントリー方法",
  description:
    "エレファント陸上クラブのエントリー方法。参加費＋手数料¥1,500の都度払いで、1大会から気軽に大会申込代行を利用できます。",
  openGraph: {
    title: "エントリー方法 | エレファント陸上クラブ",
    description:
      "参加費＋手数料¥1,500の都度払い。大会一覧から選んで申し込むだけ。",
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
