"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { SOURCE_TYPE_LABELS } from "../lib/constants";
import type { Source } from "../lib/types";
import { SourceStatusBadge } from "./source-status-badge";
import { SourceTypeIcon } from "./source-type-icon";
import { cn } from "@/lib/utils";

interface SourceCardProps {
  source: Source;
  onSelect?: (source: Source) => void;
  onDelete?: (source: Source) => void;
  onReprocess?: (source: Source) => void;
  className?: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  layout?: "grid" | "list";
}

export function SourceCard({
  source,
  onSelect,
  onDelete,
  onReprocess,
  className,
  selected,
  onToggleSelect,
  layout = "grid",
}: SourceCardProps) {
  const isList = layout === "list";

  return (
    <div
      onClick={() => onSelect?.(source)}
      className={cn(
        "kairos-card group relative flex min-w-0 cursor-pointer",
        isList
          ? "flex-row items-center gap-2.5 p-3 sm:p-3.5"
          : "flex-col justify-between p-3.5 sm:p-4",
        selected && "border-brand/40 bg-brand-soft/50",
        className
      )}
    >
      {onToggleSelect && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center shrink-0"
        >
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(source.id);
            }}
            aria-label={selected ? `Deselect ${source.title}` : `Select ${source.title}`}
            className="size-4 shrink-0 cursor-pointer rounded border-border accent-brand focus:ring-0"
          />
        </div>
      )}

      <div
        className={cn(
          "min-w-0 flex-1",
          isList ? "flex items-center gap-2.5" : "space-y-2",
        )}
      >
        <div
          className={cn(
            "flex min-w-0",
            isList
              ? "items-center gap-2.5 flex-1"
              : "items-start justify-between gap-2 flex-col sm:flex-row sm:items-start",
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-brand/20 bg-brand-quiet sm:size-6">
              <SourceTypeIcon type={source.type} source={source} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-semibold text-foreground group-hover:text-brand group-hover:underline motion-reduce:transition-none">
                {source.title}
              </h4>
              {isList && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {SOURCE_TYPE_LABELS[source.type]}
                  <span className="mx-1">·</span>
                  {formatDistanceToNow(new Date(source.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
          </div>

          {!isList && (
            <div
              className="flex items-center gap-1 shrink-0 self-end sm:self-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {onReprocess && source.status === "FAILED" && (
                <button
                  type="button"
                  onClick={() => onReprocess(source)}
                  title="Retry processing"
                  aria-label={`Retry processing ${source.title}`}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(source)}
                  title="Delete source"
                  aria-label={`Delete ${source.title}`}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-100 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {!isList && source.content && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {source.content}
          </p>
        )}

        {!isList && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="shrink-0">{SOURCE_TYPE_LABELS[source.type]}</span>
              <span>·</span>
              <span className="truncate">
                {formatDistanceToNow(new Date(source.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {source.url && source.type !== "IMAGE" && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open original link"
                  aria-label={`Open original link for ${source.title}`}
                  className="p-0.5 text-muted-foreground transition-colors hover:text-brand motion-reduce:transition-none"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
              <SourceStatusBadge status={source.status} />
            </div>
          </div>
        )}
      </div>

      {isList && (
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <SourceStatusBadge status={source.status} />
          {onReprocess && source.status === "FAILED" && (
            <button
              type="button"
              onClick={() => onReprocess(source)}
              title="Retry processing"
              aria-label={`Retry processing ${source.title}`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand motion-reduce:transition-none"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(source)}
              title="Delete source"
              aria-label={`Delete ${source.title}`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger motion-reduce:transition-none"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
