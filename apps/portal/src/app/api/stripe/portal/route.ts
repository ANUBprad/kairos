import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { createPortalSession } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const result = await createPortalSession({
    customerId: sub.stripeCustomerId,
    returnUrl: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"}/app/account`,
  });

  if (!result) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
