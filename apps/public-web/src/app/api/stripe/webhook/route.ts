import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

export const runtime = "nodejs";

function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): boolean {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return parts.signatures.some(
    (sig) => crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  );
}

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

  if (!verifyStripeSignature(body, sig, webhookSecret)) {
    console.error("Webhook signature verification failed");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const event = JSON.parse(body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
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
            stripeCustomerId: session.customer,
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
