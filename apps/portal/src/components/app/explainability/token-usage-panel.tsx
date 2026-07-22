"use client";

import { cn } from "@/lib/utils";
import { Cpu, Database, FileSearch, MessageSquare, BarChart3 } from "lucide-react";

interface TokenUsagePanelProps {
  embeddingTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  embeddingLatencyMs?: number;
  searchLatencyMs?: number;
  totalLatencyMs?: number;
  className?: string;
}

export function TokenUsagePanel({
  embeddingTokens = 0,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  embeddingLatencyMs = 0,
  searchLatencyMs = 0,
  totalLatencyMs = 0,
  className,
}: TokenUsagePanelProps) {
  const allTokens = totalTokens || (promptTokens + completionTokens);
  const tokenSections = [
    { label: "Embedding", value: embeddingTokens, icon: Cpu, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Prompt", value: promptTokens, icon: FileSearch, color: "text-brand", bg: "bg-brand/10" },
    { label: "Completion", value: completionTokens, icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  const latencySections = [
    { label: "Embedding", value: embeddingLatencyMs, icon: Cpu, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Vector Search", value: searchLatencyMs, icon: Database, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total", value: totalLatencyMs, icon: BarChart3, color: "text-brand", bg: "bg-brand/10" },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Token Usage */}
      <div>
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          Token Usage
        </p>
        <div className="grid grid-cols-3 gap-2">
          {tokenSections.map((section) => (
            <div key={section.label} className={cn("rounded-lg border border-border p-3", section.bg)}>
              <div className="flex items-center gap-1.5 mb-1">
                <section.icon size={12} className={section.color} />
                <span className="text-[10px] font-medium text-text-tertiary">{section.label}</span>
              </div>
              <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {section.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        {allTokens > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-xs text-text-tertiary">Total Tokens</span>
            <span className="text-sm font-bold text-brand font-mono">{allTokens.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Latency */}
      <div>
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          Latency Breakdown
        </p>
        <div className="space-y-2">
          {latencySections.map((section) => (
            <div key={section.label} className="flex items-center gap-3">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-md shrink-0", section.bg)}>
                <section.icon size={12} className={section.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">{section.label}</span>
                  <span className="text-xs font-mono text-text-primary tabular-nums">
                    {section.value < 1000 ? `${section.value.toFixed(0)}ms` : `${(section.value / 1000).toFixed(2)}s`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", section.color.replace("text-", "bg-"))}
                    style={{
                      width: `${totalLatencyMs > 0 ? (section.value / totalLatencyMs) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
