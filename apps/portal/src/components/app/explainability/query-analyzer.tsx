"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, ArrowRight, Copy, Check } from "lucide-react";

interface QueryAnalyzerProps {
  query: string;
  expandedQuery?: string;
  embeddingDimensions?: number;
  embeddingLatencyMs?: number;
  strategy?: string;
  className?: string;
}

export function QueryAnalyzer({
  query,
  expandedQuery,
  embeddingDimensions,
  embeddingLatencyMs,
  strategy,
  className,
}: QueryAnalyzerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(expandedQuery || query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const queryWords = query.split(/\s+/).filter(Boolean);
  const hasExpansion = expandedQuery && expandedQuery !== query;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Query */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Search size={12} className="text-brand" />
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
              Original Query
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-tertiary">
              {queryWords.length} words
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-text-tertiary hover:bg-surface-hover transition-colors"
            >
              {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
            </button>
          </div>
        </div>
        <p className="text-sm text-text-primary font-medium">{query}</p>
      </div>

      {/* Expanded Query */}
      {hasExpansion && (
        <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight size={12} className="text-brand" />
            <span className="text-[11px] font-semibold text-brand uppercase tracking-wider">
              Expanded Query
            </span>
          </div>
          <p className="text-sm text-text-secondary">{expandedQuery}</p>
        </div>
      )}

      {/* Analysis */}
      <div className="grid grid-cols-2 gap-2">
        {strategy && (
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-text-tertiary">Strategy</p>
            <p className="text-xs font-medium text-text-primary capitalize">{strategy}</p>
          </div>
        )}
        {embeddingDimensions && (
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-text-tertiary">Embedding Dims</p>
            <p className="text-xs font-medium text-text-primary">{embeddingDimensions}</p>
          </div>
        )}
        {embeddingLatencyMs !== undefined && (
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-text-tertiary">Embed Time</p>
            <p className="text-xs font-medium text-text-primary">{embeddingLatencyMs.toFixed(0)}ms</p>
          </div>
        )}
        <div className="rounded-lg border border-border p-2">
          <p className="text-[10px] text-text-tertiary">Est. Tokens</p>
          <p className="text-xs font-medium text-text-primary">{Math.ceil(query.length / 4)}</p>
        </div>
      </div>
    </div>
  );
}
