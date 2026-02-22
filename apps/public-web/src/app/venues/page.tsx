import type { Metadata } from "next";
import { VenueMap } from "@/components/VenueMap";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "競技場マップ",
  description:
    "北海道の陸上競技場・練習スポット・パワーマックス設置場所を地図で確認。大会情報との紐付けも表示します。",
  openGraph: {
    title: "競技場マップ | エレファント陸上クラブ",
    description:
      "北海道の陸上関連施設を地図で確認。競技場・練習スポット・パワーマックスの場所と詳細情報。",
  },
};

export default function VenuesPage() {
  return (
    <main className={styles.main}>
      <VenueMap />
    </main>
  );
}
