import type { Metadata } from "next";
import { SlopeMap } from "@/components/SlopeMap";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "坂ダッシュマップ",
  description:
    "北海道の坂ダッシュに最適な坂道を地図で探せます。勾配・距離・交差点数で坂を評価。",
  openGraph: {
    title: "坂ダッシュマップ | エレファント陸上クラブ",
    description:
      "練習に最適な坂道を地図で発見。勾配・標高プロファイル・交差点数を自動計算。",
  },
};

export default function SlopesPage() {
  return (
    <main className={styles.main}>
      <SlopeMap />
    </main>
  );
}
