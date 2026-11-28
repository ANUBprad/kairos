"use client";

import React from "react";
import { Source } from "../lib/types";
import { Trash2, Check, Eye, RefreshCw } from "lucide-react";
import { SourceTypeIcon } from "./source-type-icon";
import { SourceStatusBadge } from "./source-status-badge";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import { canRetrySource, isSourceRefunded } from "../lib/retry-eligibility";
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
  const canRetry = canRetrySource(source);
  const refunded = isSourceRefunded(source);

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 select-none transition-colors motion-reduce:transition-none",
        isSelected
          ? "border-brand/35 bg-brand-soft/60"
          : "border-border bg-panel hover:border-brand/30 hover:bg-brand-quiet/60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
        {/* Grounding selection */}
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
              : "border-border bg-surface hover:border-brand",
          )}
        >
          {isSelected && <Check className="size-3 stroke-3" aria-hidden="true" />}
        </button>

        <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-brand-quiet">
          <SourceTypeIcon type={source.type} source={source} />
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onPreview(source)}
            title={source.title}
            className="block w-full break-words text-left text-[13px] font-medium leading-snug text-foreground line-clamp-2 transition-colors hover:text-brand hover:underline motion-reduce:transition-none"
          >
            {source.title}
          </button>

          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {SOURCE_TYPE_LABELS[source.type]}
            </span>
            <SourceStatusBadge
              status={source.status}
              className="px-1.5 py-0 text-[10px]"
            />
            {canRetry && onRetry ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(source.id);
                }}
                disabled={isRetrying}
                title="Retry processing"
                aria-label={`Retry processing ${source.title}`}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-brand-quiet disabled:opacity-50 motion-reduce:transition-none"
              >
                <RefreshCw
                  className={cn(
                    "size-2.5",
                    isRetrying && "motion-safe:animate-spin",
                  )}
                  aria-hidden="true"
                />
                Retry
              </button>
            ) : source.status === "FAILED" && refunded ? (
              <span
                title="This source was refunded. Import it again to be charged and processed."
                className="rounded-md border border-border bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground"
              >
                Re-import
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Row actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onPreview(source)}
          title="Preview source content"
          aria-label={`Preview ${source.title}`}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
        >
          <Eye className="size-3.5" aria-hidden="true" />
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
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
