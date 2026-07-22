"use client";

import { cn } from "@/lib/utils";
import { formatBytes, getStatusColor } from "./utils";
import type { DocumentWithDetails } from "./types";

interface DocumentSummaryProps {
  document: DocumentWithDetails;
  className?: string;
}

export function DocumentSummary({ document, className }: DocumentSummaryProps) {
  const statusColors = getStatusColor(document.status);
  const meta = document.metadata;

  const infoItems = [
    { label: "File Type", value: document.fileType.toUpperCase() },
    { label: "Size", value: formatBytes(document.size) },
    { label: "Status", value: document.status, color: statusColors.text },
    { label: "Chunks", value: document._count.chunks },
    { label: "Versions", value: document._count.versions },
    { label: "Uploaded", value: new Date(document.createdAt).toLocaleDateString() },
    { label: "Updated", value: new Date(document.updatedAt).toLocaleDateString() },
    ...(meta?.pages ? [{ label: "Pages", value: meta.pages }] : []),
    ...(meta?.rows ? [{ label: "Rows", value: meta.rows }] : []),
    ...(meta?.extractedChars ? [{ label: "Characters", value: (meta.extractedChars as number).toLocaleString() }] : []),
    ...(document.uploadedBy?.name ? [{ label: "Uploaded By", value: document.uploadedBy.name }] : []),
  ];

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3", className)}>
      {infoItems.map((item) => (
        <div key={item.label} className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
            {item.label}
          </p>
          <p className={cn(
            "text-sm font-medium",
            item.color || "text-text-primary"
          )}>
            {String(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
