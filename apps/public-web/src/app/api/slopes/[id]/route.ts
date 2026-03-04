import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { slopes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** DELETE /api/slopes/[id] — 削除（投稿者 or admin のみ） */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id } = await params;

  const [slope] = await db.select().from(slopes).where(eq(slopes.id, id));
  if (!slope) {
    return NextResponse.json({ error: "坂が見つかりません" }, { status: 404 });
  }

  // 投稿者 or admin のみ削除可
  let isAdmin = false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    isAdmin = (user.publicMetadata as Record<string, unknown>)?.role === "admin";
  } catch {
    // Clerk取得失敗時はadminチェックスキップ
  }

  if (slope.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
  }

  await db.delete(slopes).where(eq(slopes.id, id));
  return NextResponse.json({ ok: true });
}
