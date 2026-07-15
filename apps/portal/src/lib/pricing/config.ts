export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular: boolean;
  prices: Record<string, { amount: number; currency: string }>;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for getting started with RAG.",
    features: [
      "Unlimited queries",
      "5 chunking strategies",
      "2 embedding providers",
      "Community support",
    ],
    cta: "Get started",
    href: "/signup",
    popular: false,
    prices: {
      US: { amount: 0, currency: "USD" },
      IN: { amount: 0, currency: "INR" },
      GB: { amount: 0, currency: "GBP" },
      EU: { amount: 0, currency: "EUR" },
      AU: { amount: 0, currency: "AUD" },
      JP: { amount: 0, currency: "JPY" },
      BR: { amount: 0, currency: "BRL" },
      DEFAULT: { amount: 0, currency: "USD" },
    },
  },
  {
    id: "developer",
    name: "Developer",
    description: "For individual researchers and students.",
    features: [
      "All RAG strategies",
      "Embedding experiments",
      "Chunking studio",
      "Retrieval evaluation",
      "API access",
    ],
    cta: "Get started",
    href: "/signup",
    popular: false,
    prices: {
      US: { amount: 0, currency: "USD" },
      IN: { amount: 0, currency: "INR" },
      GB: { amount: 0, currency: "GBP" },
      EU: { amount: 0, currency: "EUR" },
      AU: { amount: 0, currency: "AUD" },
      JP: { amount: 0, currency: "JPY" },
      BR: { amount: 0, currency: "BRL" },
      DEFAULT: { amount: 0, currency: "USD" },
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For advanced AI/ML research projects.",
    features: [
      "Multi-strategy engine",
      "Configurable embeddings",
      "Retrieval comparison",
      "Performance metrics",
      "Explainable pipeline",
      "Full observability",
    ],
    cta: "Start building",
    href: "/signup",
    popular: true,
    prices: {
      US: { amount: 0, currency: "USD" },
      IN: { amount: 0, currency: "INR" },
      GB: { amount: 0, currency: "GBP" },
      EU: { amount: 0, currency: "EUR" },
      AU: { amount: 0, currency: "AUD" },
      JP: { amount: 0, currency: "JPY" },
      BR: { amount: 0, currency: "BRL" },
      DEFAULT: { amount: 0, currency: "USD" },
    },
  },
  {
    id: "research",
    name: "Research",
    description: "For academic research and AI/ML projects.",
    features: [
      "All features included",
      "Open-source codebase",
      "GitHub authentication",
      "Community support",
      "Self-hosting options",
      "MIT license",
    ],
    cta: "Get started",
    href: "/signup",
    popular: false,
    prices: {
      US: { amount: 0, currency: "USD" },
      IN: { amount: 0, currency: "INR" },
      GB: { amount: 0, currency: "GBP" },
      EU: { amount: 0, currency: "EUR" },
      AU: { amount: 0, currency: "AUD" },
      JP: { amount: 0, currency: "JPY" },
      BR: { amount: 0, currency: "BRL" },
      DEFAULT: { amount: 0, currency: "USD" },
    },
  },
];

const REGION_MAP: Record<string, string> = {
  US: "US",
  CA: "US",
  MX: "US",
  BR: "BR",
  GB: "GB",
  IE: "GB",
  IN: "IN",
  DE: "EU",
  FR: "EU",
  IT: "EU",
  ES: "EU",
  NL: "EU",
  BE: "EU",
  AT: "EU",
  PT: "EU",
  PL: "EU",
  SE: "EU",
  DK: "EU",
  FI: "EU",
  CZ: "EU",
  RO: "EU",
  HU: "EU",
  BG: "EU",
  HR: "EU",
  SK: "EU",
  LT: "EU",
  LV: "EU",
  EE: "EU",
  SI: "EU",
  CY: "EU",
  LU: "EU",
  MT: "EU",
  GR: "EU",
  AU: "AU",
  NZ: "AU",
  JP: "JP",
  KR: "JP",
  SG: "DEFAULT",
  HK: "DEFAULT",
  DEFAULT: "DEFAULT",
};

export function detectRegion(headers: Headers): string {
  const cfCountry = headers.get("cf-ipcountry");
  if (cfCountry && REGION_MAP[cfCountry.toUpperCase()]) {
    return REGION_MAP[cfCountry.toUpperCase()];
  }

  const vercelCountry = headers.get("x-vercel-ip-country");
  if (vercelCountry && REGION_MAP[vercelCountry.toUpperCase()]) {
    return REGION_MAP[vercelCountry.toUpperCase()];
  }

  const acceptLanguage = headers.get("accept-language");
  if (acceptLanguage) {
    const primary = acceptLanguage.split(",")[0]?.split("-")[1]?.toUpperCase();
    if (primary && REGION_MAP[primary]) {
      return REGION_MAP[primary];
    }
  }

  return "DEFAULT";
}

export function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Free";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function getPlanPrice(
  plan: PricingPlan,
  region: string,
): { amount: number; currency: string; formatted: string } {
  const price = plan.prices[region] || plan.prices.DEFAULT;
  return {
    ...price,
    formatted: formatPrice(price.amount, price.currency),
  };
}
