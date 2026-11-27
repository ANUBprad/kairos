"use client";

import { Coins, Plus, RefreshCw } from "lucide-react";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import { cn } from "@/lib/utils";

interface CreditBadgeProps {
  className?: string;
  showPlusButton?: boolean;
}

export function CreditBadge({ className, showPlusButton = true }: CreditBadgeProps) {
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
    return (
      <div
        role="status"
        aria-label="Loading credits"
        className={cn(
          "kairos-tag animate-pulse motion-reduce:animate-none",
          className,
        )}
      >
        <Coins className="size-3.5" />
        <span>Loading credits…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <button
        type="button"
        onClick={() => void refetch()}
        aria-label="Retry loading credits"
        className={cn(
          "kairos-tag gap-1.5 border-danger/30 bg-danger/10 text-danger",
          className,
        )}
      >
        <RefreshCw className="size-3.5" />
        <span>Retry credits</span>
      </button>
    );
  }

  // Color cues are based on the combined balance used for affordability checks.
  const isLow = credits < 10;
  const isMedium = credits >= 10 && credits <= 50;

  const colorClasses = isLow
    ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/15"
    : isMedium
      ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15"
      : "border-success/30 bg-success/10 text-success hover:bg-success/15";

  return (
    <button
      type="button"
      onClick={() =>
        openUpgradeModal({
          reason: "Top up your Kairos credits",
          currentCredits: credits,
        })
      }
      aria-label={`${dailyCredits} of ${dailyAllowance} daily credits remaining, ${paidCredits} paid credits remaining. Open credit options.`}
      title={`${dailyCredits} / ${dailyAllowance} daily credits, reset ${nextDailyResetAt}; ${paidCredits} paid credits. Click to top up.`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-panel)] transition-colors motion-reduce:transition-none",
        colorClasses,
        className,
      )}
    >
      <Coins
        className={cn(
          "size-3.5",
          isLow && "animate-bounce motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
      <span>
        {dailyCredits.toLocaleString("en-IN")} /{" "}
        {dailyAllowance.toLocaleString("en-IN")} daily
      </span>
      {paidCredits > 0 && (
        <span className="text-muted-foreground">
          · {paidCredits.toLocaleString("en-IN")} paid
        </span>
      )}
      {showPlusButton && (
        <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-surface/70 transition-transform group-hover:scale-110 motion-reduce:transition-none">
          <Plus className="size-2.5" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
