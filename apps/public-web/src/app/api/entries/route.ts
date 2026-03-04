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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  // エントリー機能は現在準備中
  // TODO: 準備完了後に元のPOST処理を復元する
  return NextResponse.json(
    { error: "エントリー機能は現在準備中です。もうしばらくお待ちください。" },
    { status: 503 }
  );
}
