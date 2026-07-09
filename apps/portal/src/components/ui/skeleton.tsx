import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] bg-surface-hover animate-skeleton",
        className
      )}
      {...props}
    />
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4",
        className
      )}
      {...props}
    >
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-border bg-surface overflow-hidden", className)}>
      <div className="border-b border-border px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="border-b border-border last:border-b-0 px-6 py-3">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-3", className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonStat };
