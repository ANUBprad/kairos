"use client";

import { cn } from "@/lib/utils";
import {
  Search,
  BarChart3,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";
import type { DocumentChunkData } from "./types";

interface RetrievalInspectorProps {
  chunks: DocumentChunkData[];
  className?: string;
}

export function RetrievalInspector({ chunks, className }: RetrievalInspectorProps) {
  const totalTokens = chunks.reduce((sum, c) => sum + (c.tokenCount || 0), 0);
  const avgTokens = chunks.length > 0 ? Math.round(totalTokens / chunks.length) : 0;
  const maxTokens = Math.max(...chunks.map((c) => c.tokenCount || 0), 0);
  const minTokens = Math.min(...chunks.map((c) => c.tokenCount || 0), 0);

  const hasEmbeddings = chunks.some((c) => c.embedding);
  const embeddedCount = chunks.filter((c) => c.embedding?.status === "completed").length;

  const stats = [
    { label: "Total Chunks", value: chunks.length, icon: Search, color: "text-brand" },
    { label: "Total Tokens", value: totalTokens.toLocaleString(), icon: BarChart3, color: "text-blue-500" },
    { label: "Avg Tokens/Chunk", value: avgTokens.toLocaleString(), icon: TrendingUp, color: "text-emerald-500" },
    { label: "Max Tokens", value: maxTokens.toLocaleString(), icon: Target, color: "text-purple-500" },
    { label: "Min Tokens", value: minTokens.toLocaleString(), icon: Zap, color: "text-yellow-500" },
  ];

  const tokenDistribution = getTokenDistribution(chunks);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={14} className={stat.color} />
              <span className="text-[11px] font-medium text-text-tertiary">{stat.label}</span>
            </div>
            <p className="text-lg font-bold text-text-primary tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Embedding Status */}
      {hasEmbeddings && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            Embedding Coverage
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${chunks.length > 0 ? (embeddedCount / chunks.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-mono text-text-secondary tabular-nums">
              {embeddedCount}/{chunks.length}
            </span>
          </div>
        </div>
      )}

      {/* Token Distribution */}
      {tokenDistribution.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Token Distribution
          </p>
          <div className="flex items-end gap-1 h-20">
            {tokenDistribution.map((bucket, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-brand/20 hover:bg-brand/40 transition-colors relative group"
                style={{ height: `${bucket.percentage}%`, minHeight: bucket.percentage > 0 ? "4px" : "0" }}
                aria-label={`${bucket.label}: ${bucket.count} chunks`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-surface border border-border rounded text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {bucket.count} chunks ({bucket.label})
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-tertiary">0</span>
            <span className="text-[10px] text-text-tertiary">Tokens per chunk</span>
            <span className="text-[10px] text-text-tertiary">{maxTokens}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getTokenDistribution(chunks: DocumentChunkData[]) {
  if (chunks.length === 0) return [];
  const tokens = chunks.map((c) => c.tokenCount || 0).filter((t) => t > 0);
  if (tokens.length === 0) return [];

  const max = Math.max(...tokens);
  const bucketCount = Math.min(10, max || 1);
  const bucketSize = Math.ceil(max / bucketCount);

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const low = i * bucketSize;
    const high = (i + 1) * bucketSize;
    const count = tokens.filter((t) => t >= low && t < high).length;
    return {
      label: `${low}-${high}`,
      count,
      percentage: 0,
    };
  });

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  buckets.forEach((b) => {
    b.percentage = Math.round((b.count / maxCount) * 100);
  });

  return buckets;
}
