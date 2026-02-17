import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getPlanById } from "@/config/plans";

export const runtime = "nodejs";

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
    const {
      planId,
      lastName,
      firstName,
      lastNameKana,
      firstNameKana,
      birthDate,
      gender,
      phone,
      postalCode,
      address,
      jaafId,
    } = body;

    const plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json(
        { error: "無効なプランです" },
        { status: 400 }
      );
    }

    // Clerk privateMetadataに個人情報を保存
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: {
        lastName,
        firstName,
        lastNameKana,
        firstNameKana,
        birthDate,
        gender,
        phone,
        postalCode,
        address,
        jaafId,
      },
      publicMetadata: {
        memberStatus: "pending",
        planId: plan.id,
        planName: plan.name,
        entryLimit: plan.entryLimit,
        entriesUsed: 0,
        year: new Date().getFullYear(),
      },
    });

    // Stripe Checkout Session作成（fetch直接呼び出し）
    const origin = req.nextUrl.origin;
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][price]", plan.stripePriceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${origin}/join/complete?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/join?plan=${plan.id}`);
    params.append("metadata[userId]", userId);
    params.append("metadata[planId]", plan.id);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
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
    console.error("Checkout error:", message, err);
    return NextResponse.json(
      { error: `決済セッションの作成に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
