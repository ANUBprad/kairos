import * as React from "react";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  confidence?: number;
  status?: "excellent" | "good" | "warning" | "critical";
  sparkline?: number[];
  className?: string;
  compact?: boolean;
}

function getStatusColor(status?: string) {
  switch (status) {
    case "excellent": return "text-success";
    case "good": return "text-info";
    case "warning": return "text-warning";
    case "critical": return "text-error";
    default: return "text-text-primary";
  }
}

function getStatusBg(status?: string) {
  switch (status) {
    case "excellent": return "bg-success/10";
    case "good": return "bg-info/10";
    case "warning": return "bg-warning/10";
    case "critical": return "bg-error/10";
    default: return "bg-surface-hover";
  }
}

function MiniSparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className={cn("opacity-60", className)}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const percentage = Math.round(value * 100);
  const color = percentage >= 80 ? "bg-success" : percentage >= 50 ? "bg-warning" : "bg-error";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-surface-hover overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-text-tertiary tabular-nums">{percentage}%</span>
    </div>
  );
}

function MetricDisplay({
  label,
  value,
  unit,
  description,
  trend,
  trendValue,
  confidence,
  status,
  sparkline,
  className,
  compact = false,
}: MetricDisplayProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-tertiary";

  if (compact) {
    return (
      <div className={cn("flex items-center justify-between", className)}>
        <div className="flex items-center gap-2">
          {status && (
            <div className={cn("h-2 w-2 rounded-full", getStatusBg(status))}>
              <div className={cn("h-2 w-2 rounded-full", getStatusColor(status))} />
            </div>
          )}
          <span className="text-xs text-text-secondary">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary font-mono tabular-nums">
            {value}{unit && <span className="text-text-tertiary ml-0.5">{unit}</span>}
          </span>
          {trend && (
            <div className={cn("flex items-center gap-0.5", trendColor)}>
              <TrendIcon size={12} />
              {trendValue && <span className="text-[10px]">{trendValue}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          {description && (
            <div className="group relative">
              <Info size={12} className="text-text-tertiary cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface border border-border rounded-lg shadow-lg text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {description}
              </div>
            </div>
          )}
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon size={14} />
            {trendValue && <span className="text-xs font-medium">{trendValue}</span>}
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-text-primary font-mono tabular-nums tracking-tight">
            {value}
          </span>
          {unit && <span className="text-sm text-text-tertiary">{unit}</span>}
        </div>
        {sparkline && <MiniSparkline data={sparkline} className={getStatusColor(status)} />}
      </div>

      {confidence !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">Confidence</span>
          </div>
          <ConfidenceBar value={confidence} />
        </div>
      )}
    </div>
  );
}

function MetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  confidence,
  status,
  sparkline,
  className,
}: Omit<MetricDisplayProps, "compact" | "description">) {
  return (
    <div className={cn(
      "rounded-[var(--radius-lg)] border border-border bg-surface p-4 space-y-3",
      className
    )}>
      <MetricDisplay
        label={label}
        value={value}
        unit={unit}
        trend={trend}
        trendValue={trendValue}
        confidence={confidence}
        status={status}
        sparkline={sparkline}
      />
    </div>
  );
}

export { MetricDisplay, MetricGrid, MetricCard, ConfidenceBar, MiniSparkline };
