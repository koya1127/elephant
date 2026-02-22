/**
 * ローカルスクリプト共通: DB I/O ヘルパー
 *
 * POSTGRES_URL を .env.local から読み込み、drizzle-orm で接続
 * readEventsFromDb / upsertEventsToDb でローカルスクリプトからDB操作
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events } from "../../apps/public-web/src/lib/db/schema";
import { eq } from "drizzle-orm";

// --- Types (apps/public-web/src/lib/types.ts と同じ) ---

export interface Discipline {
  name: string;
  grades: string[];
  note?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  dateEnd?: string;
  location: string;
  disciplines: Discipline[];
  maxEntries?: number;
  detailUrl: string;
  sourceId: string;
  entryDeadline?: string;
  note?: string;
  pdfSize?: number;
  fee?: number;
  actualFee?: number;
  feeSource?: string;
}

export interface ScrapeResult {
  sourceId: string;
  scrapedAt: string;
  events: Event[];
}

// --- Env loading ---

export function loadEnv() {
  // .env.blob と .env.local を読み込み
  for (const envFile of [".env.blob", ".env.local", "apps/public-web/.env.local"]) {
    try {
      const envPath = resolve(process.cwd(), envFile);
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      // ファイルがなければスキップ
    }
  }
}

// --- DB connection ---

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (_db) return _db;
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL が未設定。.env.local を確認してください。");
  }
  const client = postgres(url, { ssl: "require" });
  _db = drizzle(client);
  return _db;
}

// --- DB operations ---

/**
 * DB から特定 sourceId のイベントを取得
 */
export async function readEventsForSource(sourceId: string): Promise<Event[]> {
  const db = getDb();
  const rows = await db.select().from(events).where(eq(events.sourceId, sourceId));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    dateEnd: row.dateEnd ?? undefined,
    location: (row.location as string) || "",
    disciplines: (row.disciplines as Discipline[]) || [],
    maxEntries: row.maxEntries ?? undefined,
    detailUrl: (row.detailUrl as string) || "",
    sourceId: row.sourceId,
    entryDeadline: row.entryDeadline ?? undefined,
    note: row.note ?? undefined,
    pdfSize: row.pdfSize ?? undefined,
    fee: row.fee ?? undefined,
    actualFee: row.actualFee ?? undefined,
    feeSource: row.feeSource ?? undefined,
  }));
}

/**
 * イベントを DB に upsert（特定 sourceId の結果を更新）
 */
export async function upsertEventsToDb(
  sourceId: string,
  eventList: Event[],
  scrapedAt: string
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const event of eventList) {
      await tx
        .insert(events)
        .values({
          id: event.id,
          sourceId: event.sourceId || sourceId,
          name: event.name,
          date: event.date,
          dateEnd: event.dateEnd ?? null,
          location: event.location || "",
          disciplines: event.disciplines,
          maxEntries: event.maxEntries ?? null,
          detailUrl: event.detailUrl || "",
          entryDeadline: event.entryDeadline ?? null,
          note: event.note ?? null,
          pdfSize: event.pdfSize ?? null,
          fee: event.fee ?? null,
          actualFee: event.actualFee ?? null,
          feeSource: event.feeSource ?? null,
          scrapedAt: new Date(scrapedAt),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            name: event.name,
            date: event.date,
            dateEnd: event.dateEnd ?? null,
            location: event.location || "",
            disciplines: event.disciplines,
            maxEntries: event.maxEntries ?? null,
            detailUrl: event.detailUrl || "",
            entryDeadline: event.entryDeadline ?? null,
            note: event.note ?? null,
            pdfSize: event.pdfSize ?? null,
            fee: event.fee ?? null,
            actualFee: event.actualFee ?? null,
            feeSource: event.feeSource ?? null,
            scrapedAt: new Date(scrapedAt),
            updatedAt: new Date(),
          },
        });
    }
  });
}

/**
 * DB接続を閉じる
 */
export async function closeDb(): Promise<void> {
  // postgres.js のコネクションは自動でクリーンアップされるが、
  // 明示的に終了したい場合は process.exit で対応
}
