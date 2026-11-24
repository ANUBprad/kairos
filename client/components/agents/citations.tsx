"use client";

import React, { useState } from "react";
import { ExternalLink, Globe, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id: string;
  title: string;
  domain?: string;
  url?: string;
  snippet?: string;
  indexLabel?: string;
  sourceId?: string;
  page?: number;
}

interface CitationsProps {
  sources?: CitationItem[];
  className?: string;
}

export function CitationStack({
  citations,
  className,
}: {
  citations: CitationItem[];
  className?: string;
}) {
  if (!citations.length) return null;

  const shown = citations.slice(0, 3);
  const extra = citations.length - shown.length;

  return (
    <span className={cn("inline-flex items-center -space-x-1", className)}>
      {shown.map((citation) => (
        <span
          key={citation.id}
          title={citation.title}
          className="inline-flex size-4 items-center justify-center rounded-full border border-brand/20 bg-surface text-[8px] font-semibold text-brand"
        >
          {(citation.domain || citation.title).charAt(0).toUpperCase()}
        </span>
      ))}
      {extra > 0 ? (
        <span className="pl-1 text-[10px] text-muted-foreground">+{extra}</span>
      ) : null}
    </span>
  );
}

export function CitationList({
  citations,
  idPrefix,
  className,
  highlightedId,
}: {
  citations: CitationItem[];
  idPrefix?: string;
  className?: string;
  highlightedId?: string | null;
}) {
  if (!citations.length) return null;

  return (
    <ul className={cn("space-y-1.5", className)}>
      {citations.map((citation, index) => {
        const itemId = idPrefix ? `${idPrefix}-${citation.id}` : undefined;
        const label = citation.title;
        const meta = citation.domain || citation.snippet;

        const row = (
          <div
            className={cn(
              "rounded-lg border border-border/70 bg-surface/80 px-2.5 py-2 text-xs transition-colors motion-reduce:transition-none",
              highlightedId === citation.id &&
                "border-brand/50 bg-brand-soft/60 ring-1 ring-brand/20",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {citation.indexLabel ? (
                <span className="inline-flex min-w-5 shrink-0 justify-center rounded-full bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand">
                  {citation.indexLabel}
                </span>
              ) : null}
              <p className="font-medium text-foreground truncate">{label}</p>
            </div>
            {meta ? (
              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                {meta}
              </p>
            ) : null}
          </div>
        );

        return (
          <li key={citation.id} id={itemId}>
            {citation.url ? (
              <a
                href={citation.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Citations({ sources = [], className }: CitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const displaySources = isExpanded ? sources : sources.slice(0, 3);
  const remainingCount = sources.length - 3;

  return (
    <div className={cn("kairos-panel mt-3 space-y-2 select-none p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="kairos-eyebrow flex items-center gap-1.5">
          <Globe className="size-3 text-brand" />
          Sources ({sources.length})
        </span>

        {sources.length > 3 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1 text-[11px] font-medium text-brand/80 transition-colors hover:text-brand motion-reduce:transition-none"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>+{remainingCount} more</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {displaySources.map((source, index) => {
          const isExternal = Boolean(source.url);

          const content = (
            <div
              className={cn(
                "group/cite flex max-w-[240px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none",
                isExternal
                  ? "cursor-pointer border-brand/25 bg-brand-soft/60 text-foreground shadow-[var(--shadow-panel)] hover:border-brand/45 hover:bg-brand-soft"
                  : "border-border bg-surface text-muted-foreground"
              )}
            >
              <div className="shrink-0 rounded border border-border bg-surface p-0.5 text-brand">
                {isExternal ? (
                  <Globe className="w-2.5 h-2.5" />
                ) : (
                  <FileText className="w-2.5 h-2.5" />
                )}
              </div>

              <span className="text-[11px] font-medium truncate flex-1">
                {source.title}
              </span>

              {source.domain && (
                <span className="text-[9px] text-muted-foreground/80 font-mono truncate hidden sm:inline">
                  {source.domain}
                </span>
              )}

              {isExternal && (
                <ExternalLink className="size-2.5 shrink-0 text-muted-foreground transition-colors group-hover/cite:text-brand motion-reduce:transition-none" />
              )}
            </div>
          );

          if (source.url) {
            return (
              <a
                key={source.id || index}
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-block outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
              >
                {content}
              </a>
            );
          }

          return <div key={source.id || index}>{content}</div>;
        })}
      </div>
    </div>
  );
}
