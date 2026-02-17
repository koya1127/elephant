import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getPlanById } from "@/config/plans";

export async function POST(req: NextRequest) {
  try {
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

    // Stripe Checkout Session作成
    const origin = req.nextUrl.origin;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/join/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/join?plan=${plan.id}`,
      metadata: {
        userId,
        planId: plan.id,
      },
    });

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
