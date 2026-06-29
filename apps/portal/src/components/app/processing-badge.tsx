"use client";

import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  HardDrive,
  FileSearch,
  Layers,
  Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; className: string }
> = {
  QUEUED: {
    label: "Queued",
    icon: Clock,
    className: "border-info/30 bg-info/10 text-info",
  },
  UPLOADING: {
    label: "Uploading",
    icon: Upload,
    className: "border-info/30 bg-info/10 text-info",
  },
  STORED: {
    label: "Stored",
    icon: HardDrive,
    className: "border-text-tertiary/30 bg-surface-hover text-text-secondary",
  },
  EXTRACTING: {
    label: "Extracting",
    icon: FileSearch,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  CHUNKING: {
    label: "Chunking",
    icon: Layers,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  EMBEDDING_PENDING: {
    label: "Embedding Pending",
    icon: Cpu,
    className: "border-brand/30 bg-brand/10 text-brand",
  },
  READY: {
    label: "Ready",
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  ERROR: {
    label: "Error",
    icon: XCircle,
    className: "border-error/30 bg-error/10 text-error",
  },
};

interface Props {
  status: string;
  className?: string;
}

export function ProcessingBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.QUEUED;
  const Icon = config.icon;
  const isLoading =
    status === "UPLOADING" ||
    status === "EXTRACTING" ||
    status === "CHUNKING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-0.5 text-[11px] font-semibold",
        config.className,
        className,
      )}
    >
      {isLoading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Icon size={12} />
      )}
      {config.label}
    </span>
  );
}
