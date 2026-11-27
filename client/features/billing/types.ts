export interface UsageMetric {
  count: number;
  limit: number | null;
  exceeded: boolean;
}

export type PlanType = "FREE" | "PRO" | "PRO_PLUS";

export type CreditTransactionType =
  | "SIGNUP_BONUS"
  | "PURCHASE"
  | "SOURCE_UPLOAD"
  | "CHAT_MESSAGE"
  | "ARTIFACT_GENERATE"
  | "AUDIO_DEBATE"
  | "REFUND"
  | "DAILY_ALLOWANCE";

export type CreditBucket = "DAILY" | "PAID" | "MIXED";

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: CreditTransactionType;
  description: string;
  bucket?: CreditBucket | null;
  dailyAmount?: number;
  paidAmount?: number;
  balanceAfterDaily?: number | null;
  balanceAfterPaid?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreditSnapshot {
  /** Backward-compatible total: daily + paid. */
  credits: number;
  dailyCredits: number;
  paidCredits: number;
  dailyAllowance: number;
  dailyCreditDay: string;
  nextDailyResetAt: string;
  serverTime: string;
}

export interface CreditBalance extends CreditSnapshot {
  history: CreditTransaction[];
}

export interface CreditPack {
  id: string;
  name: string;
  amountInr: number;
  credits: number;
  bonusPercent: number;
  isPopular?: boolean;
}

export interface UserUsage extends CreditSnapshot {
  creditHistory?: CreditTransaction[];
  /** Effective plan for limits (FREE if subscription expired). */
  plan: PlanType;
  /** Plan stored on the account (may still be PRO while expired). */
  subscriptionPlan?: PlanType;
  subscriptionExpired?: boolean;
  isPro: boolean;
  isProPlus?: boolean;
  planExpiresAt: string | null;
  workspaces: UsageMetric;
  sources: UsageMetric;
  artifacts: UsageMetric;
  messages: UsageMetric;
}

export interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  credits?: number;
  plan?: "PRO" | "PRO_PLUS";
  planName?: string;
  keyId: string;
  user: {
    name: string;
    email: string;
  };
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayPaymentSuccessResponse) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}
