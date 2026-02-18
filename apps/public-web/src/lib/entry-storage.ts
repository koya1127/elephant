import type { Entry } from "./types";

const BLOB_PATH = "entries.json";

export async function readEntries(): Promise<Entry[]> {
  if (process.env.VERCEL) {
    return readFromBlob();
  }
  return readFromFile();
}

export async function writeEntries(data: Entry[]): Promise<void> {
  if (process.env.VERCEL) {
    return writeToBlob(data);
  }
  return writeToFile(data);
}

export async function addEntry(entry: Entry): Promise<void> {
  const entries = await readEntries();
  entries.push(entry);
  await writeEntries(entries);
}

export async function getUserEntries(userId: string): Promise<Entry[]> {
  const entries = await readEntries();
  return entries.filter((e) => e.userId === userId);
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

// --- Vercel: Blob ストレージ ---

async function readFromBlob(): Promise<Entry[]> {
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

async function writeToBlob(data: Entry[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  const json = JSON.stringify(data, null, 2);
  await put(BLOB_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
