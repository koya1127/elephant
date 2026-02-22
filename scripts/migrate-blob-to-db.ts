/**
 * 一回限りのデータ移行スクリプト: Vercel Blob → Postgres
 *
 * 既存の events.json / entries.json を Blob から読み込み、DB に INSERT する。
 *
 * 実行: npx tsx scripts/migrate-blob-to-db.ts
 *
 * 必要な環境変数:
 *   BLOB_READ_WRITE_TOKEN  — Vercel Blob読み取り用
 *   POSTGRES_URL            — 移行先DB
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, entries } from "../apps/public-web/src/lib/db/schema";

// --- Env ---

function loadEnv() {
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
      // skip
    }
  }
}
loadEnv();

// --- Types ---

interface ScrapeResult {
  sourceId: string;
  scrapedAt: string;
  events: Array<{
    id: string;
    name: string;
    date: string;
    dateEnd?: string;
    location: string;
    disciplines: unknown[];
    maxEntries?: number;
    detailUrl: string;
    sourceId: string;
    entryDeadline?: string;
    note?: string;
    pdfSize?: number;
  }>;
}

interface Entry {
  id: string;
  userId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  disciplines: string[];
  status: string;
  createdAt: string;
}

// --- Blob reader ---

async function readBlobJson<T>(blobPath: string): Promise<T | null> {
  const { list } = await import("@vercel/blob");
  try {
    const { blobs } = await list({ prefix: blobPath, limit: 1 });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`Failed to read ${blobPath} from Blob:`, e);
    return null;
  }
}

// --- Main ---

async function main() {
  console.log("=== Blob → Postgres Migration ===\n");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN が未設定。.env.blob を確認。");
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL が未設定。.env.local を確認。");
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL, { ssl: "require" });
  const db = drizzle(client);

  // 1. events.json の移行
  console.log("[1/2] Reading events.json from Blob...");
  const scrapeResults = await readBlobJson<ScrapeResult[]>("events.json");
  if (scrapeResults && scrapeResults.length > 0) {
    let totalEvents = 0;
    for (const result of scrapeResults) {
      totalEvents += result.events.length;
    }
    console.log(`  Found ${scrapeResults.length} sources, ${totalEvents} events total`);

    await db.transaction(async (tx) => {
      for (const result of scrapeResults) {
        for (const event of result.events) {
          await tx
            .insert(events)
            .values({
              id: event.id,
              sourceId: event.sourceId || result.sourceId,
              name: event.name,
              date: event.date,
              dateEnd: event.dateEnd ?? null,
              location: event.location || "",
              disciplines: event.disciplines || [],
              maxEntries: event.maxEntries ?? null,
              detailUrl: event.detailUrl || "",
              entryDeadline: event.entryDeadline ?? null,
              note: event.note ?? null,
              pdfSize: event.pdfSize ?? null,
              scrapedAt: new Date(result.scrapedAt),
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        }
      }
    });
    console.log(`  ✓ ${totalEvents} events migrated`);
  } else {
    console.log("  No events data in Blob, skipping.");
  }

  // 2. entries.json の移行
  console.log("[2/2] Reading entries.json from Blob...");
  const entryList = await readBlobJson<Entry[]>("entries.json");
  if (entryList && entryList.length > 0) {
    console.log(`  Found ${entryList.length} entries`);

    await db.transaction(async (tx) => {
      for (const entry of entryList) {
        await tx
          .insert(entries)
          .values({
            id: entry.id,
            userId: entry.userId,
            eventId: entry.eventId,
            eventName: entry.eventName,
            eventDate: entry.eventDate,
            disciplines: entry.disciplines || [],
            status: entry.status || "submitted",
            createdAt: new Date(entry.createdAt),
          })
          .onConflictDoNothing();
      }
    });
    console.log(`  ✓ ${entryList.length} entries migrated`);
  } else {
    console.log("  No entries data in Blob, skipping.");
  }

  console.log("\n=== Migration complete ===");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
