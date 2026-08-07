"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status?: "default" | "success" | "warning" | "error" | "brand";
  href?: string;
  className?: string;
}

const statusColors = {
  default: { icon: "text-text-tertiary", bg: "bg-surface-hover" },
  success: { icon: "text-success", bg: "bg-success/10" },
  warning: { icon: "text-warning", bg: "bg-warning/10" },
  error: { icon: "text-error", bg: "bg-error/10" },
  brand: { icon: "text-brand", bg: "bg-brand/10" },
};

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  status = "default",
  className,
}: StatCardProps) {
  const colors = statusColors[status];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-tertiary";

  return (
    <div className={cn(
      "rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-colors hover:bg-surface-hover/50",
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)]", colors.bg)}>
            <Icon size={14} className={colors.icon} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary tabular-nums tracking-tight">
          {value}
        </span>
        {unit && <span className="text-sm text-text-tertiary mb-0.5">{unit}</span>}
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 mt-2", trendColor)}>
          <TrendIcon size={12} />
          {trendValue && <span className="text-[11px] font-medium">{trendValue}</span>}
        </div>
      )}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
