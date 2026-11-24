import React from "react";
import { cn } from "@/lib/utils";
import { SOURCE_STATUS_LABELS } from "../lib/constants";
import type { SourceStatus } from "../lib/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { CircularLoader } from "@/components/ui/circular-loader";

interface SourceStatusBadgeProps {
  status: SourceStatus;
  className?: string;
  showIcon?: boolean;
}

export function SourceStatusBadge({
  status,
  className,
  showIcon = true,
}: SourceStatusBadgeProps) {
  const getBadgeStyle = () => {
    switch (status) {
      case "READY":
        return "border-success/25 bg-success/10 text-success";
      case "PROCESSING":
      case "PENDING":
        return "border-warning/25 bg-warning/10 text-warning";
      case "FAILED":
        return "border-danger/25 bg-danger/10 text-danger";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getIcon = () => {
    if (!showIcon) return null;
    switch (status) {
      case "READY":
        return <CheckCircle2 className="w-2.5 h-2.5" />;
      case "PROCESSING":
      case "PENDING":
        return <CircularLoader size={12} />;
      case "FAILED":
        return <AlertCircle className="w-2.5 h-2.5" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize select-none",
        getBadgeStyle(),
        className
      )}
    >
      {getIcon()}
      <span>{SOURCE_STATUS_LABELS[status] || status}</span>
    </span>
  );
}
