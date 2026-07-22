"use client";

import { cn } from "@/lib/utils";
import { Search, CheckCircle2, XCircle, Filter, ArrowRight } from "lucide-react";
import type { ExplainerChunk, ExplainerConfig } from "./types";

interface RetrievalInspectorProps {
  chunks: ExplainerChunk[];
  config: ExplainerConfig;
  totalCandidates?: number;
  className?: string;
}

export function RetrievalInspector({ chunks, config, totalCandidates, className }: RetrievalInspectorProps) {
  const aboveThreshold = chunks.filter((c) => c.similarity >= config.similarityThreshold);
  const belowThreshold = totalCandidates ? totalCandidates - chunks.length : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Strategy</p>
          <p className="text-sm font-bold text-text-primary capitalize mt-1">{config.retrievalStrategy || config.retrievalMode}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Top K</p>
          <p className="text-sm font-bold text-text-primary mt-1">{config.topK}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Threshold</p>
          <p className="text-sm font-bold text-text-primary mt-1">{(config.similarityThreshold * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Retrieved</p>
          <p className="text-sm font-bold text-text-primary mt-1">{chunks.length} / {totalCandidates || chunks.length}</p>
        </div>
      </div>

      {/* Active Features */}
      <div className="flex flex-wrap gap-2">
        {config.retrievalMode === "hybrid" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
            <Search size={10} /> Hybrid Search
          </span>
        )}
        {config.queryExpansion && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-500">
            <ArrowRight size={10} /> Query Expansion
          </span>
        )}
        {config.multiQuery && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-500">
            <Filter size={10} /> Multi-Query
          </span>
        )}
        {config.reranking && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
            <ArrowRight size={10} /> Reranked
          </span>
        )}
        {config.compression && (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-500">
            Compressed
          </span>
        )}
      </div>

      {/* Chunk List with Rejection Analysis */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
          Retrieved Chunks ({aboveThreshold.length} above threshold)
        </p>
        {chunks.map((chunk) => (
          <div
            key={chunk.chunkId}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              chunk.similarity >= config.similarityThreshold
                ? "border-success/30 bg-success/5"
                : "border-border bg-surface"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-text-tertiary">#{chunk.rank}</span>
                  <CheckCircle2 size={12} className="text-success" />
                  <span className="text-xs font-medium text-text-primary truncate">{chunk.documentName}</span>
                  {chunk.pageNumber && (
                    <span className="text-[10px] text-text-tertiary">p.{chunk.pageNumber}</span>
                  )}
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{chunk.content}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  "text-sm font-bold font-mono tabular-nums",
                  chunk.similarity >= 0.9 ? "text-success" :
                  chunk.similarity >= 0.8 ? "text-brand" :
                  chunk.similarity >= 0.7 ? "text-warning" : "text-text-tertiary"
                )}>
                  {(chunk.similarity * 100).toFixed(1)}%
                </span>
                {chunk.originalRank !== undefined && chunk.originalRank !== chunk.rank && (
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    was #{chunk.originalRank}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rejected Chunks */}
      {belowThreshold > 0 && (
        <div className="rounded-lg border border-error/20 bg-error/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={12} className="text-error" />
            <span className="text-xs font-medium text-error">
              {belowThreshold} candidate{belowThreshold !== 1 ? "s" : ""} below threshold
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary">
            These chunks had similarity below {(config.similarityThreshold * 100).toFixed(0)}% and were filtered out.
          </p>
        </div>
      )}
    </div>
  );
}
