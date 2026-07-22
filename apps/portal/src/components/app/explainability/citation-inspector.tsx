"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Copy, Check } from "lucide-react";
import type { ExplainerCitation } from "./types";

interface CitationInspectorProps {
  citations: ExplainerCitation[];
  className?: string;
}

export function CitationInspector({ citations, className }: CitationInspectorProps) {
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (citation: ExplainerCitation) => {
    await navigator.clipboard.writeText(citation.excerpt);
    setCopiedId(citation.chunkId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group by document
  const grouped = citations.reduce(
    (acc, c) => {
      (acc[c.documentName] ??= []).push(c);
      return acc;
    },
    {} as Record<string, ExplainerCitation[]>
  );

  const coverage = citations.length > 0
    ? `${new Set(citations.map((c) => c.documentId)).size} document${new Set(citations.map((c) => c.documentId)).size !== 1 ? "s" : ""}`
    : "No citations";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {citations.length} citation{citations.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[11px] text-text-tertiary">
            from {coverage}
          </span>
        </div>
      </div>

      {citations.length === 0 ? (
        <div className="py-8 text-center">
          <FileText size={20} className="mx-auto text-text-tertiary mb-2" />
          <p className="text-sm text-text-tertiary">No citations found</p>
          <p className="text-xs text-text-tertiary mt-1">The model did not reference specific sources</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([docName, docCitations]) => (
            <div key={docName} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
                <FileText size={12} className="text-text-tertiary shrink-0" />
                <span className="text-xs font-medium text-text-primary truncate">{docName}</span>
                <span className="text-[10px] text-text-tertiary ml-auto">
                  {docCitations.length} citation{docCitations.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-border">
                {docCitations.map((citation) => {
                  const isExpanded = expandedCitation === citation.chunkId;
                  return (
                    <div key={citation.chunkId}>
                      <button
                        onClick={() => setExpandedCitation(isExpanded ? null : citation.chunkId)}
                        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-text-tertiary shrink-0">
                            Chunk #{citation.chunkIndex}
                          </span>
                          {citation.pageNumber && (
                            <span className="text-[10px] text-text-tertiary shrink-0">
                              p.{citation.pageNumber}
                            </span>
                          )}
                          <span className="text-xs text-text-tertiary truncate">
                            {citation.excerpt.slice(0, 60)}...
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs font-bold font-mono shrink-0 ml-2",
                          citation.similarity >= 0.9 ? "text-success" :
                          citation.similarity >= 0.8 ? "text-brand" :
                          "text-warning"
                        )}>
                          {(citation.similarity * 100).toFixed(0)}%
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border">
                          <div className="mt-2 rounded-md bg-bg border border-border p-3">
                            <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                              {citation.excerpt}
                            </p>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleCopy(citation)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-tertiary hover:bg-surface-hover transition-colors"
                            >
                              {copiedId === citation.chunkId ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
