import type { ScrapeResult } from "./types";

const BLOB_PATH = "events.json";

/**
 * 保存済みの大会データを読み込む
 * - ローカル: data/events.json（ファイルシステム）
 * - Vercel: Blob ストレージ
 */
export async function readEvents(): Promise<ScrapeResult[]> {
  if (process.env.VERCEL) {
    return readFromBlob();
  }
  return readFromFile();
}

/**
 * 大会データを保存する
 * - ローカル: data/events.json（ファイルシステム）
 * - Vercel: Blob ストレージ
 */
export async function writeEvents(data: ScrapeResult[]): Promise<void> {
  if (process.env.VERCEL) {
    return writeToBlob(data);
  }
  return writeToFile(data);
}

// --- ローカル: ファイルシステム ---

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

// --- Vercel: Blob ストレージ ---

async function readFromBlob(): Promise<ScrapeResult[]> {
  const { list } = await import("@vercel/blob");
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].url);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeToBlob(data: ScrapeResult[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  const json = JSON.stringify(data, null, 2);
  await put(BLOB_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}
