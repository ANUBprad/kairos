"use client";

import { cn } from "@/lib/utils";
import type { MetricKey } from "./types";
import { METRIC_CONFIG, formatMetricValue, getMetricColor } from "./types";

interface MetricCardProps {
  metric: MetricKey;
  value: number;
  previousValue?: number;
  showFormula?: boolean;
  compact?: boolean;
  className?: string;
}

export function MetricCard({ metric, value, previousValue, showFormula = false, compact = false, className }: MetricCardProps) {
  const config = METRIC_CONFIG[metric];
  const colorClass = getMetricColor(value, config.higherIsBetter);
  const formattedValue = formatMetricValue(value ?? 0, config.format);

  const delta = previousValue !== undefined ? value - previousValue : undefined;
  const deltaPercent = delta !== undefined && previousValue !== undefined && previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : undefined;

  if (compact) {
    return (
      <div className={cn("rounded-lg border border-border p-3", className)}>
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">{config.shortLabel}</p>
        <p className={cn("text-lg font-bold mt-1", colorClass)}>{formattedValue}</p>
        {deltaPercent !== undefined && (
          <p className={cn("text-[10px] mt-0.5", deltaPercent > 0 ? "text-success" : deltaPercent < 0 ? "text-error" : "text-text-tertiary")}>
            {deltaPercent > 0 ? "+" : ""}{deltaPercent.toFixed(1)}%
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">{config.label}</p>
          <p className={cn("text-2xl font-bold mt-1", colorClass)}>{formattedValue}</p>
        </div>
        {deltaPercent !== undefined && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", deltaPercent > 0 ? "bg-success/10 text-success" : deltaPercent < 0 ? "bg-error/10 text-error" : "bg-bg text-text-tertiary")}>
            {deltaPercent > 0 ? "+" : ""}{deltaPercent.toFixed(1)}%
          </span>
        )}
      </div>
      {showFormula && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] text-text-tertiary font-mono">{config.formula}</p>
        </div>
      )}
    </div>
  );
}

interface MetricGridProps {
  metrics: Partial<Record<MetricKey, number>>;
  previousMetrics?: Partial<Record<MetricKey, number>>;
  columns?: 2 | 3 | 4 | 5;
  showFormulas?: boolean;
  compact?: boolean;
  className?: string;
}

export function MetricGrid({ metrics, previousMetrics, columns = 3, showFormulas = false, compact = false, className }: MetricGridProps) {
  const entries = Object.entries(metrics) as [MetricKey, number][];
  const gridCols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" };

  return (
    <div className={cn("grid gap-3", gridCols[columns], className)}>
      {entries.map(([key, value]) => (
        <MetricCard
          key={key}
          metric={key}
          value={value}
          previousValue={previousMetrics?.[key]}
          showFormula={showFormulas}
          compact={compact}
        />
      ))}
    </div>
  );
}
