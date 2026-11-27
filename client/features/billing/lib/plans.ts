import type { CreditPack, PlanType } from "../types";

export type BillingInterval = "monthly" | "yearly";

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

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    amountInr: 50,
    credits: 100,
    bonusPercent: 0,
  },
  {
    id: "learner",
    name: "Learner Pack",
    amountInr: 100,
    credits: 220,
    bonusPercent: 10,
    isPopular: true,
  },
  {
    id: "researcher",
    name: "Researcher Pack",
    amountInr: 250,
    credits: 600,
    bonusPercent: 20,
  },
  {
    id: "power",
    name: "Power Pack",
    amountInr: 500,
    credits: 1300,
    bonusPercent: 30,
  },
];

export function calculateCreditsForInr(amountInr: number): number {
  if (amountInr < 50) return 0;
  const matched = CREDIT_PACKS.find((p) => p.amountInr === amountInr);
  if (matched) return matched.credits;

  const base = amountInr * 2;
  let bonus = 1;
  if (amountInr >= 500) bonus = 1.3;
  else if (amountInr >= 250) bonus = 1.2;
  else if (amountInr >= 100) bonus = 1.1;

  return Math.round(base * bonus);
}

export type PricingPlanConfig = {
  id: PlanType;
  name: string;
  description: string;
  isPopular?: boolean;
  monthlyPriceInr: number;
  yearlyPriceInr: number;
  features: string[];
};

export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "FREE",
    name: "Free",
    description: "100 free credits every day, resetting at 00:00 UTC.",
    monthlyPriceInr: 0,
    yearlyPriceInr: 0,
    features: [
      "100 daily free credits",
      "1 credit per source upload or chat prompt",
      "3 credits per standard artifact",
      "5 credits for compute-heavy artifacts",
      "10 credits per audio debate podcast",
    ],
  },
  {
    id: "PRO",
    name: "Top-Up Credits",
    description: "Pay only for what you use. Credits never expire.",
    isPopular: true,
    monthlyPriceInr: 100,
    yearlyPriceInr: 1000,
    features: [
      "Minimum purchase: ₹50 for 100 credits",
      "Up to 30% bonus on higher packs",
      "Audio Debate Podcasts (10 credits)",
      "Zero recurring monthly fees",
    ],
  },
  {
    id: "PRO_PLUS",
    name: "Power User",
    description: "For active researchers and heavy synthesis.",
    monthlyPriceInr: 500,
    yearlyPriceInr: 5000,
    features: [
      "1,300 credits for ₹500 (30% bonus)",
      "Unlimited workspaces",
      "Full priority RAG processing",
      "Dedicated high-speed audio debate queue",
    ],
  },
];

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
