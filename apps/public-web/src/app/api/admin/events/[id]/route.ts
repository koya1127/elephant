import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { events, entries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ALLOWED_FIELDS = new Set(["name", "date", "location", "note"]);

/**
 * PATCH /api/admin/events/[id]
 * イベントの基本情報を更新する（name, date, location, note のみ）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      set[key] = body[key] ?? null;
    }
  }

  if (Object.keys(set).length === 1) {
    return NextResponse.json({ error: "更新可能なフィールドがありません" }, { status: 400 });
  }

  const result = await db
    .update(events)
    .set(set)
    .where(eq(events.id, id))
    .returning({ id: events.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}

/**
 * DELETE /api/admin/events/[id]
 * イベントを削除する（エントリーがある場合は拒否）
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // FK制約チェック: entriesに参照がある場合は拒否
  const refs = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.eventId, id))
    .limit(1);

  if (refs.length > 0) {
    return NextResponse.json(
      { error: "エントリーが存在するため削除できません" },
      { status: 409 }
    );
  }

  const result = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning({ id: events.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}
