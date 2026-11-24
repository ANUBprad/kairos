"use client";

import React from "react";
import { Coins, Plus, Upload, MessageSquare, BookOpen, Headphones } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import { CREDIT_COSTS } from "../lib/plans";
import { cn } from "@/lib/utils";

export function UsageIndicator({
  variant = "compact",
}: {
  variant?: "compact" | "detailed";
}) {
  const { credits, isLoading } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();

  if (isLoading) {
    return null;
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
        className={cn(
          "gap-1.5 border-border text-xs font-normal transition-colors motion-reduce:transition-none",
          isLow
            ? "border-danger/40 bg-danger/5 text-danger hover:bg-danger/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <Coins className={cn("size-3.5 text-primary", isLow && "animate-bounce motion-reduce:animate-none")} />
        <span className="font-medium text-foreground">
          {credits.toLocaleString("en-IN")} credits
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
          <Coins className="size-4 text-primary" />
          <h3 className="kairos-section-title text-base">Credit balance</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-primary">
          {credits.toLocaleString("en-IN")} cr
        </span>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Upload className="size-3 text-primary" /> Source upload
          </span>
          <span className="font-medium text-foreground">
            {CREDIT_COSTS.SOURCE_UPLOAD} cr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="size-3 text-primary" /> Chat query
          </span>
          <span className="font-medium text-foreground">
            {CREDIT_COSTS.CHAT_MESSAGE} cr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3 text-primary" /> Study artifact
          </span>
          <span className="font-medium text-foreground">
            {CREDIT_COSTS.ARTIFACT_GENERATE} cr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Headphones className="size-3 text-primary" /> Audio debate
          </span>
          <span className="font-medium text-foreground">
            {CREDIT_COSTS.AUDIO_DEBATE} cr
          </span>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => openUpgradeModal({ currentCredits: credits })}
        className="w-full gap-1.5 text-xs"
      >
        <Plus className="size-3.5" />
        <span>Top up credits (min ₹50)</span>
      </Button>
    </section>
  );
}
