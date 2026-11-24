"use client";

import React, { useId, useState } from "react";
import { Citation } from "../types";
import { FileText, Globe, ExternalLink } from "lucide-react";

interface CitationBadgeProps {
  citation: Citation;
  index: number;
}

export function CitationBadge({ citation, index }: CitationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="relative inline-block align-baseline mx-0.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={`Source citation ${index + 1}`}
        className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-brand/25 bg-brand-soft px-1 font-mono text-[10px] font-medium text-brand transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
        title={citation.sourceTitle || "Source Citation"}
      >
        {index + 1}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            id={popoverId}
            className="kairos-panel absolute bottom-full left-0 z-50 mb-2 w-72 space-y-2 p-3 text-left text-foreground motion-safe:animate-fadeIn"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {citation.url ? (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-semibold text-foreground truncate">
                  {citation.sourceTitle || "Source Reference"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                #{index + 1}
              </span>
            </div>

            {citation.excerpt && (
              <p className="text-xs text-muted-foreground leading-relaxed max-h-32 overflow-y-auto italic">
                &ldquo;{citation.excerpt}&rdquo;
              </p>
            )}

            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-[11px] text-brand hover:underline"
              >
                <span>Open original link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </>
      )}
    </span>
  );
}

