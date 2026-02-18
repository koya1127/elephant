import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ADDITIONAL_ENTRY_STRIPE_PRICE_ID } from "@/config/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe設定エラー" },
        { status: 500 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = req.nextUrl.origin;
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price]", ADDITIONAL_ENTRY_STRIPE_PRICE_ID);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${origin}/events?additional=success`);
    params.append("cancel_url", `${origin}/events`);
    params.append("metadata[userId]", userId);
    params.append("metadata[type]", "additional-entry");

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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Additional entry checkout error:", message);
    return NextResponse.json(
      { error: `エラーが発生しました: ${message}` },
      { status: 500 }
    );
  }
}
