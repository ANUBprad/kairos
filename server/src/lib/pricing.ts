/**
 * Server-owned pricing. Never derive an authoritative amount from the client.
 *
 * This is the single source of truth for current prices and for the historical
 * prices retained only so already-created payment rows can still be settled
 * with their original amount and credit award.
 */

/** Credit packs are one-time purchases, not timed subscriptions. */
export const CREDIT_PACKS = [
  { id: "starter", name: "Starter Pack", amountInr: 99, credits: 100, bonusPercent: 0 },
  { id: "learner", name: "Learner Pack", amountInr: 199, credits: 220, bonusPercent: 10, isPopular: true },
  { id: "researcher", name: "Researcher Pack", amountInr: 499, credits: 600, bonusPercent: 20 },
  { id: "power", name: "Power Pack", amountInr: 999, credits: 1300, bonusPercent: 30 },
] as const;

/**
 * Plan purchases grant a finite, one-time 30-day access window. There is no
 * recurring billing, mandate, cron, or automatic renewal in the backend.
 */
export const PLAN_ACCESS_DESCRIPTION = "One-time 30-day access";

export const PLAN_PRICES = {
  PRO: {
    pricePaise: 29900,
    label: "₹299 one-time / 30 days",
    name: "Kairos Pro",
    credits: 500,
    access: PLAN_ACCESS_DESCRIPTION,
  },
  PRO_PLUS: {
    pricePaise: 69900,
    label: "₹699 one-time / 30 days",
    name: "Kairos Pro+",
    credits: 1500,
    access: PLAN_ACCESS_DESCRIPTION,
  },
} as const;

export type PurchasablePlan = keyof typeof PLAN_PRICES;

export const ALLOWED_CREDIT_AMOUNTS_INR: readonly number[] = CREDIT_PACKS.map(
  (pack) => pack.amountInr,
);

/** Returns the server-owned credit award for an allow-listed INR amount. */
export function calculateCreditsForInr(amountInr: number): number {
  const matchedPack = CREDIT_PACKS.find((p) => p.amountInr === amountInr);
  if (!matchedPack) {
    throw new Error("Unsupported top-up amount");
  }
  return matchedPack.credits;
}

/**
 * Historical credit-pack prices. Used only when classifying an already-created
 * payment row; NEVER by validators or order creation. This keeps pending and
 * successful legacy orders payable/settleable with their original entitlement
 * without rewriting balances or payment rows.
 */
export const HISTORICAL_CREDIT_PACK_PRICES = [
  { id: "starter", amountInr: 50, credits: 100 },
  { id: "learner", amountInr: 100, credits: 220 },
  { id: "researcher", amountInr: 250, credits: 600 },
  { id: "power", amountInr: 500, credits: 1300 },
] as const;

/** Historical one-time plan prices, also used only for legacy row classification. */
export const HISTORICAL_PLAN_PRICES = {
  PRO: { pricePaise: 19900, credits: 500 },
  PRO_PLUS: { pricePaise: 49900, credits: 1500 },
} as const;

export function historicalCreditPackCreditsForInr(amountInr: number): number | null {
  return (
    HISTORICAL_CREDIT_PACK_PRICES.find((pack) => pack.amountInr === amountInr)
      ?.credits ?? null
  );
}
