"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus, Shuffle } from "lucide-react";
import type { ExplainerChunk } from "./types";

interface ChunkRankingViewerProps {
  originalChunks: ExplainerChunk[];
  rerankedChunks: ExplainerChunk[];
  className?: string;
}

export function ChunkRankingViewer({ originalChunks, rerankedChunks, className }: ChunkRankingViewerProps) {
  const [viewMode, setViewMode] = useState<"compare" | "reranked">("compare");

  const hasReranking = rerankedChunks.length > 0 && originalChunks.length > 0;

  if (!hasReranking) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <Shuffle size={20} className="mx-auto text-text-tertiary mb-2" />
        <p className="text-sm text-text-tertiary">No reranking applied</p>
        <p className="text-xs text-text-tertiary mt-1">Enable reranking in your retrieval config to see ranking changes</p>
      </div>
    );
  }

  // Build a map of original positions
  const originalMap = new Map(originalChunks.map((c, i) => [c.chunkId, { ...c, originalRank: i + 1 }]));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("compare")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            viewMode === "compare" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
          )}
        >
          Compare
        </button>
        <button
          onClick={() => setViewMode("reranked")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            viewMode === "reranked" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
          )}
        >
          Reranked Only
        </button>
      </div>

      {viewMode === "compare" ? (
        <div className="space-y-2">
          {rerankedChunks.map((chunk, newIdx) => {
            const original = originalMap.get(chunk.chunkId);
            const originalRank = original?.originalRank;
            const rankChange = originalRank ? originalRank - (newIdx + 1) : 0;
            const isRising = rankChange > 0;
            const isFalling = rankChange < 0;

            return (
              <div
                key={chunk.chunkId}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  isRising && "border-success/30 bg-success/5",
                  isFalling && "border-warning/30 bg-warning/5",
                  !isRising && !isFalling && "border-border bg-surface"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-text-tertiary w-6 text-right">#{newIdx + 1}</span>
                    {isRising ? (
                      <ArrowUp size={12} className="text-success" />
                    ) : isFalling ? (
                      <ArrowDown size={12} className="text-warning" />
                    ) : (
                      <Minus size={12} className="text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{chunk.documentName}</p>
                    <p className="text-[11px] text-text-tertiary line-clamp-1">{chunk.content}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-text-primary">
                      {(chunk.similarity * 100).toFixed(1)}%
                    </span>
                    {originalRank && (
                      <p className="text-[10px] text-text-tertiary">
                        {rankChange !== 0 ? (
                          <span className={isRising ? "text-success" : "text-warning"}>
                            {rankChange > 0 ? `+${rankChange}` : rankChange}
                          </span>
                        ) : (
                          <span>unchanged</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {rerankedChunks.map((chunk, i) => (
            <div key={chunk.chunkId} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-text-tertiary shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{chunk.documentName}</p>
                  <p className="text-[11px] text-text-tertiary line-clamp-1">{chunk.content}</p>
                </div>
                <span className="text-xs font-bold font-mono text-text-primary shrink-0">
                  {(chunk.similarity * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
