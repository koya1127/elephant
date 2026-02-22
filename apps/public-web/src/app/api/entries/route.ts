import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addEntry, getUserEntries, checkDuplicate } from "@/lib/entry-storage";
import type { Entry } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getUserEntries(userId);
  return NextResponse.json({ entries });
}

/**
 * POST /api/entries
 * 参加費未設定の大会への無料エントリー
 * （参加費設定済みの場合は /api/stripe/entry-checkout を使用）
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { eventId, eventName, eventDate, disciplines } = body as {
    eventId: string;
    eventName: string;
    eventDate: string;
    disciplines: string[];
  };

  if (!eventId || !eventName || !eventDate) {
    return NextResponse.json(
      { error: "eventId, eventName, eventDate は必須です" },
      { status: 400 }
    );
  }

  // 重複チェック
  const duplicate = await checkDuplicate(userId, eventId);
  if (duplicate) {
    return NextResponse.json(
      { error: "この大会には既にエントリー済みです" },
      { status: 400 }
    );
  }

  // エントリー作成
  const entry: Entry = {
    id: crypto.randomUUID(),
    userId,
    eventId,
    eventName,
    eventDate,
    disciplines,
    status: "submitted",
    createdAt: new Date().toISOString(),
  };

  await addEntry(entry);

  return NextResponse.json({ entry });
}
