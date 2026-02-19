import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { readEntries } from "@/lib/entry-storage";

export const runtime = "nodejs";

export async function GET() {
  const result = await checkAdmin();
  if (!result.ok) return result.response;

  const entries = await readEntries();
  return NextResponse.json({ entries });
}
