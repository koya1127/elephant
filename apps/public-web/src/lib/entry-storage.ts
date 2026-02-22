import type { Entry } from "./types";
import { db } from "./db";
import { entries } from "./db/schema";
import { eq, and } from "drizzle-orm";

export async function readEntries(): Promise<Entry[]> {
  if (!process.env.POSTGRES_URL) {
    return readFromFile();
  }
  try {
    const rows = await db.select().from(entries);
    return rows.map(rowToEntry);
  } catch (e) {
    console.error("[entry-storage] readEntries error:", e);
    return [];
  }
}

export async function addEntry(entry: Entry): Promise<void> {
  if (!process.env.POSTGRES_URL) {
    const all = await readFromFile();
    all.push(entry);
    return writeToFile(all);
  }
  await db.insert(entries).values({
    id: entry.id,
    userId: entry.userId,
    eventId: entry.eventId,
    eventName: entry.eventName,
    eventDate: entry.eventDate,
    disciplines: entry.disciplines,
    status: entry.status,
    feePaid: entry.feePaid ?? null,
    serviceFeePaid: entry.serviceFeePaid ?? null,
    stripeSessionId: entry.stripeSessionId ?? null,
    createdAt: new Date(entry.createdAt),
  });
}

export async function getUserEntries(userId: string): Promise<Entry[]> {
  if (!process.env.POSTGRES_URL) {
    const all = await readFromFile();
    return all.filter((e) => e.userId === userId);
  }
  try {
    const rows = await db.select().from(entries).where(eq(entries.userId, userId));
    return rows.map(rowToEntry);
  } catch (e) {
    console.error("[entry-storage] getUserEntries error:", e);
    return [];
  }
}

export async function checkDuplicate(userId: string, eventId: string): Promise<boolean> {
  if (!process.env.POSTGRES_URL) {
    const all = await readFromFile();
    return all.some((e) => e.userId === userId && e.eventId === eventId);
  }
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.eventId, eventId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Stripe決済完了時にエントリーのステータスと決済情報を更新
 */
export async function confirmEntryPayment(
  stripeSessionId: string,
  feePaid: number,
  serviceFeePaid: number
): Promise<Entry | null> {
  if (!process.env.POSTGRES_URL) return null;
  const rows = await db
    .update(entries)
    .set({
      status: "submitted",
      feePaid,
      serviceFeePaid,
    })
    .where(eq(entries.stripeSessionId, stripeSessionId))
    .returning();
  if (rows.length === 0) return null;
  return rowToEntry(rows[0]);
}

// --- DB row → Entry 変換 ---

type EntryRow = typeof entries.$inferSelect;

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    eventName: row.eventName,
    eventDate: row.eventDate,
    disciplines: (row.disciplines as string[]) || [],
    status: (row.status as "submitted" | "pending_payment") || "submitted",
    feePaid: row.feePaid ?? undefined,
    serviceFeePaid: row.serviceFeePaid ?? undefined,
    stripeSessionId: row.stripeSessionId ?? undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

// --- ローカル: ファイルシステム ---

async function readFromFile(): Promise<Entry[]> {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const filePath = join(process.cwd(), "data", "entries.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeToFile(data: Entry[]): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "entries.json"), JSON.stringify(data, null, 2), "utf-8");
}
