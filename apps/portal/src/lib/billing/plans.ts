export type PlanType = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface PlanLimits {
  knowledgeBases: number;
  documents: number;
  aiChats: number;
  storageMB: number;
  uploadsPerDay: number;
  apiKeys: number;
  teamMembers: number;
  ocr: "basic" | "standard" | "advanced" | "enterprise";
  visionModels: boolean;
  deepResearch: "none" | "limited" | "unlimited";
  agents: number;
  apiAccess: boolean;
  auditLogs: boolean;
  rbac: boolean;
  sso: boolean;
  sla: "community" | "email" | "priority" | "24/7" | "dedicated";
  teamWorkspaces: boolean;
  analytics: boolean;
  priorityQueue: boolean;
  credits: number;
}

export interface PlanDefinition {
  id: PlanType;
  name: string;
  description: string;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  prices: Record<string, { monthly: number; yearly: number; currency: string }>;
  limits: PlanLimits;
  features: string[];
  popular?: boolean;
  badge?: string;
}

export const PLANS: Record<PlanType, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "Perfect for getting started with RAG research.",
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    prices: {
      US: { monthly: 0, yearly: 0, currency: "USD" },
      GB: { monthly: 0, yearly: 0, currency: "GBP" },
      EU: { monthly: 0, yearly: 0, currency: "EUR" },
      IN: { monthly: 0, yearly: 0, currency: "INR" },
      CA: { monthly: 0, yearly: 0, currency: "CAD" },
      AU: { monthly: 0, yearly: 0, currency: "AUD" },
      JP: { monthly: 0, yearly: 0, currency: "JPY" },
      DEFAULT: { monthly: 0, yearly: 0, currency: "USD" },
    },
    limits: {
      knowledgeBases: 2,
      documents: 50,
      aiChats: 100,
      storageMB: 1024,
      uploadsPerDay: 10,
      apiKeys: 0,
      teamMembers: 1,
      ocr: "basic",
      visionModels: false,
      deepResearch: "none",
      agents: 0,
      apiAccess: false,
      auditLogs: false,
      rbac: false,
      sso: false,
      sla: "community",
      teamWorkspaces: false,
      analytics: false,
      priorityQueue: false,
      credits: 100,
    },
    features: [
      "2 Knowledge Bases",
      "1 GB Storage",
      "100 AI Chats/month",
      "50 Documents",
      "Community Support",
      "100 AI Credits/month",
    ],
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    description: "For individual researchers and small projects.",
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    prices: {
      US: { monthly: 900, yearly: 9000, currency: "USD" },
      GB: { monthly: 700, yearly: 7000, currency: "GBP" },
      EU: { monthly: 800, yearly: 8000, currency: "EUR" },
      IN: { monthly: 750, yearly: 7500, currency: "INR" },
      CA: { monthly: 1200, yearly: 12000, currency: "CAD" },
      AU: { monthly: 1300, yearly: 13000, currency: "AUD" },
      JP: { monthly: 1300, yearly: 13000, currency: "JPY" },
      DEFAULT: { monthly: 900, yearly: 9000, currency: "USD" },
    },
    limits: {
      knowledgeBases: 20,
      documents: 2000,
      aiChats: 2000,
      storageMB: 15360,
      uploadsPerDay: 50,
      apiKeys: 5,
      teamMembers: 1,
      ocr: "standard",
      visionModels: true,
      deepResearch: "limited",
      agents: 3,
      apiAccess: true,
      auditLogs: false,
      rbac: false,
      sso: false,
      sla: "email",
      teamWorkspaces: false,
      analytics: false,
      priorityQueue: false,
      credits: 2500,
    },
    features: [
      "20 Knowledge Bases",
      "15 GB Storage",
      "2,000 Documents",
      "2,000 AI Chats/month",
      "Standard OCR",
      "Vision Models",
      "Limited Deep Research",
      "3 AI Agents",
      "API Access",
      "Email Support",
      "2,500 AI Credits/month",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "For advanced AI/ML researchers.",
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    prices: {
      US: { monthly: 2400, yearly: 24000, currency: "USD" },
      GB: { monthly: 1900, yearly: 19000, currency: "GBP" },
      EU: { monthly: 2200, yearly: 22000, currency: "EUR" },
      IN: { monthly: 2000, yearly: 20000, currency: "INR" },
      CA: { monthly: 3200, yearly: 32000, currency: "CAD" },
      AU: { monthly: 3500, yearly: 35000, currency: "AUD" },
      JP: { monthly: 3600, yearly: 36000, currency: "JPY" },
      DEFAULT: { monthly: 2400, yearly: 24000, currency: "USD" },
    },
    limits: {
      knowledgeBases: -1,
      documents: -1,
      aiChats: 15000,
      storageMB: 102400,
      uploadsPerDay: 200,
      apiKeys: 20,
      teamMembers: 1,
      ocr: "advanced",
      visionModels: true,
      deepResearch: "unlimited",
      agents: 10,
      apiAccess: true,
      auditLogs: true,
      rbac: true,
      sso: false,
      sla: "priority",
      teamWorkspaces: false,
      analytics: true,
      priorityQueue: false,
      credits: 15000,
    },
    features: [
      "Unlimited Knowledge Bases",
      "100 GB Storage",
      "Unlimited Documents",
      "15,000 AI Chats/month",
      "Advanced OCR",
      "Unlimited Deep Research",
      "10 AI Agents",
      "Audit Logs",
      "RBAC",
      "API Access",
      "Priority Support",
      "15,000 AI Credits/month",
    ],
    popular: true,
    badge: "Most Popular",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    description: "For teams building production RAG systems.",
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    prices: {
      US: { monthly: 5900, yearly: 59000, currency: "USD" },
      GB: { monthly: 4700, yearly: 47000, currency: "GBP" },
      EU: { monthly: 5400, yearly: 54000, currency: "EUR" },
      IN: { monthly: 4900, yearly: 49000, currency: "INR" },
      CA: { monthly: 8000, yearly: 80000, currency: "CAD" },
      AU: { monthly: 8600, yearly: 86000, currency: "AUD" },
      JP: { monthly: 8800, yearly: 88000, currency: "JPY" },
      DEFAULT: { monthly: 5900, yearly: 59000, currency: "USD" },
    },
    limits: {
      knowledgeBases: -1,
      documents: -1,
      aiChats: -1,
      storageMB: 1048576,
      uploadsPerDay: 1000,
      apiKeys: 50,
      teamMembers: -1,
      ocr: "advanced",
      visionModels: true,
      deepResearch: "unlimited",
      agents: -1,
      apiAccess: true,
      auditLogs: true,
      rbac: true,
      sso: true,
      sla: "24/7",
      teamWorkspaces: true,
      analytics: true,
      priorityQueue: true,
      credits: 50000,
    },
    features: [
      "Unlimited Everything",
      "1 TB Storage",
      "Unlimited AI Chats",
      "Unlimited AI Agents",
      "Team Workspaces",
      "SSO",
      "Analytics Dashboard",
      "Priority Queue",
      "24/7 Support",
      "50,000 AI Credits/month",
    ],
    badge: "Best Value",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "For organizations with custom requirements.",
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    prices: {
      US: { monthly: 0, yearly: 0, currency: "USD" },
      GB: { monthly: 0, yearly: 0, currency: "GBP" },
      EU: { monthly: 0, yearly: 0, currency: "EUR" },
      IN: { monthly: 0, yearly: 0, currency: "INR" },
      CA: { monthly: 0, yearly: 0, currency: "CAD" },
      AU: { monthly: 0, yearly: 0, currency: "AUD" },
      JP: { monthly: 0, yearly: 0, currency: "JPY" },
      DEFAULT: { monthly: 0, yearly: 0, currency: "USD" },
    },
    limits: {
      knowledgeBases: -1,
      documents: -1,
      aiChats: -1,
      storageMB: -1,
      uploadsPerDay: -1,
      apiKeys: -1,
      teamMembers: -1,
      ocr: "enterprise",
      visionModels: true,
      deepResearch: "unlimited",
      agents: -1,
      apiAccess: true,
      auditLogs: true,
      rbac: true,
      sso: true,
      sla: "dedicated",
      teamWorkspaces: true,
      analytics: true,
      priorityQueue: true,
      credits: -1,
    },
    features: [
      "Everything in Business",
      "Dedicated Infrastructure",
      "VPC",
      "White Label",
      "Dedicated Account Manager",
      "Custom SLA",
      "SAML/SCIM",
      "Custom Integrations",
      "Unlimited Credits",
    ],
    badge: "Contact Us",
  },
};

export const PLAN_ORDER: PlanType[] = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

export function getPlanIndex(plan: PlanType): number {
  return PLAN_ORDER.indexOf(plan);
}

export function isPlanHigherOrEqual(current: PlanType, required: PlanType): boolean {
  return getPlanIndex(current) >= getPlanIndex(required);
}

export function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Contact";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "JPY" ? 0 : 0,
      maximumFractionDigits: currency === "JPY" ? 0 : 0,
    }).format(amount / 100);
  } catch {
    return `$${Math.round(amount / 100)}`;
  }
}

const REGION_MAP: Record<string, string> = {
  US: "US", CA: "US", MX: "US",
  GB: "GB", IE: "GB",
  DE: "EU", FR: "EU", IT: "EU", ES: "EU", NL: "EU", BE: "EU",
  AT: "EU", PT: "EU", PL: "EU", SE: "EU", DK: "EU", FI: "EU",
  CZ: "EU", RO: "EU", HU: "EU", BG: "EU", HR: "EU", SK: "EU",
  LT: "EU", LV: "EU", EE: "EU", SI: "EU", CY: "EU", LU: "EU",
  MT: "EU", GR: "EU",
  IN: "IN",
  AU: "AU", NZ: "AU",
  JP: "JP", KR: "JP",
  BR: "BR",
  DEFAULT: "DEFAULT",
};

export function detectRegion(headers: Headers): string {
  const cf = headers.get("cf-ipcountry");
  if (cf && REGION_MAP[cf.toUpperCase()]) return REGION_MAP[cf.toUpperCase()];
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel && REGION_MAP[vercel.toUpperCase()]) return REGION_MAP[vercel.toUpperCase()];
  const lang = headers.get("accept-language");
  if (lang) {
    const code = lang.split(",")[0]?.split("-")[1]?.toUpperCase();
    if (code && REGION_MAP[code]) return REGION_MAP[code];
  }
  return "DEFAULT";
}

export function mapStripePriceToPlan(priceId: string): PlanType {
  for (const [planType, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId) {
      return planType as PlanType;
    }
  }
  return "FREE";
}
