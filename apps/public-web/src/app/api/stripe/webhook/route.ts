import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { confirmEntryPayment } from "@/lib/entry-storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Use Stripe SDK only for signature verification (local crypto, no network)
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "unused");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Invalid signature: ${message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const metaType = session.metadata?.type;

    if (userId && metaType === "entry-fee") {
      // エントリー都度決済完了 → エントリーを confirmed に
      try {
        const baseFee = Number(session.metadata?.baseFee) || 0;
        const serviceFee = Number(session.metadata?.serviceFee) || 0;
        const entry = await confirmEntryPayment(session.id, baseFee, serviceFee);
        if (entry) {
          console.log(`Entry payment confirmed: ${entry.id} for event ${entry.eventId}`);
        } else {
          console.warn(`Entry not found for stripe session: ${session.id}`);
        }
      } catch (err) {
        console.error("Failed to confirm entry payment:", err);
        return NextResponse.json(
          { error: "Failed to confirm entry payment" },
          { status: 500 }
        );
      }
    } else if (userId && metaType === "additional-entry") {
      // 追加エントリー購入 → entryLimit を +1
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const currentMeta = user.publicMetadata as Record<string, unknown>;
        const currentLimit = (currentMeta?.entryLimit as number) || 0;

        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMeta,
            entryLimit: currentLimit + 1,
          },
        });

        console.log(`User ${userId} purchased additional entry. New limit: ${currentLimit + 1}`);
      } catch (err) {
        console.error("Failed to update entry limit:", err);
        return NextResponse.json(
          { error: "Failed to update entry limit" },
          { status: 500 }
        );
      }
    } else if (userId) {
      // 通常の入会決済
      const planId = session.metadata?.planId;
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const currentMeta = user.publicMetadata as Record<string, unknown>;

        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...currentMeta,
            memberStatus: "active",
            stripeSessionId: session.id,
          },
          privateMetadata: {
            stripeCustomerId: session.customer as string,
          },
        });

        console.log(`User ${userId} activated with plan ${planId}`);
      } catch (err) {
        console.error("Failed to update user metadata:", err);
        return NextResponse.json(
          { error: "Failed to update user" },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
