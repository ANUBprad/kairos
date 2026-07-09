"use client";

import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PremiumEmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  educationalTip?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  BookOpen,
};

function PremiumEmptyState({
  icon = "BookOpen",
  title,
  description,
  educationalTip,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  className,
}: PremiumEmptyStateProps) {
  const Icon = iconMap[icon] || BookOpen;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-6 text-center",
      className
    )}>
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-[var(--radius-2xl)] bg-brand/10">
          <Icon size={40} className="text-brand" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-surface border-2 border-border flex items-center justify-center">
          <span className="text-xs text-text-tertiary">0</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-text-secondary leading-relaxed">{description}</p>

      {educationalTip && (
        <div className="mt-6 max-w-md rounded-[var(--radius-lg)] border border-brand/20 bg-brand/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-brand/10">
              <BookOpen size={14} className="text-brand" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-brand uppercase tracking-wide">Tip</p>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{educationalTip}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        {actionLabel && actionHref && (
          <Button variant="primary" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
        {actionLabel && !actionHref && onAction && (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && secondaryActionHref && (
          <Button variant="secondary" asChild>
            <Link href={secondaryActionHref}>
              <ExternalLink size={14} className="mr-1.5" />
              {secondaryActionLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export { PremiumEmptyState };
