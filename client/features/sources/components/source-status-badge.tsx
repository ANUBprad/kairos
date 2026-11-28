import React from "react";
import { cn } from "@/lib/utils";
import { SOURCE_STATUS_LABELS } from "../lib/constants";
import type { SourceStatus } from "../lib/types";
import { AlertCircle, Check } from "lucide-react";
import { CircularLoader } from "@/components/ui/circular-loader";

interface SourceStatusBadgeProps {
  status: SourceStatus;
  className?: string;
  showIcon?: boolean;
}

const STATUS_STYLES: Record<SourceStatus, string> = {
  READY: "border-success/30 bg-success/10 text-success",
  PROCESSING: "border-warning/30 bg-warning/10 text-warning",
  PENDING: "border-border bg-muted text-muted-foreground",
  FAILED: "border-danger/30 bg-danger/10 text-danger",
};

export function SourceStatusBadge({
  status,
  className,
  showIcon = true,
}: SourceStatusBadgeProps) {
  const getIcon = () => {
    if (!showIcon) return null;
    switch (status) {
      case "READY":
        return <Check className="size-2.5" aria-hidden="true" />;
      case "PROCESSING":
      case "PENDING":
        return <CircularLoader size={11} className="motion-reduce:animate-none" />;
      case "FAILED":
        return <AlertCircle className="size-2.5" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none select-none",
        STATUS_STYLES[status],
        className,
      )}
    >
      {getIcon()}
      <span>{SOURCE_STATUS_LABELS[status] || status}</span>
    </span>
  );
}
