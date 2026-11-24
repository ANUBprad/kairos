"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Coins,
  History,
  Plus,
  Sparkles,
  Upload,
  MessageSquare,
  BookOpen,
  Headphones,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { cn } from "@/lib/utils";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import { CREDIT_COSTS, formatInr } from "../lib/plans";
import { PricingPlans } from "./pricing-plans";

type BillingSettingsViewProps = {
  workspaceId?: string;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BillingSettingsView({
  workspaceId,
}: BillingSettingsViewProps = {}) {
  const { credits, creditHistory, isLoading, isError } = useUsage();
  const { openUpgradeModal } = useUpgradeModal();

  const backHref = workspaceId ? `/workspace/${workspaceId}` : "/dashboard";

  if (isLoading) {
    return (
      <div className="kairos-panel flex min-h-64 items-center justify-center">
        <ThemeLoader />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="kairos-panel border-danger/25 bg-danger/5 p-6 text-center text-sm text-danger"
      >
        We couldn&apos;t load your credit details. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Navigation Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-1.5 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <h1 className="kairos-section-title text-2xl text-foreground">
          Credits &amp; Billing
        </h1>
      </div>

      {/* Credit Balance Overview Card */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        <section className="kairos-aurora flex flex-col justify-between overflow-hidden p-6 sm:p-7 md:col-span-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge
                variant="outline"
                className="kairos-tag gap-1.5 border-brand/30 bg-brand-quiet px-3 py-1 text-brand"
              >
                <Coins className="size-3.5 text-primary" />
                Available balance
              </Badge>
              <span className="kairos-eyebrow">Pay as you go</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="kairos-display text-5xl text-foreground sm:text-6xl">
                {credits.toLocaleString("en-IN")}
              </span>
              <span className="text-base font-medium text-muted-foreground">
                credits
              </span>
            </div>

            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              New accounts start with welcome credits. Top-ups begin at ₹50, and
              your credits never expire.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button
              type="button"
              onClick={() =>
                openUpgradeModal({
                  reason: "Top up your Kairos credits",
                  currentCredits: credits,
                })
              }
              className="gap-2"
            >
              <Plus className="size-4" />
              Top up credits (min ₹50)
            </Button>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
            >
              View credit packs &amp; pricing
            </Link>
          </div>
        </section>

        {/* Action Cost Reference */}
        <section className="kairos-panel flex flex-col justify-between space-y-5 p-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Sparkles className="size-4 text-primary" />
            <h2 className="kairos-section-title text-lg text-foreground">
              Credit rates
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Upload className="size-3.5 text-primary" />
                Source upload
              </span>
              <strong className="font-semibold text-foreground">
                {CREDIT_COSTS.SOURCE_UPLOAD} credits
              </strong>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="size-3.5 text-primary" />
                Chat query
              </span>
              <strong className="font-semibold text-foreground">
                {CREDIT_COSTS.CHAT_MESSAGE} credit
              </strong>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="size-3.5 text-primary" />
                Study artifact
              </span>
              <strong className="font-semibold text-foreground">
                {CREDIT_COSTS.ARTIFACT_GENERATE} credits
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Headphones className="size-3.5 text-primary" />
                Audio debate
              </span>
              <strong className="font-semibold text-foreground">
                {CREDIT_COSTS.AUDIO_DEBATE} credits
              </strong>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Failed generations are refunded in full.
          </p>
        </section>
      </div>

      {/* Credit Packs Section */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kairos-eyebrow">Top up anytime</p>
            <h2 className="kairos-section-title mt-1 text-xl text-foreground">
              Choose a credit pack
            </h2>
          </div>
          <span className="kairos-tag">No recurring billing</span>
        </div>
        <PricingPlans variant="page" showHeader={false} className="space-y-6" />
      </section>

      {/* Credit Transaction History */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="kairos-section-title flex items-center gap-2 text-xl text-foreground">
            <History className="size-4 text-primary" />
            Credit transaction history
          </h2>
          <span className="text-xs text-muted-foreground">
            Last 50 transactions
          </span>
        </div>

        {creditHistory.length === 0 ? (
          <div className="kairos-panel border-dashed p-10 text-center text-sm text-muted-foreground">
            No transactions yet. Welcome credits are added when your account is
            created.
          </div>
        ) : (
          <div className="kairos-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-xs">
                <thead className="border-b border-border bg-brand-quiet font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">Date</th>
                    <th scope="col" className="px-4 py-2.5">Type</th>
                    <th scope="col" className="px-4 py-2.5">Description</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Balance after
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {creditHistory.map((tx) => {
                    const isCredit = tx.amount > 0;
                    return (
                      <tr
                        key={tx.id}
                        className="transition-colors hover:bg-muted/40 motion-reduce:transition-none"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              isCredit
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="size-3" />
                            ) : (
                              <ArrowUpRight className="size-3" />
                            )}
                            {tx.type}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-2.5 text-foreground">
                          {tx.description}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">
                          <span className={isCredit ? "text-success" : "text-foreground"}>
                            {isCredit ? `+${tx.amount}` : tx.amount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                          {tx.balanceAfter}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
