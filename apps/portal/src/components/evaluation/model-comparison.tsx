"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Info,
  BarChart3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { traceStats } from "@/lib/actions/observability";
import { costSummary } from "@/lib/actions/cost";

const MODEL_COLORS: Record<string, string> = {
  openai: "#FF5A0A",
  gemini: "#4285F4",
  anthropic: "#D97757",
  "self-hosted": "#8B5CF6",
  local: "#8B5CF6",
  unknown: "#8B8B8B",
};

function modelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return MODEL_COLORS.unknown;
}

interface ModelRow {
  model: string;
  requests: number;
  avgLatencyMs: number | null;
  tokens: number | null;
  cost: number | null;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  if (cost === 0) return "$0.00";
  if (cost < 0.001) return `$${(cost * 1000).toFixed(2)}k`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number | null): string {
  if (tokens === null) return "—";
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
}

function formatRequests(requests: number): string {
  return requests.toLocaleString();
}

function getCellColor(
  value: number,
  higherIsBetter: boolean,
  allValues: number[]
): string {
  const sorted = [...allValues].sort((a, b) => (higherIsBetter ? b - a : a - b));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (value === best) return "bg-success/15 text-success";
  if (value === worst) return "bg-error/15 text-error";
  return "bg-surface text-text-primary";
}

function NotCollected() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
        <Activity size={18} className="text-text-tertiary" />
      </div>
      <p className="text-sm font-medium text-text-secondary mt-3">
        No traced model activity yet
      </p>
      <p className="text-xs text-text-tertiary mt-1 max-w-[280px]">
        Per-model performance appears once the first traced generation is recorded in this
        workspace.
      </p>
    </div>
  );
}

interface ModelComparisonProps {
  className?: string;
}

export function ModelComparison({ className }: ModelComparisonProps) {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [trace, cost] = await Promise.all([traceStats(30), costSummary(30)]);
        if (cancelled) return;

const byModel = new Map<string, ModelRow>();
        for (const t of trace?.byModel ?? []) {
          const model = String(t.model ?? "unknown");
          byModel.set(model, {
            model,
            requests: t._count ?? 0,
            avgLatencyMs: t._avg?.durationMs ?? null,
            tokens: null,
            cost: null,
          });
        }
        for (const c of cost?.byModel ?? []) {
          const model = String(c.model ?? "unknown");
          const existing = byModel.get(model);
          if (existing) {
            existing.tokens = c._sum?.totalTokens ?? null;
            existing.cost = c._sum?.cost ?? null;
          } else {
            byModel.set(model, {
              model,
              requests: Number(c._sum?.requestCount ?? 0),
              avgLatencyMs: null,
              tokens: c._sum?.totalTokens ?? null,
              cost: c._sum?.cost ?? null,
            });
          }
        }

        const sorted = [...byModel.values()].sort((a, b) => b.requests - a.requests);
        setRows(sorted);
        setSelected(sorted.slice(0, 4).map((r) => r.model));
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((r) => selected.includes(r.model)),
    [rows, selected]
  );

  const toggleModel = (model: string) => {
    setSelected((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const latencyValues = visibleRows
    .map((r) => r.avgLatencyMs)
    .filter((v): v is number => v !== null);

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-text-tertiary mt-0.5 shrink-0" />
          <p className="text-sm text-text-secondary">
            On-demand per-prompt comparison is not yet available. This table shows real
            metrics collected from production traces over the last 30 days.
          </p>
        </div>
      </Card>

      {loadState === "loading" && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      )}

      {loadState === "error" && (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-text-primary">Failed to load model data</p>
          <p className="text-xs text-text-tertiary mt-1">
            Collected trace metrics could not be fetched.
          </p>
        </Card>
      )}

      {loadState === "ready" && rows.length === 0 && (
        <Card className="p-5">
          <NotCollected />
        </Card>
      )}

      {loadState === "ready" && rows.length > 0 && (
        <>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-text-primary">
                Models with collected activity
              </label>
              <span className="text-xs text-text-tertiary">
                {selected.length}/{Math.min(rows.length, 4)} shown
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {rows.map((row) => {
                const isSelected = selected.includes(row.model);
                return (
                  <button
                    key={row.model}
                    onClick={() => toggleModel(row.model)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                      isSelected
                        ? "border-brand bg-brand/5 text-text-primary"
                        : "border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "border-brand bg-brand" : "border-border"
                      )}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{row.model}</div>
                      <div className="text-[10px] text-text-tertiary">
                        {formatRequests(row.requests)} requests
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Collected Performance (30d)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" role="table">
                <caption className="sr-only">
                  Real model performance from production traces over the last 30 days
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-text-tertiary font-medium" scope="col">
                      Model
                    </th>
                    <th className="text-right py-2 px-3 font-medium" scope="col">Requests</th>
                    <th className="text-right py-2 px-3 font-medium" scope="col">Avg Latency</th>
                    <th className="text-right py-2 px-3 font-medium" scope="col">Tokens</th>
                    <th className="text-right py-2 px-3 font-medium" scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.model} className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: modelColor(r.model) }}
                          />
                          <span className="text-text-primary font-medium">{r.model}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-block rounded-[6px] px-2 py-0.5 font-mono tabular-nums text-[11px] bg-surface text-text-primary">
                          {formatRequests(r.requests)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {r.avgLatencyMs !== null ? (
                          <span
                            className={cn(
                              "inline-block rounded-[6px] px-2 py-0.5 font-mono tabular-nums text-[11px]",
                              getCellColor(r.avgLatencyMs, false, latencyValues)
                            )}
                          >
                            {formatLatency(r.avgLatencyMs)}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {formatTokens(r.tokens)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {formatCost(r.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-4 text-[11px] text-text-tertiary">
              <BarChart3 size={12} className="shrink-0" />
              <span>
                Quality scores (answer quality, groundedness, hallucination, faithfulness) are
                not recorded for this workspace yet and are intentionally not shown.
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}