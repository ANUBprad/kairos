"use client";

import { Loader2 } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ARTIFACT_STATUS_META } from "@/lib/artifacts/summary-view";
import type { ArtifactStatus } from "@prisma/client";

const KIND_VARIANT: Record<ArtifactStatus, NonNullable<BadgeProps["variant"]>> = {
  PENDING: "warning",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "destructive",
};

export function ArtifactStatusBadge({
  status,
  className,
}: {
  status: ArtifactStatus;
  className?: string;
}) {
  const meta = ARTIFACT_STATUS_META[status];
  return (
    <Badge variant={KIND_VARIANT[status]} className={className}>
      {status === "PROCESSING" && <Loader2 size={11} className="animate-spin" />}
      {meta.label}
    </Badge>
  );
}