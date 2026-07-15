import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { createCheckoutSession } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { priceId } = body;

  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  const result = await createCheckoutSession({
    userId: session.user.id,
    email: session.user.email,
    priceId,
    successUrl: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"}/app/account?upgraded=true`,
    cancelUrl: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"}/pricing`,
  });

  if (!result) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
