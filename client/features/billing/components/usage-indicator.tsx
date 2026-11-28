"use client";

import React from "react";
import {
  Coins,
  Plus,
  RefreshCw,
  Upload,
  MessageSquare,
  BookOpen,
  Headphones,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import {
  CREDIT_COSTS,
  DEVELOPER_ENTITLEMENT_LABEL,
  formatInr,
  formatUtcInstant,
  MIN_CREDIT_PACK_AMOUNT_INR,
} from "../lib/plans";
import { cn } from "@/lib/utils";

export function UsageIndicator({
  variant = "compact",
}: {
  variant?: "compact" | "detailed";
}) {
  const {
    credits,
    windowCredits,
    paidCredits,
    windowAllowance,
    creditWindowStart,
    nextCreditResetAt,
    windowsPerDay,
    bypassCredits,
    isDeveloper,
    isLoading,
    isError,
    refetch,
  } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();

  if (isLoading) {
    return variant === "compact" ? null : (
      <div role="status" className="kairos-panel p-5 text-sm text-muted-foreground">
        Loading credit balance…
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex items-center gap-2 text-xs text-danger">
        <span>Credit balance unavailable.</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => void refetch()}
          className="gap-1 text-danger"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  const isLow = !bypassCredits && credits < 10;
  const topUpLabel = `Browse credit packs (from ${formatInr(MIN_CREDIT_PACK_AMOUNT_INR)})`;

  if (variant === "compact") {
    if (bypassCredits) {
      return (
        <span className="kairos-tag gap-1.5 border-brand/30 bg-brand-quiet text-brand">
          <Coins className="size-3.5" aria-hidden="true" />
          {isDeveloper ? "Developer" : "Credits bypassed"}
        </span>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() =>
          openUpgradeModal({
            reason: isLow
              ? "Your credits are running low. Top up to continue research uninterrupted."
              : "Top up your Kairos credits.",
            currentCredits: credits,
          })
        }
        aria-label={`${windowCredits} of ${windowAllowance} free-window credits and ${paidCredits} paid credits remaining. Open credit options.`}
        className={cn(
          "gap-1.5 border-border text-xs font-normal transition-colors motion-reduce:transition-none",
          isLow
            ? "border-danger/40 bg-danger/5 text-danger hover:bg-danger/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Coins
          className={cn(
            "size-3.5 text-primary",
            isLow && "animate-bounce motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
        <span className="font-medium text-foreground">
          {windowCredits.toLocaleString("en-IN")} /{" "}
          {windowAllowance.toLocaleString("en-IN")} free
        </span>
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
          Top up
        </span>
      </Button>
    );
  }

  // Detailed variant (e.g. in settings or sidebar flyouts)
  return (
    <section className="kairos-panel space-y-4 p-5 text-foreground">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-primary" aria-hidden="true" />
          <h3 className="kairos-section-title text-base">Credit balance</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-primary">
          {credits.toLocaleString("en-IN")} cr
        </span>
      </div>

      {bypassCredits && (
        <p className="rounded-xl border border-brand/25 bg-brand-quiet px-3 py-2 text-xs font-medium text-brand">
          {DEVELOPER_ENTITLEMENT_LABEL}
        </p>
      )}

      <dl className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <dt>Free-window credits</dt>
          <dd className="font-medium text-foreground">
            {windowCredits.toLocaleString("en-IN")} /{" "}
            {windowAllowance.toLocaleString("en-IN")}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Paid credits</dt>
          <dd className="font-medium text-foreground">
            {paidCredits.toLocaleString("en-IN")}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <dt>Window start</dt>
          <dd>
            <time dateTime={creditWindowStart} className="font-medium text-foreground">
              {formatUtcInstant(creditWindowStart)}
            </time>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Next reset</dt>
          <dd>
            <time dateTime={nextCreditResetAt} className="font-medium text-foreground">
              {formatUtcInstant(nextCreditResetAt)}
            </time>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Windows per day</dt>
          <dd className="font-medium text-foreground">{windowsPerDay}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5">
            <Upload className="size-3 text-primary" aria-hidden="true" /> Source upload
          </dt>
          <dd className="font-medium text-foreground">
            {CREDIT_COSTS.SOURCE_UPLOAD} cr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5">
            <MessageSquare className="size-3 text-primary" aria-hidden="true" /> Chat query
          </dt>
          <dd className="font-medium text-foreground">
            {CREDIT_COSTS.CHAT_MESSAGE} cr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5">
            <BookOpen className="size-3 text-primary" aria-hidden="true" /> Standard artifact
          </dt>
          <dd className="font-medium text-foreground">
            {CREDIT_COSTS.ARTIFACT_GENERATE} cr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary" aria-hidden="true" /> Mind map / diagram / report
          </dt>
          <dd className="font-medium text-foreground">
            {CREDIT_COSTS.ARTIFACT_COMPUTE} cr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5">
            <Headphones className="size-3 text-primary" aria-hidden="true" /> Audio debate
          </dt>
          <dd className="font-medium text-foreground">
            {CREDIT_COSTS.AUDIO_DEBATE} cr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Search, browsing &amp; connecting sources</dt>
          <dd className="font-medium text-success">Free</dd>
        </div>
      </dl>

      {!bypassCredits && (
        <Button
          type="button"
          size="sm"
          onClick={() => openUpgradeModal({ currentCredits: credits })}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>{topUpLabel}</span>
        </Button>
      )}
    </section>
  );
}
