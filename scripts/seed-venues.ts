/**
 * 初期データ投入: 既存VENUE_MAPの17競技場をDBに投入
 *
 * 実行: npx tsx scripts/seed-venues.ts
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   POSTGRES_URL
 */

import { loadEnv } from "./lib/db";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { venues } from "../apps/public-web/src/lib/db/schema";

loadEnv();

interface VenueSeed {
  id: string;
  type: "stadium";
  name: string;
  address: string;
  lat: number;
  lng: number;
  keywords: string[];
}

const SEED_VENUES: VenueSeed[] = [
  { id: "maruyama", type: "stadium", name: "札幌市円山競技場", address: "北海道札幌市中央区宮ケ丘3", lat: 43.0553, lng: 141.3204, keywords: ["円山"] },
  { id: "hanasaki", type: "stadium", name: "花咲スポーツ公園陸上競技場", address: "北海道北見市花園町", lat: 43.8204, lng: 143.8867, keywords: ["花咲"] },
  { id: "aoba", type: "stadium", name: "青葉公園陸上競技場", address: "北海道千歳市真町", lat: 42.8096, lng: 141.6563, keywords: ["青葉"] },
  { id: "obihiro", type: "stadium", name: "帯広の森陸上競技場", address: "北海道帯広市南町南7線", lat: 42.8809, lng: 143.1682, keywords: ["帯広の森"] },
  { id: "irie", type: "stadium", name: "入江運動公園陸上競技場", address: "北海道室蘭市入江町", lat: 42.3256, lng: 140.9808, keywords: ["入江"] },
  { id: "chiyodai", type: "stadium", name: "千代台公園陸上競技場", address: "北海道函館市千代台町22", lat: 41.7770, lng: 140.7316, keywords: ["千代台"] },
  { id: "midorigaoka", type: "stadium", name: "緑が丘公園陸上競技場", address: "北海道苫小牧市清水町", lat: 42.6389, lng: 141.5622, keywords: ["緑が丘", "ヤクルト"] },
  { id: "shibetsu", type: "stadium", name: "士別市陸上競技場", address: "北海道士別市東6条", lat: 44.1774, lng: 142.3990, keywords: ["士別"] },
  { id: "kushiro", type: "stadium", name: "釧路市民陸上競技場", address: "北海道釧路市大楽毛", lat: 42.9720, lng: 144.3155, keywords: ["釧路市民"] },
  { id: "abashiri", type: "stadium", name: "網走市営陸上競技場", address: "北海道網走市潮見", lat: 44.0082, lng: 144.2720, keywords: ["網走"] },
  { id: "kitami", type: "stadium", name: "東陵陸上競技場", address: "北海道北見市東陵町", lat: 43.8044, lng: 143.9033, keywords: ["東陵", "北見市"] },
  { id: "fukagawa", type: "stadium", name: "深川市陸上競技場", address: "北海道深川市花園町", lat: 43.7200, lng: 142.0380, keywords: ["深川市"] },
  { id: "iwamizawa", type: "stadium", name: "岩見沢東山公園陸上競技場", address: "北海道岩見沢市東山町", lat: 43.1914, lng: 141.7764, keywords: ["岩見沢", "東山公園"] },
  { id: "hamanaka", type: "stadium", name: "浜中陸上競技場", address: "北海道留萌市大字留萌村", lat: 43.9389, lng: 141.6374, keywords: ["浜中"] },
  { id: "atsuma", type: "stadium", name: "厚真町スポーツセンター陸上競技場", address: "北海道勇払郡厚真町京町", lat: 42.7273, lng: 141.8798, keywords: ["厚真"] },
  { id: "shintoku", type: "stadium", name: "新得町陸上競技場", address: "北海道上川郡新得町", lat: 43.0767, lng: 142.8439, keywords: ["新得"] },
  { id: "oval", type: "stadium", name: "明治北海道十勝オーバル", address: "北海道帯広市南町南7線56-7", lat: 42.8792, lng: 143.1635, keywords: ["オーバル"] },
];

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL が未設定。.env.local を確認してください。");
  }
  const client = postgres(url, { ssl: "require" });
  const db = drizzle(client);

  console.log(`${SEED_VENUES.length} 件の競技場をDBに投入します...`);

  for (const v of SEED_VENUES) {
    await db
      .insert(venues)
      .values({
        id: v.id,
        type: v.type,
        name: v.name,
        address: v.address,
        lat: v.lat,
        lng: v.lng,
        keywords: v.keywords,
        userId: "system",
      })
      .onConflictDoUpdate({
        target: venues.id,
        set: {
          name: v.name,
          address: v.address,
          lat: v.lat,
          lng: v.lng,
          keywords: v.keywords,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${v.name}`);
  }

  console.log("完了!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
