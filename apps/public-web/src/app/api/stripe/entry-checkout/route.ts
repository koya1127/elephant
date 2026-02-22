import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { events, entries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { addEntry, checkDuplicate } from "@/lib/entry-storage";
import { ENTRY_SERVICE_FEE, STRIPE_FEE_RATE } from "@/config/fees";
import type { Entry } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/stripe/entry-checkout
 * エントリー用のStripe Checkout Sessionを作成する
 *
 * Body: { eventId, eventName, eventDate, disciplines }
 */
export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe設定エラー: APIキーが未設定です" },
        { status: 500 }
      );
    }

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

    // イベントの参加費を取得
    const [event] = await db
      .select({ fee: events.fee })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event || event.fee == null) {
      return NextResponse.json(
        { error: "この大会の参加費が設定されていません" },
        { status: 400 }
      );
    }

    const baseFee = event.fee;
    const serviceFee = ENTRY_SERVICE_FEE;
    const subtotal = baseFee + serviceFee;
    // Stripe手数料を上乗せ: total = ceil(subtotal / (1 - rate))
    const total = Math.ceil(subtotal / (1 - STRIPE_FEE_RATE));

    // pending_payment状態でエントリーを仮作成
    const entryId = crypto.randomUUID();
    const stripeSessionIdPlaceholder = `pending_${entryId}`;

    const entry: Entry = {
      id: entryId,
      userId,
      eventId,
      eventName,
      eventDate,
      disciplines,
      status: "pending_payment",
      feePaid: baseFee,
      serviceFeePaid: serviceFee,
      stripeSessionId: stripeSessionIdPlaceholder,
      createdAt: new Date().toISOString(),
    };
    await addEntry(entry);

    // Stripe Checkout Session作成（fetch直接）
    const origin = req.nextUrl.origin;
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price_data][currency]", "jpy");
    params.append("line_items[0][price_data][product_data][name]", `${eventName} エントリー`);
    params.append(
      "line_items[0][price_data][product_data][description]",
      `参加費 ¥${baseFee.toLocaleString()} + 手数料 ¥${serviceFee.toLocaleString()}`
    );
    params.append("line_items[0][price_data][unit_amount]", String(total));
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${origin}/events?entry_success=1`);
    params.append("cancel_url", `${origin}/events?entry_cancelled=1`);
    params.append("metadata[userId]", userId);
    params.append("metadata[eventId]", eventId);
    params.append("metadata[entryId]", entryId);
    params.append("metadata[type]", "entry-fee");
    params.append("metadata[baseFee]", String(baseFee));
    params.append("metadata[serviceFee]", String(serviceFee));
    params.append("metadata[disciplines]", JSON.stringify(disciplines));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe API error:", session);
      return NextResponse.json(
        { error: `Stripeエラー: ${session.error?.message || "不明なエラー"}` },
        { status: 500 }
      );
    }

    // stripeSessionIdを更新
    await db
      .update(entries)
      .set({ stripeSessionId: session.id })
      .where(eq(entries.id, entryId));

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Entry checkout error:", message, err);
    return NextResponse.json(
      { error: `決済セッションの作成に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
