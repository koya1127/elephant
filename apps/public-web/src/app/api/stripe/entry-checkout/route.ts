import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/entry-checkout
 * エントリー用のStripe Checkout Sessionを作成する
 * ※現在準備中 — TODO: 準備完了後に元の処理を復元する（git diff mainで確認可）
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "エントリー機能は現在準備中です。もうしばらくお待ちください。" },
    { status: 503 }
  );
}
