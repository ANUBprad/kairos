"use client";

import { cn } from "@/lib/utils";
import {
  History,
  FileText,
  User,
  Clock,
} from "lucide-react";
import type { DocumentVersion } from "./types";
import { formatBytes, formatTimestamp } from "./utils";

interface VersionHistoryProps {
  versions: DocumentVersion[];
  className?: string;
}

export function VersionHistory({ versions, className }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <History size={24} className="mx-auto text-text-tertiary mb-2" />
        <p className="text-sm text-text-tertiary">No version history</p>
        <p className="text-xs text-text-tertiary mt-1">Versions are created when documents are uploaded or updated</p>
      </div>
    );
  }

  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">
          {versions.length} version{versions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-0">
        {sorted.map((version, i) => {
          const isFirst = i === 0;
          return (
            <div key={version.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                  isFirst
                    ? "bg-brand/10 border-brand text-brand"
                    : "bg-surface-hover border-border text-text-tertiary"
                )}>
                  v{version.version}
                </div>
                {i < sorted.length - 1 && (
                  <div className="w-0.5 h-6 my-1 bg-border" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isFirst ? "text-text-primary" : "text-text-secondary"
                  )}>
                    Version {version.version}
                  </span>
                  {isFirst && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <FileText size={10} />
                    {version.fileType.toUpperCase()}
                  </span>
                  <span>{formatBytes(version.size)}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatTimestamp(version.createdAt)}
                  </span>
                </div>
                {version.uploadedBy && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-text-tertiary">
                    <User size={10} />
                    {version.uploadedBy.name || "Unknown"}
                  </div>
                )}
                {version.changeNote && (
                  <p className="text-xs text-text-secondary mt-1 italic">
                    &ldquo;{version.changeNote}&rdquo;
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
