import type { ScrapeResult, Event, Discipline } from "./types";
import { db } from "./db";
import { events } from "./db/schema";
import { eq } from "drizzle-orm";

/**
 * 保存済みの大会データを読み込む
 * DB から全イベントを取得し、sourceId でグループ化して ScrapeResult[] に変換
 */
export async function readEvents(): Promise<ScrapeResult[]> {
  if (!process.env.POSTGRES_URL) {
    return readFromFile();
  }
  try {
    const rows = await db.select().from(events);
    return groupBySourceId(rows);
  } catch (e) {
    console.error("[storage] readEvents error:", e);
    return [];
  }
}

/**
 * 大会データを保存する
 * ScrapeResult[] の全イベントを DB に upsert
 */
export async function writeEvents(data: ScrapeResult[]): Promise<void> {
  if (!process.env.POSTGRES_URL) {
    return writeToFile(data);
  }
  await db.transaction(async (tx) => {
    for (const result of data) {
      for (const event of result.events) {
        await tx
          .insert(events)
          .values(toDbRow(event, result))
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
              scrapedAt: new Date(result.scrapedAt),
              updatedAt: new Date(),
            },
          });
      }
    }
  });
}

/**
 * 特定 sourceId のイベントを DB から削除する（0件スクレイプ時の既存データ保持には使わない）
 */
export async function deleteEventsBySourceId(sourceId: string): Promise<void> {
  await db.delete(events).where(eq(events.sourceId, sourceId));
}

// --- DB row → Event 変換 ---

function toDbRow(event: Event, result: ScrapeResult) {
  return {
    id: event.id,
    sourceId: event.sourceId || result.sourceId,
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
    scrapedAt: new Date(result.scrapedAt),
    updatedAt: new Date(),
  };
}

type EventRow = typeof events.$inferSelect;

function rowToEvent(row: EventRow): Event {
  return {
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
  };
}

function groupBySourceId(rows: EventRow[]): ScrapeResult[] {
  const map = new Map<string, { scrapedAt: string; events: Event[] }>();
  for (const row of rows) {
    const key = row.sourceId;
    if (!map.has(key)) {
      map.set(key, {
        scrapedAt: row.scrapedAt?.toISOString() || new Date().toISOString(),
        events: [],
      });
    }
    map.get(key)!.events.push(rowToEvent(row));
  }
  return Array.from(map.entries()).map(([sourceId, data]) => ({
    sourceId,
    scrapedAt: data.scrapedAt,
    events: data.events,
  }));
}

// --- ローカル: ファイルシステム（POSTGRES_URL未設定時のフォールバック） ---

async function readFromFile(): Promise<ScrapeResult[]> {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const filePath = join(process.cwd(), "data", "events.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeToFile(data: ScrapeResult[]): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "events.json"), JSON.stringify(data, null, 2), "utf-8");
}
