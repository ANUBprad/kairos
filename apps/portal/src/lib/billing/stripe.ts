import Stripe from "stripe";
import { logger } from "@/lib/logger";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  if (_stripe) return _stripe;
  _stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2026-06-24.dahlia",
  });
  return _stripe;
}

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) {
    logger.warn("Stripe not configured — checkout unavailable");
    return null;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.email,
    metadata: { userId: params.userId },
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      trial_period_days: 14,
    },
  });

  return session.url ? { url: session.url } : null;
}

export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url ? { url: session.url } : null;
}

export async function handleWebhook(
  body: string | Buffer,
  signature: string,
): Promise<{ event: string; userId?: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await syncSubscription(userId, session.subscription as string, session.customer as string);
      }
      return { event: event.type, userId };
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        await syncSubscription(userId, sub.id, sub.customer as string);
      }
      return { event: event.type, userId };
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        const { prisma } = await import("@/lib/prisma");
        await prisma.subscription.update({
          where: { userId },
          data: { status: "CANCELED", plan: "FREE" },
        });
      }
      return { event: event.type, userId };
    }
    default:
      return { event: event.type };
  }
}

async function syncSubscription(
  userId: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
) {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = sub.items.data[0]?.price.id;

  const { prisma } = await import("@/lib/prisma");
  const { mapStripePriceToPlan } = await import("./plans");

  const plan = mapStripePriceToPlan(priceId ?? "");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny = sub as any;
  const periodStart = subAny.current_period_start ? new Date(subAny.current_period_start * 1000) : new Date();
  const periodEnd = subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : new Date();
  const trialEnd = subAny.trial_end ? new Date(subAny.trial_end * 1000) : null;

  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    trialing: "TRIALING",
  };

  const subStatus = statusMap[sub.status] ?? "CANCELED";

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId ?? null,
      plan: plan as any,
      status: subStatus as any,
      trialEndsAt: trialEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId ?? null,
      plan: plan as any,
      status: subStatus as any,
      trialEndsAt: trialEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}
