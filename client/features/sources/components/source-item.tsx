"use client";

import React from "react";
import { Source } from "../lib/types";
import { Trash2, Check, Eye, RefreshCw } from "lucide-react";
import { SourceTypeIcon } from "./source-type-icon";
import { SourceStatusBadge } from "./source-status-badge";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { cn } from "@/lib/utils";

interface SourceItemProps {
  source: Source;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (source: Source) => void;
  onRetry?: (id: string) => void;
  isRetrying?: boolean;
}

export function SourceItem({
  source,
  isSelected,
  onToggleSelect,
  onDelete,
  onPreview,
  onRetry,
  isRetrying = false,
}: SourceItemProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center justify-between rounded-xl border p-2.5 select-none transition-colors duration-150 motion-reduce:transition-none",
        isSelected
          ? "border-brand/35 bg-brand-soft/60 shadow-[var(--shadow-panel)]"
          : "border-border bg-panel hover:border-brand/30 hover:bg-brand-quiet/60"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
        {/* Grounding Selection Checkbox */}
        <button
          type="button"
          onClick={() => onToggleSelect(source.id)}
          aria-label={
            isSelected ? `Deselect ${source.title}` : `Select ${source.title}`
          }
          aria-pressed={isSelected}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors motion-reduce:transition-none",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface hover:border-brand"
          )}
        >
          {isSelected && <Check className="w-3 h-3 stroke-3" />}
        </button>

        {/* Source Icon */}
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand-quiet">
          <SourceTypeIcon type={source.type} source={source} />
        </div>

        {/* Title & Status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              onClick={() => onPreview(source)}
              className="text-xs font-medium text-foreground hover:underline truncate cursor-pointer"
            >
              {source.title}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {SOURCE_TYPE_LABELS[source.type]}
            </span>
            <SourceStatusBadge status={source.status} />
            {source.status === "FAILED" && onRetry && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(source.id);
                }}
                disabled={isRetrying}
                title="Retry processing"
                aria-label={`Retry processing ${source.title}`}
                className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-brand transition-colors hover:bg-brand-soft disabled:opacity-50 motion-reduce:transition-none"
              >
                <RefreshCw
                  className={cn(
                    "size-2.5",
                    isRetrying && "motion-safe:animate-spin",
                  )}
                />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-100 transition-opacity motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onPreview(source)}
          title="Preview source content"
          aria-label={`Preview ${source.title}`}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove "${source.title}" from notebook?`)) {
              onDelete(source.id);
            }
          }}
          title="Delete source"
          aria-label={`Remove ${source.title}`}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger motion-reduce:transition-none"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
