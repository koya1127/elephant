import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

// Force Node.js runtime (Stripe SDK requires it)
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (userId && planId) {
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

        console.log(
          `User ${userId} activated with plan ${planId}`
        );
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
