"use client";

import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  className = "",
}: MetricCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-tertiary";

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-border-hover ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
          {Icon && <Icon size={14} />}
          {label}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] ${trendColor}`}>
            <TrendIcon size={12} />
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-text-primary font-mono tracking-tight">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-text-tertiary">{description}</p>
      )}
    </div>
  );
}
