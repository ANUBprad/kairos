"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  Check,
  Headphones,
  Loader2,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/lib/auth-client";
import { useRazorpayCheckout } from "../hooks/use-razorpay";
import { useUsage } from "../hooks/use-usage";
import {
  ALLOWED_CREDIT_AMOUNTS_INR,
  CREDIT_COSTS,
  CREDIT_PACKS,
  DEVELOPER_ENTITLEMENT_LABEL,
  MIN_CREDIT_PACK_AMOUNT_INR,
  PLAN_CREDIT_ALLOWANCES,
  PRICING_PLANS,
  calculateCreditsForInr,
  formatInr,
  formatUtcInstant,
  isAllowedCreditAmount,
  snapToAllowedCreditAmount,
} from "../lib/plans";
import { PlanType } from "../types";

export type PricingPlansProps = {
  variant?: "page" | "embedded";
  alertMessage?: string;
  showHeader?: boolean;
  className?: string;
  onCheckoutSuccess?: () => void;
};

const DEFAULT_CUSTOM_AMOUNT =
  CREDIT_PACKS.find((pack) => pack.isPopular)?.amountInr ??
  MIN_CREDIT_PACK_AMOUNT_INR;

const CREDIT_ACTIONS = [
  {
    label: "Source upload",
    detail: "PDF, web, video",
    cost: CREDIT_COSTS.SOURCE_UPLOAD,
    unit: "credit",
    icon: Upload,
  },
  {
    label: "Chat query",
    detail: "Cited answer",
    cost: CREDIT_COSTS.CHAT_MESSAGE,
    unit: "credit",
    icon: MessageSquare,
  },
  {
    label: "Standard artifact",
    detail: "Quiz, summary, cards",
    cost: CREDIT_COSTS.ARTIFACT_GENERATE,
    unit: "credits",
    icon: BookOpen,
  },
  {
    label: "Compute-heavy artifact",
    detail: "Map, diagram, report",
    cost: CREDIT_COSTS.ARTIFACT_COMPUTE,
    unit: "credits",
    icon: Sparkles,
  },
  {
    label: "Audio debate",
    detail: "Two-host podcast",
    cost: CREDIT_COSTS.AUDIO_DEBATE,
    unit: "credits",
    icon: Headphones,
  },
] as const;

export function PricingPlans({
  variant = "page",
  alertMessage,
  showHeader = true,
  className,
  onCheckoutSuccess,
}: PricingPlansProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    credits,
    windowCredits,
    paidCredits,
    windowAllowance,
    nextCreditResetAt,
    isDeveloper,
  } = useUsage();
  const { checkout, isLoading, error } = useRazorpayCheckout();

  const [selectedPackId, setSelectedPackId] = useState<string>("learner");
  const [customAmount, setCustomAmount] = useState<number>(DEFAULT_CUSTOM_AMOUNT);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const isEmbedded = variant === "embedded";
  const isAuthenticated = !!session?.user;

  const requireAuth = () => {
    if (isAuthenticated) return true;
    router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
    return false;
  };

  const handleBuy = (amount: number) => {
    if (!requireAuth()) return;
    const allowedAmount = snapToAllowedCreditAmount(amount);
    setCustomAmount(allowedAmount);
    checkout({
      amountInr: allowedAmount,
      onSuccess: onCheckoutSuccess,
    });
  };

  const handlePlanBuy = (plan: PlanType) => {
    if (plan === "FREE" || !requireAuth()) return;
    checkout({
      plan,
      onSuccess: onCheckoutSuccess,
    });
  };

  return (
    <div
      className={cn(
        "w-full",
        isEmbedded ? "space-y-7" : "space-y-12",
        className
      )}
    >
      {alertMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/5 p-3.5 text-sm text-warning sm:items-center"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
          <span>{alertMessage}</span>
        </div>
      )}

      {showHeader && !isEmbedded && (
        <header className="max-w-2xl space-y-4">
          <span className="kairos-kicker">Pay as you go</span>
          <h2 className="kairos-editorial-title text-3xl text-foreground sm:text-5xl">
            Pay for the research you do.
          </h2>
          <p className="kairos-lede">
            Every account receives free credits each server-defined window. Top
            ups are one-time purchases, and there is no recurring subscription.
          </p>
        </header>
      )}

      {(isAuthenticated || isDeveloper) && (
        <section className="kairos-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Current credits">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>
              {windowCredits.toLocaleString("en-IN")} /{" "}
              {windowAllowance.toLocaleString("en-IN")} free-window credits
            </span>
            <span>
              <strong className="font-semibold text-primary">
                {paidCredits.toLocaleString("en-IN")}
              </strong>{" "}
              paid credits
            </span>
            <span>{credits.toLocaleString("en-IN")} total</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextCreditResetAt && (
              <span className="kairos-tag">
                Next reset{" "}
                <time dateTime={nextCreditResetAt} className="text-foreground">
                  {formatUtcInstant(nextCreditResetAt)}
                </time>
              </span>
            )}
            {isDeveloper && (
              <span className="kairos-tag border-primary/30 bg-brand-quiet text-primary">
                {DEVELOPER_ENTITLEMENT_LABEL}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="space-y-5" aria-label="Credit costs by action">
        <div className="pricing-section-head">
          <div>
            <p className="kairos-eyebrow">Metering</p>
            <h3 className="kairos-section-title mt-1.5 text-xl text-foreground">
              What spends credits
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Fixed costs. Search, browsing and connecting sources do not spend credits.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CREDIT_ACTIONS.map((action) => (
            <div key={action.label} className="kairos-panel p-4">
              <action.icon className="size-4 text-primary" aria-hidden="true" />
              <p className="mt-4 text-xs text-muted-foreground">{action.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {action.cost}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {action.unit}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">{action.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Free-window credits are spent before paid credits.
        </p>
      </section>

      <section className="space-y-5" aria-label="Credit packs">
        <div className="pricing-section-head">
          <div>
            <p className="kairos-eyebrow">One-time credit packs</p>
            <h3 className="kairos-section-title mt-1.5 text-xl text-foreground">
              Credits you keep
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Pay once. Paid credits never expire.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => {
            const isSelected = !isCustom && selectedPackId === pack.id;
            return (
              <div
                key={pack.id}
                className="pricing-plan-card"
                data-selected={isSelected ? "true" : "false"}
                data-featured={pack.isPopular ? "true" : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="kairos-section-title text-base text-foreground">
                      {pack.name}
                    </h4>
                    <p className="pricing-price mt-3 text-foreground">
                      {formatInr(pack.amountInr)}
                    </p>
                  </div>
                  {pack.isPopular && (
                    <span className="kairos-tag shrink-0 border-primary/30 bg-brand-quiet text-primary">
                      Recommended
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-baseline justify-between border-y border-border py-3">
                  <span className="kairos-display text-2xl text-primary">
                    {pack.credits.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>
                {pack.bonusPercent > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Includes +{pack.bonusPercent}% bonus credits
                  </p>
                )}

                <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ~{Math.floor(pack.credits / CREDIT_COSTS.SOURCE_UPLOAD)} source uploads
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ~{Math.floor(pack.credits / CREDIT_COSTS.CHAT_MESSAGE)} chat queries
                  </li>
                </ul>

                <div className="mt-auto pt-6">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    disabled={isLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPackId(pack.id);
                      setIsCustom(false);
                      handleBuy(pack.amountInr);
                    }}
                  >
                    {isLoading && isSelected ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      `Buy pack · ${formatInr(pack.amountInr)}`
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-5" aria-label="Timed plan access">
        <div className="pricing-section-head">
          <div>
            <p className="kairos-eyebrow">Timed plan access</p>
            <h3 className="kairos-section-title mt-1.5 text-xl text-foreground">
              A defined window of access
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            One-time purchase. No automatic renewal.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const planCredits = PLAN_CREDIT_ALLOWANCES[plan.id];
            return (
              <div key={plan.id} className="pricing-plan-card">
                <h4 className="kairos-section-title text-base text-foreground">
                  {plan.name}
                </h4>
                <p className="pricing-price mt-3 text-foreground">
                  {plan.priceInr === 0 ? "Free" : formatInr(plan.priceInr)}
                </p>
                <p className="mt-2 text-xs font-medium text-primary">{plan.access}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {planCredits
                    ? `${planCredits.toLocaleString("en-IN")} credits included`
                    : "Free credits arrive each server-defined window"}
                </p>

                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-xs text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-6">
                  {plan.id === "FREE" ? (
                    <span className="kairos-tag w-full justify-center">Included</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => handlePlanBuy(plan.id)}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        `Buy plan · ${formatInr(plan.priceInr)}`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="kairos-panel p-5 sm:p-6" aria-label="Custom credit top-up">
        <div className="pricing-section-head mb-5">
          <div>
            <p className="kairos-eyebrow">Exact amount</p>
            <h3 className="kairos-section-title mt-1.5 text-xl text-foreground">
              Custom top-up
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Allowed amounts: {ALLOWED_CREDIT_AMOUNTS_INR.map(formatInr).join(", ")}.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Amounts are snapped to a server-validated pack before checkout. Larger
            packs include up to a 30% bonus.
          </p>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
            <div className="relative w-full sm:w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <input
                id="custom-top-up-amount"
                type="number"
                min={MIN_CREDIT_PACK_AMOUNT_INR}
                step={1}
                value={customAmount}
                aria-label="Custom top-up amount in rupees"
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setCustomAmount(snapToAllowedCreditAmount(value));
                  setIsCustom(true);
                }}
                className="w-full rounded-xl border border-border bg-background py-2 pl-7 pr-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <Button
              type="button"
              disabled={isLoading || !isAllowedCreditAmount(customAmount)}
              onClick={() => handleBuy(customAmount)}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                `Buy ${calculateCreditsForInr(customAmount).toLocaleString("en-IN")} credits · ${formatInr(customAmount)}`
              )}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs">
          <span className="text-muted-foreground">Quick select</span>
          {ALLOWED_CREDIT_AMOUNTS_INR.map((amount) => (
            <button
              key={amount}
              type="button"
              aria-pressed={isCustom && customAmount === amount}
              onClick={() => {
                setCustomAmount(amount);
                setIsCustom(true);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors motion-reduce:transition-none",
                isCustom && customAmount === amount
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:bg-muted"
              )}
            >
              {formatInr(amount)} ({calculateCreditsForInr(amount)} cr)
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-center text-xs text-danger"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:grid-cols-3">
        <p className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Paid credits never expire.
        </p>
        <p className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Free-window credits expire at the server-provided reset.
        </p>
        <p className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Payments are verified by Kairos before credits are added.
        </p>
      </div>
    </div>
  );
}
