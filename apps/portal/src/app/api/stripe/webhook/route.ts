import { NextRequest, NextResponse } from "next/server";
import { handleWebhook } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const body = await request.text();
    const result = await handleWebhook(body, signature);
    logger.info("Stripe webhook processed", { event: result.event, userId: result.userId });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook failed", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
