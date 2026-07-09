"use client";

import Link from "next/link";
import { getIcon } from "./icon-registry";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon = "BookOpen",
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: EmptyStateProps) {
  const Icon = getIcon(icon);

  return (
    <div className={`flex flex-col items-center justify-center py-20 text-center ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
        <Icon size={28} className="text-brand" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Button variant="primary" className="mt-6" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && !actionHref && (
        <Button variant="primary" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
