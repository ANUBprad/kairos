"use client";

import { Coins, Plus } from "lucide-react";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import { cn } from "@/lib/utils";

interface CreditBadgeProps {
  className?: string;
  showPlusButton?: boolean;
}

export function CreditBadge({ className, showPlusButton = true }: CreditBadgeProps) {
  const { credits, isLoading } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();

  if (isLoading) {
    return (
      <div
        className={cn(
          "kairos-tag animate-pulse motion-reduce:animate-none",
          className
        )}
      >
        <Coins className="size-3.5" />
        <span>Loading credits…</span>
      </div>
    );
  }

  // Color cues based on balance
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
      title={`${credits} credits available. Click to top up.`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-panel)] transition-colors motion-reduce:transition-none",
        colorClasses,
        className
      )}
    >
      <Coins className={cn("size-3.5", isLow && "animate-bounce motion-reduce:animate-none")} />
      <span>{credits.toLocaleString("en-IN")} credits</span>
      {showPlusButton && (
        <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-surface/70 transition-transform group-hover:scale-110 motion-reduce:transition-none">
          <Plus className="size-2.5" />
        </span>
      )}
    </button>
  );
}

