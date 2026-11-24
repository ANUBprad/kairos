"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type IntegrationCardProps = {
  title: string;
  description: string;
  connected: boolean;
  icon: ReactNode;
  iconClassName?: string;
  children?: ReactNode;
  footer: ReactNode;
};

export function IntegrationCard({
  title,
  description,
  connected,
  icon,
  iconClassName,
  children,
  footer,
}: IntegrationCardProps) {
  return (
    <article className="kairos-card flex h-full min-h-[22rem] flex-col p-5 motion-reduce:transition-none sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "kairos-inset flex size-11 items-center justify-center text-primary",
            iconClassName,
          )}
        >
          {icon}
        </div>
        {connected ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            <span className="kairos-status-dot" aria-hidden />
            Connected
          </span>
        ) : (
          <span className="kairos-tag shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Not connected
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <h3 className="kairos-section-title text-lg text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-4 flex min-h-[7.5rem] flex-1 flex-col gap-3">
        {children}
      </div>

      <div className="mt-4 border-t border-border pt-4">{footer}</div>
    </article>
  );
}
