import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/admin/events/[id]/fee
 * 参加費・実績費用を更新する
 * Body: { fee?: number | null, actualFee?: number | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const set: Record<string, unknown> = {
    feeSource: "manual",
    updatedAt: new Date(),
  };

  if ("fee" in body) {
    set.fee = body.fee != null ? Number(body.fee) : null;
  }
  if ("actualFee" in body) {
    set.actualFee = body.actualFee != null ? Number(body.actualFee) : null;
  }

  const result = await db
    .update(events)
    .set(set)
    .where(eq(events.id, id))
    .returning({ id: events.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}
