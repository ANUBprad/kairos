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
import { CREDIT_COSTS } from "../lib/plans";
import { cn } from "@/lib/utils";

export function UsageIndicator({
  variant = "compact",
}: {
  variant?: "compact" | "detailed";
}) {
  const {
    credits,
    dailyCredits,
    paidCredits,
    dailyAllowance,
    nextDailyResetAt,
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

  const isLow = credits < 10;

  if (variant === "compact") {
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
        aria-label={`${dailyCredits} of ${dailyAllowance} daily credits and ${paidCredits} paid credits remaining. Open credit options.`}
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
          {dailyCredits.toLocaleString("en-IN")} /{" "}
          {dailyAllowance.toLocaleString("en-IN")} daily
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

      <dl className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <dt>Daily free credits</dt>
          <dd className="font-medium text-foreground">
            {dailyCredits.toLocaleString("en-IN")} /{" "}
            {dailyAllowance.toLocaleString("en-IN")}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Paid credits</dt>
          <dd className="font-medium text-foreground">
            {paidCredits.toLocaleString("en-IN")}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <dt>Daily reset</dt>
          <dd>
            <time dateTime={nextDailyResetAt} className="font-medium text-foreground">
              {nextDailyResetAt
                ? `${nextDailyResetAt.slice(0, 10)} ${nextDailyResetAt.slice(11, 16)} UTC`
                : "Not available"}
            </time>
          </dd>
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

      <Button
        type="button"
        size="sm"
        onClick={() => openUpgradeModal({ currentCredits: credits })}
        className="w-full gap-1.5 text-xs"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        <span>Top up credits (min ₹50)</span>
      </Button>
    </section>
  );
}
