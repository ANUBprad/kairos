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

export { StatusIndicator };
