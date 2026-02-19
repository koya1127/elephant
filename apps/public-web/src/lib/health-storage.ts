import type { SiteHealthResult } from "./types";

const BLOB_PATH = "health.json";

export async function readHealth(): Promise<SiteHealthResult[]> {
  if (process.env.VERCEL) {
    return readFromBlob();
  }
  return readFromFile();
}

export async function writeHealth(data: SiteHealthResult[]): Promise<void> {
  if (process.env.VERCEL) {
    return writeToBlob(data);
  }
  return writeToFile(data);
}

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

async function readFromBlob(): Promise<SiteHealthResult[]> {
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

async function writeToBlob(data: SiteHealthResult[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  const json = JSON.stringify(data, null, 2);
  await put(BLOB_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
