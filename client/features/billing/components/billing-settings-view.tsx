"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  History,
  Plus,
  Sparkles,
  Upload,
  MessageSquare,
  BookOpen,
  Headphones,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { cn } from "@/lib/utils";
import { useUsage } from "../hooks/use-usage";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import {
  CREDIT_COSTS,
  DEVELOPER_ENTITLEMENT_LABEL,
  formatInr,
  formatUtcInstant,
  MIN_CREDIT_PACK_AMOUNT_INR,
} from "../lib/plans";
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
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function BillingSettingsView({
  workspaceId,
}: BillingSettingsViewProps = {}) {
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
    creditHistory,
    isLoading,
    isError,
    refetch,
  } = useUsage();
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
        <p>We couldn&apos;t load your credit details.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
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
                Free credit window
              </Badge>
              <span className="kairos-eyebrow">
                Next reset: {formatUtcInstant(nextCreditResetAt)}
              </span>
            </div>

            {bypassCredits && (
              <p className="rounded-xl border border-brand/25 bg-brand-quiet px-3 py-2 text-xs font-medium text-brand">
                {DEVELOPER_ENTITLEMENT_LABEL}
                {isDeveloper ? "" : " (via entitlement)"}
              </p>
            )}

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="kairos-display text-5xl text-foreground sm:text-6xl">
                {windowCredits.toLocaleString("en-IN")}
                <span className="text-3xl text-muted-foreground">
                  {" / "}
                  {windowAllowance.toLocaleString("en-IN")}
                </span>
              </span>
              <span className="text-base font-medium text-muted-foreground">
                free-window credits left
              </span>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface/70 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Paid balance</dt>
                <dd className="font-semibold text-foreground">
                  {paidCredits.toLocaleString("en-IN")} credits
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-surface/70 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Total available</dt>
                <dd className="font-semibold text-foreground">
                  {credits.toLocaleString("en-IN")} credits
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-surface/70 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Window start</dt>
                <dd className="font-semibold text-foreground">
                  <time dateTime={creditWindowStart}>
                    {formatUtcInstant(creditWindowStart)}
                  </time>
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-surface/70 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Windows per day</dt>
                <dd className="font-semibold text-foreground">{windowsPerDay}</dd>
              </div>
            </dl>

            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Free-window credits reset at{" "}
              <time dateTime={nextCreditResetAt} className="font-medium text-foreground">
                {formatUtcInstant(nextCreditResetAt)}
              </time>
              . Paid credits never expire. Free-window credits are spent first.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {!bypassCredits && (
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
                Browse credit packs (from {formatInr(MIN_CREDIT_PACK_AMOUNT_INR)})
              </Button>
            )}
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
            >
              View credit packs &amp; plan access
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

          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Upload className="size-3.5 text-primary" />
                Source upload
              </dt>
              <dd className="font-semibold text-foreground">
                {CREDIT_COSTS.SOURCE_UPLOAD} credit
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="size-3.5 text-primary" />
                Chat query
              </dt>
              <dd className="font-semibold text-foreground">
                {CREDIT_COSTS.CHAT_MESSAGE} credit
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="size-3.5 text-primary" />
                Standard artifact
              </dt>
              <dd className="font-semibold text-foreground">
                {CREDIT_COSTS.ARTIFACT_GENERATE} credits
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Mind map, diagram or report
              </dt>
              <dd className="font-semibold text-foreground">
                {CREDIT_COSTS.ARTIFACT_COMPUTE} credits
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Headphones className="size-3.5 text-primary" />
                Audio debate podcast
              </dt>
              <dd className="font-semibold text-foreground">
                {CREDIT_COSTS.AUDIO_DEBATE} credits
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Search, browsing &amp; connecting sources</dt>
              <dd className="font-semibold text-success">Free</dd>
            </div>
          </dl>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Free-window credits are used before paid credits. Failed generations
            are refunded to their original buckets.
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
            No transactions yet. Your free-window credits appear here after the
            first balance check.
          </div>
        ) : (
          <div className="kairos-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[48rem] text-left text-xs"
                aria-label="Credit transaction history"
              >
                <thead className="border-b border-border bg-brand-quiet font-medium text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">Date</th>
                    <th scope="col" className="px-4 py-2.5">Type</th>
                    <th scope="col" className="px-4 py-2.5">Bucket</th>
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
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {tx.bucket ?? "PAID"}
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
