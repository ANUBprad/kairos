import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
  color?: "brand" | "success" | "warning" | "error" | "info";
  className?: string;
}

const sizeMap = {
  sm: { ring: 48, stroke: 4, text: "text-xs" },
  md: { ring: 64, stroke: 5, text: "text-sm" },
  lg: { ring: 80, stroke: 6, text: "text-base" },
};

const colorMap = {
  brand: "stroke-brand",
  success: "stroke-success",
  warning: "stroke-warning",
  error: "stroke-error",
  info: "stroke-info",
};

function ProgressRing({
  value,
  max = 100,
  size = "md",
  label,
  showValue = true,
  color = "brand",
  className,
}: ProgressRingProps) {
  const s = sizeMap[size];
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (s.ring - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: s.ring, height: s.ring }}>
        <svg width={s.ring} height={s.ring} className="-rotate-90">
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            className="text-surface-hover"
          />
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-all duration-700 ease-out", colorMap[color])}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("font-semibold text-text-primary tabular-nums", s.text)}>
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[11px] font-medium text-text-tertiary text-center">{label}</span>
      )}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: "brand" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  className?: string;
}

function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = "brand",
  size = "sm",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const heightMap = { sm: "h-1.5", md: "h-2.5" };
  const colorMap = {
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
    info: "bg-info",
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono text-text-tertiary tabular-nums">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className={cn("rounded-full bg-surface-hover overflow-hidden", heightMap[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", colorMap[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressRing, ProgressBar };
