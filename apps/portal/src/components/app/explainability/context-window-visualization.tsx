"use client";

import { cn } from "@/lib/utils";
import type { ExplainerChunk, ExplainerPrompt } from "./types";

interface ContextWindowVisualizationProps {
  chunks: ExplainerChunk[];
  prompt: ExplainerPrompt;
  maxTokens?: number;
  className?: string;
}

export function ContextWindowVisualization({
  chunks,
  prompt,
  maxTokens = 8000,
  className,
}: ContextWindowVisualizationProps) {
  const systemTokens = estimateTokens(prompt.systemPrompt);
  const contextTokens = chunks.reduce((sum, c) => sum + (c.tokenCount || estimateTokens(c.content)), 0);
  const historyTokens = prompt.messages
    .filter((m) => m.role !== "system" && m.role !== "user")
    .reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const userTokens = prompt.messages
    .filter((m) => m.role === "user")
    .reduce((sum, m) => sum + estimateTokens(m.content), 0);

  const totalUsed = systemTokens + contextTokens + historyTokens + userTokens;
  const utilization = Math.min(100, (totalUsed / maxTokens) * 100);

  const segments = [
    { label: "System", tokens: systemTokens, color: "bg-purple-500" },
    { label: "Context", tokens: contextTokens, color: "bg-brand" },
    { label: "History", tokens: historyTokens, color: "bg-blue-500" },
    { label: "User", tokens: userTokens, color: "bg-emerald-500" },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Window Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">Context Window</span>
          <span className={cn(
            "font-mono font-bold",
            utilization > 90 ? "text-error" : utilization > 70 ? "text-warning" : "text-text-primary"
          )}>
            {totalUsed.toLocaleString()} / {maxTokens.toLocaleString()} tokens
          </span>
        </div>
        <div className="relative h-6 rounded-full bg-surface-hover overflow-hidden">
          {segments.map((seg, i) => (
            <div
              key={seg.label}
              className={cn("h-full transition-all", seg.color)}
              style={{
                width: `${maxTokens > 0 ? (seg.tokens / maxTokens) * 100 : 0}%`,
                position: "absolute",
                left: `${segments.slice(0, i).reduce((s, x) => s + (maxTokens > 0 ? (x.tokens / maxTokens) * 100 : 0), 0)}%`,
              }}
              title={`${seg.label}: ${seg.tokens.toLocaleString()} tokens`}
            />
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          {segments.map((seg) => (
            <span key={seg.label} className="text-[10px] text-text-tertiary flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", seg.color)} />
              {seg.label}: {seg.tokens.toLocaleString()}
            </span>
          ))}
        </div>
      </div>

      {/* Chunk Breakdown */}
      <div className="rounded-lg border border-border p-3">
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          Context Chunks ({chunks.length})
        </p>
        <div className="space-y-1.5">
          {chunks.map((chunk, i) => {
            const tokens = chunk.tokenCount || estimateTokens(chunk.content);
            const pct = contextTokens > 0 ? (tokens / contextTokens) * 100 : 0;
            return (
              <div key={chunk.chunkId} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-text-tertiary w-4 text-right shrink-0">#{i + 1}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full bg-brand/60 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-tertiary w-12 text-right shrink-0">
                  {tokens} tok
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning */}
      {utilization > 90 && (
        <div className="rounded-lg border border-error/20 bg-error/5 p-3 text-xs text-error">
          Context window is near capacity ({utilization.toFixed(0)}%). Some context may be truncated.
        </div>
      )}
    </div>
  );
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
