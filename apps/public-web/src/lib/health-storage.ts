import type { SiteHealthResult, YearHealth } from "./types";
import { db } from "./db";
import { healthChecks } from "./db/schema";

export async function readHealth(): Promise<SiteHealthResult[]> {
  if (!process.env.POSTGRES_URL) {
    return readFromFile();
  }
  try {
    const rows = await db.select().from(healthChecks);
    return groupBySiteId(rows);
  } catch (e) {
    console.error("[health-storage] readHealth error:", e);
    return [];
  }
}

export async function writeHealth(data: SiteHealthResult[]): Promise<void> {
  if (!process.env.POSTGRES_URL) {
    return writeToFile(data);
  }
  await db.transaction(async (tx) => {
    // 全削除→全挿入（毎回全更新）
    await tx.delete(healthChecks);
    for (const result of data) {
      for (const year of result.years) {
        await tx.insert(healthChecks).values({
          siteId: result.siteId,
          siteName: result.siteName,
          year: year.year,
          eventCount: year.eventCount,
          pdfTotal: year.pdfTotal,
          pdfOk: year.pdfOk,
          pdfErrors: year.pdfErrors,
          error: result.error ?? null,
          checkedAt: new Date(result.checkedAt),
        });
      }
      // エラーがあるがyearsが空の場合でもレコードを残す
      if (result.years.length === 0 && result.error) {
        await tx.insert(healthChecks).values({
          siteId: result.siteId,
          siteName: result.siteName,
          year: 0,
          eventCount: 0,
          pdfTotal: 0,
          pdfOk: 0,
          pdfErrors: [],
          error: result.error,
          checkedAt: new Date(result.checkedAt),
        });
      }
    }
  });
}

// --- DB row → SiteHealthResult 変換 ---

type HealthRow = typeof healthChecks.$inferSelect;

function groupBySiteId(rows: HealthRow[]): SiteHealthResult[] {
  const map = new Map<string, SiteHealthResult>();
  for (const row of rows) {
    const key = row.siteId;
    if (!map.has(key)) {
      map.set(key, {
        siteId: row.siteId,
        siteName: row.siteName,
        checkedAt: row.checkedAt?.toISOString() || new Date().toISOString(),
        years: [],
        error: row.error ?? undefined,
      });
    }
    const result = map.get(key)!;
    // year=0 はエラー専用レコード（years には追加しない）
    if (row.year !== 0) {
      const yh: YearHealth = {
        year: row.year,
        eventCount: row.eventCount ?? 0,
        pdfTotal: row.pdfTotal ?? 0,
        pdfOk: row.pdfOk ?? 0,
        pdfErrors: (row.pdfErrors as string[]) || [],
      };
      result.years.push(yh);
    }
  }
  return Array.from(map.values());
}

// --- ローカル: ファイルシステム ---

async function readFromFile(): Promise<SiteHealthResult[]> {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const filePath = join(process.cwd(), "data", "health.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeToFile(data: SiteHealthResult[]): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { join } = await import("path");
  const dir = join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "health.json"), JSON.stringify(data, null, 2), "utf-8");
}
