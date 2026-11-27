/**
 * Server-owned pricing. Never derive an authoritative amount from the client.
 */
export const CREDIT_PACKS = [
  { id: "starter", name: "Starter Pack", amountInr: 50, credits: 100, bonusPercent: 0 },
  { id: "learner", name: "Learner Pack", amountInr: 100, credits: 220, bonusPercent: 10, isPopular: true },
  { id: "researcher", name: "Researcher Pack", amountInr: 250, credits: 600, bonusPercent: 20 },
  { id: "power", name: "Power Pack", amountInr: 500, credits: 1300, bonusPercent: 30 },
] as const;

export const PLAN_PRICES = {
  PRO: { pricePaise: 19900, label: "₹199 / month", name: "Kairos Pro", credits: 500 },
  PRO_PLUS: { pricePaise: 49900, label: "₹499 / month", name: "Kairos Pro+", credits: 1500 },
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
