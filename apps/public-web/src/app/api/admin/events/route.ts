import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import type { Discipline } from "@/lib/types";

/**
 * GET /api/admin/events
 * イベント一覧（fee情報付き）を返す
 * Query: ?filter=unset|no-actual|upcoming (省略時は全件)
 */
export async function GET(request: Request) {
  const auth = await checkAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter");

  let rows;
  if (filter === "upcoming") {
    const today = new Date().toISOString().slice(0, 10);
    rows = await db.select().from(events).where(gte(events.date, today));
  } else {
    rows = await db.select().from(events);
  }

  let result = rows.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    dateEnd: row.dateEnd,
    location: row.location,
    sourceId: row.sourceId,
    fee: row.fee,
    actualFee: row.actualFee,
    feeSource: row.feeSource,
    note: row.note,
    disciplines: row.disciplines as Discipline[],
  }));

  if (filter === "unset") {
    result = result.filter((e) => e.fee == null);
  } else if (filter === "no-actual") {
    result = result.filter((e) => e.actualFee == null);
  }

  // 日付降順
  result.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ events: result });
}
