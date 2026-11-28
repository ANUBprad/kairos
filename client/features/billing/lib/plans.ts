import type { CreditPack, CreditSnapshot, PlanType } from "../types";

export const CREDIT_COSTS = {
  SOURCE_UPLOAD: 1,
  CHAT_MESSAGE: 1,
  ARTIFACT_GENERATE: 3,
  ARTIFACT_COMPUTE: 5,
  AUDIO_DEBATE: 10,
} as const;

const COMPUTE_HEAVY_ARTIFACTS = new Set(["MINDMAP", "DIAGRAM", "REPORT"]);

/** Mirrors the server-owned artifact pricing table for pre-action UI labels. */
export function getArtifactCreditCost(artifactType: string): number {
  if (artifactType === "PODCAST") return CREDIT_COSTS.AUDIO_DEBATE;
  if (COMPUTE_HEAVY_ARTIFACTS.has(artifactType)) {
    return CREDIT_COSTS.ARTIFACT_COMPUTE;
  }
  return CREDIT_COSTS.ARTIFACT_GENERATE;
}

/**
 * Mirrors the server-owned one-time credit packs. The server validates every
 * amount and awards the credits; these values are display/validation hints only.
 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    amountInr: 99,
    credits: 100,
    bonusPercent: 0,
  },
  {
    id: "learner",
    name: "Learner Pack",
    amountInr: 199,
    credits: 220,
    bonusPercent: 10,
    isPopular: true,
  },
  {
    id: "researcher",
    name: "Researcher Pack",
    amountInr: 499,
    credits: 600,
    bonusPercent: 20,
  },
  {
    id: "power",
    name: "Power Pack",
    amountInr: 999,
    credits: 1300,
    bonusPercent: 30,
  },
];

/** Mirrors `ALLOWED_CREDIT_AMOUNTS_INR` on the server. */
export const ALLOWED_CREDIT_AMOUNTS_INR: readonly number[] = CREDIT_PACKS.map(
  (pack) => pack.amountInr,
);

export const MIN_CREDIT_PACK_AMOUNT_INR = CREDIT_PACKS[0]?.amountInr ?? 99;

export function isAllowedCreditAmount(amountInr: number): boolean {
  return ALLOWED_CREDIT_AMOUNTS_INR.includes(amountInr);
}

/**
 * Snaps a custom amount to an allow-listed server price. Never sends an amount
 * the server validator would reject.
 */
export function snapToAllowedCreditAmount(amountInr: number): number {
  if (!Number.isFinite(amountInr)) return MIN_CREDIT_PACK_AMOUNT_INR;
  if (isAllowedCreditAmount(amountInr)) return amountInr;

  return ALLOWED_CREDIT_AMOUNTS_INR.reduce((closest, candidate) =>
    Math.abs(candidate - amountInr) < Math.abs(closest - amountInr)
      ? candidate
      : closest,
  );
}

export function calculateCreditsForInr(amountInr: number): number {
  const allowedAmount = snapToAllowedCreditAmount(amountInr);
  return CREDIT_PACKS.find((pack) => pack.amountInr === allowedAmount)?.credits ?? 0;
}

/** Server-owned fallback values, used only until the API responds. */
export const FREE_WINDOW_ALLOWANCE = 100;
export const WINDOWS_PER_DAY = 4;
export const PLAN_ACCESS_DESCRIPTION = "One-time 30-day access";
export const DEVELOPER_ENTITLEMENT_LABEL =
  "Developer account — credits and FREE quotas are bypassed";

export type CreditWindowSource = Partial<CreditSnapshot> | null | undefined;

/**
 * Prefers the server's new credit-window fields and falls back to the legacy
 * daily fields. It only selects server-provided values: no reset time is
 * calculated here and no browser clock is consulted for authorization.
 */
export function resolveCreditWindow(source: CreditWindowSource) {
  const windowCredits = source?.dailyCredits ?? 0;
  const windowAllowance =
    source?.windowAllowance ?? source?.dailyAllowance ?? FREE_WINDOW_ALLOWANCE;
  const creditWindowStart = source?.creditWindowStart ?? source?.dailyCreditDay ?? "";
  const nextCreditResetAt =
    source?.nextCreditResetAt ?? source?.nextDailyResetAt ?? "";
  const isDeveloper = Boolean(
    source?.isDeveloper || source?.developer || source?.entitlement?.developer,
  );

  return {
    credits: source?.credits ?? 0,
    windowCredits,
    paidCredits: source?.paidCredits ?? 0,
    windowAllowance,
    creditWindowStart,
    nextCreditResetAt,
    windowsPerDay: source?.windowsPerDay ?? WINDOWS_PER_DAY,
    serverTime: source?.serverTime ?? "",
    isDeveloper,
    bypassCredits: Boolean(isDeveloper || source?.entitlement?.bypassCredits),
    bypassFreeQuotas: Boolean(isDeveloper || source?.entitlement?.bypassFreeQuotas),
    // Backward-compatible aliases for callers still using legacy field names.
    dailyCredits: windowCredits,
    dailyAllowance: windowAllowance,
    dailyCreditDay: creditWindowStart,
    nextDailyResetAt: nextCreditResetAt,
  };
}

/** Formats a server-provided ISO instant in UTC, never in browser-local time. */
export function formatUtcInstant(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  const utc = date.toISOString();
  return `${utc.slice(0, 10)} at ${utc.slice(11, 16)} UTC`;
}

export type PricingPlanConfig = {
  id: PlanType;
  name: string;
  description: string;
  isPopular?: boolean;
  priceInr: number;
  access: string;
  features: string[];
};

/**
 * Mirrors server-owned plan prices. Plans are one-time purchases with a finite
 * access window; they are not recurring subscriptions.
 */
export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "FREE",
    name: "Free",
    description: `Free credits are granted each server-defined window; unused credits expire at the next reset shown in your account.`,
    priceInr: 0,
    access: "No purchase required",
    features: [
      `${FREE_WINDOW_ALLOWANCE} free credits per window`,
      "Short UTC credit windows set by the server",
      "1 credit per source upload or chat prompt",
      "3 credits per standard artifact",
      "5 credits for compute-heavy artifacts",
    ],
  },
  {
    id: "PRO",
    name: "Kairos Pro",
    description: "More room for active research projects.",
    isPopular: true,
    priceInr: 299,
    access: PLAN_ACCESS_DESCRIPTION,
    features: [
      "Higher workspace limit",
      "Full priority RAG processing",
      "Cited chat and all artifact tools",
      "No automatic renewal",
    ],
  },
  {
    id: "PRO_PLUS",
    name: "Kairos Pro+",
    description: "For heavy synthesis and larger libraries.",
    priceInr: 699,
    access: PLAN_ACCESS_DESCRIPTION,
    features: [
      "Highest workspace limit",
      "Full priority RAG processing",
      "Dedicated high-speed audio debate queue",
      "No automatic renewal",
    ],
  },
];

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
