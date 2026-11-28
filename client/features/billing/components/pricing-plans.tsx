"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Coins, Flame, Loader2, Sparkles, Upload, MessageSquare, BookOpen, Headphones } from "lucide-react";
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
        isEmbedded ? "space-y-7" : "mx-auto max-w-5xl space-y-10",
        className
      )}
    >
      {/* Optional Alert Message when user was redirected due to no credits */}
      {alertMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/5 p-3.5 text-sm text-warning sm:items-center"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 sm:mt-0" />
          <span>{alertMessage}</span>
        </div>
      )}

      {showHeader && (
        <header className="space-y-4 px-2 text-center">
          <span className="kairos-eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
            <Coins className="size-3.5 text-primary" />
            Pay-as-you-go credits
          </span>
          <h2
            className={cn(
              "kairos-display text-balance text-foreground",
              isEmbedded ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl md:text-6xl"
            )}
          >
            Pay for the research you do.
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every account gets {windowAllowance} free-window credits. The next reset
            is{" "}
            {nextCreditResetAt ? (
              <time dateTime={nextCreditResetAt} className="font-medium text-foreground">
                {formatUtcInstant(nextCreditResetAt)}
              </time>
            ) : (
              "provided by your account snapshot"
            )}
            . Paid top-ups never expire, and there is no recurring subscription.
          </p>

          {isDeveloper && (
            <p className="kairos-tag mx-auto w-fit flex-wrap justify-center border-brand/30 bg-brand-quiet text-brand">
              {DEVELOPER_ENTITLEMENT_LABEL}
            </p>
          )}

          {isAuthenticated && (
            <div className="kairos-tag mx-auto w-fit flex-wrap justify-center border-brand/30 bg-brand-quiet text-brand">
              <span>
                {windowCredits.toLocaleString("en-IN")} /{" "}
                {windowAllowance.toLocaleString("en-IN")} free-window credits
              </span>
              <span aria-hidden="true">·</span>
              <strong className="font-semibold text-primary">
                {paidCredits.toLocaleString("en-IN")} paid credits
              </strong>
              <span aria-hidden="true">·</span>
              <span>{credits.toLocaleString("en-IN")} total</span>
            </div>
          )}
        </header>
      )}

      {/* Credit Cost Matrix Cards */}
      <section className="space-y-3" aria-label="Credit costs by action">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="kairos-eyebrow">What credits cover</p>
          <p className="text-xs text-muted-foreground">
            Fixed costs for each action.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="kairos-panel space-y-1.5 p-4 text-center">
            <div className="kairos-inset mx-auto flex size-9 items-center justify-center text-primary">
              <Upload className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Source upload</p>
            <p className="text-base font-semibold text-foreground">
              {CREDIT_COSTS.SOURCE_UPLOAD}{" "}
              <span className="text-xs font-normal text-muted-foreground">credit</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80">PDF, web, video</p>
          </div>

          <div className="kairos-panel space-y-1.5 p-4 text-center">
            <div className="kairos-inset mx-auto flex size-9 items-center justify-center text-primary">
              <MessageSquare className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Chat query</p>
            <p className="text-base font-semibold text-foreground">
              {CREDIT_COSTS.CHAT_MESSAGE}{" "}
              <span className="text-xs font-normal text-muted-foreground">credit</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80">Grounded answer + citation</p>
          </div>

          <div className="kairos-panel space-y-1.5 p-4 text-center">
            <div className="kairos-inset mx-auto flex size-9 items-center justify-center text-primary">
              <BookOpen className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Standard artifact</p>
            <p className="text-base font-semibold text-foreground">
              {CREDIT_COSTS.ARTIFACT_GENERATE}{" "}
              <span className="text-xs font-normal text-muted-foreground">credits</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80">Quiz, flashcard, summary</p>
          </div>

          <div className="kairos-panel space-y-1.5 p-4 text-center">
            <div className="kairos-inset mx-auto flex size-9 items-center justify-center text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Compute-heavy artifact</p>
            <p className="text-base font-semibold text-foreground">
              {CREDIT_COSTS.ARTIFACT_COMPUTE}{" "}
              <span className="text-xs font-normal text-muted-foreground">credits</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80">Mind map, diagram, report</p>
          </div>

          <div className="kairos-panel space-y-1.5 p-4 text-center">
            <div className="kairos-inset mx-auto flex size-9 items-center justify-center text-primary">
              <Headphones className="size-4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Audio debate</p>
            <p className="text-base font-semibold text-foreground">
              {CREDIT_COSTS.AUDIO_DEBATE}{" "}
              <span className="text-xs font-normal text-muted-foreground">credits</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80">Two-host voice podcast</p>
          </div>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Searching, browsing and connecting sources do not use credits.
          Free-window credits are spent before paid credits.
        </p>
      </section>

      {/* One-time Credit Packs */}
      <section className="space-y-3" aria-label="Credit packs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="kairos-eyebrow">One-time credit packs</p>
            <p className="text-xs text-muted-foreground">
              Pay once, use credits at your own pace. Paid credits never expire.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => {
            const isSelected = !isCustom && selectedPackId === pack.id;
            return (
              <div
                key={pack.id}
                onClick={() => {
                  setIsCustom(false);
                  setSelectedPackId(pack.id);
                }}
                className={cn(
                  "kairos-card relative flex cursor-pointer flex-col justify-between p-5 motion-reduce:transition-none",
                  isSelected && "border-brand bg-brand-quiet ring-2 ring-brand/20"
                )}
              >
                {pack.isPopular && (
                  <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-panel)]">
                    <Flame className="size-3 fill-current" />
                    <span>Most popular</span>
                  </div>
                )}

                {pack.bonusPercent > 0 && !pack.isPopular && (
                  <div className="absolute -top-2.5 right-3 rounded-full border border-primary-border bg-primary-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-[var(--shadow-panel)]">
                    +{pack.bonusPercent}% bonus
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h3 className="kairos-section-title text-lg text-foreground">
                      {pack.name}
                    </h3>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
                      {formatInr(pack.amountInr)}
                    </p>
                  </div>

                  <div className="kairos-inset p-3 text-center">
                    <p className="kairos-display text-2xl text-primary">
                      {pack.credits.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Total credits
                    </p>
                  </div>

                  <ul className="space-y-1.5 pt-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      <span>
                        ~{Math.floor(pack.credits / CREDIT_COSTS.SOURCE_UPLOAD)} source uploads
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      <span>
                        ~{Math.floor(pack.credits / CREDIT_COSTS.CHAT_MESSAGE)} chat messages
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      <span>
                        ~{Math.floor(pack.credits / CREDIT_COSTS.ARTIFACT_GENERATE)} standard artifacts
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      <span>
                        ~{Math.floor(pack.credits / CREDIT_COSTS.AUDIO_DEBATE)} audio podcasts
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(pack.amountInr);
                    }}
                  >
                    {isLoading && isSelected ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      `Buy ${pack.name} for ${formatInr(pack.amountInr)}`
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Timed plan access — intentionally separate from one-time credit packs. */}
      <section className="space-y-3" aria-label="Timed plan access">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="kairos-eyebrow">Timed plan access</p>
            <p className="text-xs text-muted-foreground">
              One-time purchase with a finite access window. No recurring billing.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <div key={plan.id} className="kairos-panel flex flex-col gap-3 p-5">
              <div>
                <h3 className="kairos-section-title text-lg text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
                  {plan.priceInr === 0 ? "Free" : formatInr(plan.priceInr)}
                </p>
                <p className="mt-1 text-xs font-medium text-brand">{plan.access}</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {plan.description}
              </p>
              <ul className="flex-1 space-y-1.5 text-xs text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.id === "FREE" ? (
                <span className="kairos-tag w-fit">Included</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handlePlanBuy(plan.id)}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    `Buy ${plan.name} for ${formatInr(plan.priceInr)}`
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Custom Amount Top-Up Card */}
      <section className="kairos-panel space-y-4 p-5 sm:p-6" aria-label="Custom credit top-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" />
              Custom top-up
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Choose an allowed amount ({ALLOWED_CREDIT_AMOUNTS_INR.map(formatInr).join(", ")}).
              Amounts are snapped to a server-validated pack; larger packs include
              up to a 30% bonus.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  setCustomAmount(snapToAllowedCreditAmount(val));
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
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                `Buy ${calculateCreditsForInr(customAmount).toLocaleString("en-IN")} credits for ${formatInr(customAmount)}`
              )}
            </Button>
          </div>
        </div>

        {/* Quick Amount Pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Quick select</span>
          {ALLOWED_CREDIT_AMOUNTS_INR.map((amt) => (
            <button
              key={amt}
              type="button"
              aria-pressed={isCustom && customAmount === amt}
              onClick={() => {
                setCustomAmount(amt);
                setIsCustom(true);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors motion-reduce:transition-none",
                isCustom && customAmount === amt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:bg-muted"
              )}
            >
              {formatInr(amt)} ({calculateCreditsForInr(amt)} cr)
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

      {/* Trust & Policy Guarantee */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-success" />
          Paid credits never expire
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-success" />
          Free-window credits expire at the server-provided reset
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-success" />
          No recurring subscription
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-success" />
          Refunds for failed generations
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-success" />
          Secured via Razorpay
        </span>
      </div>
    </div>
  );
}
