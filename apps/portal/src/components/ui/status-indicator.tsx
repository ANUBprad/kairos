import * as React from "react";
import { CheckCircle2, AlertCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "success" | "warning" | "error" | "pending" | "loading" | "neutral";
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig = {
  success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  warning: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
  error: { icon: XCircle, color: "text-error", bg: "bg-error/10" },
  pending: { icon: Clock, color: "text-text-tertiary", bg: "bg-surface-hover" },
  loading: { icon: Loader2, color: "text-info", bg: "bg-info/10" },
  neutral: { icon: null, color: "text-text-tertiary", bg: "bg-surface-hover" },
};

function StatusIndicator({
  status,
  label,
  size = "sm",
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeMap = { sm: "h-5 w-5", md: "h-6 w-6" };
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex items-center justify-center rounded-full",
        sizeMap[size],
        config.bg
      )}>
        {Icon ? (
          <Icon
            size={iconSize}
            className={cn(config.color, status === "loading" && "animate-spin")}
          />
        ) : (
          <div className={cn("h-2 w-2 rounded-full", config.color)} />
        )}
      </div>
      {label && (
        <span className={cn("text-xs font-medium", config.color)}>{label}</span>
      )}
    </div>
  );
}

interface HealthScoreProps {
  score: number;
  label?: string;
  className?: string;
}

function HealthScore({ score, label = "Health", className }: HealthScoreProps) {
  const getStatus = (s: number) => {
    if (s >= 80) return "success" as const;
    if (s >= 60) return "warning" as const;
    return "error" as const;
  };

  const status = getStatus(score);
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)]",
        status === "success" ? "bg-success/10" : status === "warning" ? "bg-warning/10" : "bg-error/10"
      )}>
        <span className={cn("text-lg font-bold tabular-nums", colorMap[status])}>
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <p className={cn("text-[11px] font-medium", colorMap[status])}>
          {status === "success" ? "Excellent" : status === "warning" ? "Needs attention" : "Critical"}
        </p>
      </div>
    </div>
  );
}

export { StatusIndicator, HealthScore };
