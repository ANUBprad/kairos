"use client";

import { useState } from "react";
import { Play, Clock, Coins, Hash, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/lib/evaluation/visualization/charts";

interface RunPayload {
  namespace: string;
  dataset_name: string;
  max_entries: number;
  use_llm_judges: boolean;
}

interface RunAggregate {
  total?: number;
  succeeded?: number;
  failed?: number;
  success_rate?: number;
  mean_recall?: number;
  mean_precision?: number;
  mean_judge_scores?: Record<string, number>;
  mean_latency?: { total?: number };
  total_cost_usd?: number;
  trace_id?: string;
}

function formatMetric(value: number | undefined): string {
  if (value === undefined) return "—";
  return value >= 1 ? value.toFixed(2) : value.toFixed(4);
}

export function RegressionRun() {
  const [namespace, setNamespace] = useState("dev");
  const [datasetName, setDatasetName] = useState("");
  const [maxEntries, setMaxEntries] = useState(10);
  const [useLlmJudges, setUseLlmJudges] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunAggregate | null>(null);

  const runEvaluation = async () => {
    if (!namespace.trim() || !datasetName.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setRun(null);
    try {
      const body: RunPayload = {
        namespace: namespace.trim(),
        dataset_name: datasetName.trim(),
        max_entries: maxEntries,
        use_llm_judges: useLlmJudges,
      };
      const res = await fetch("/api/v1/evaluation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(typeof payload?.error === "string" ? payload.error : `Request failed (${res.status})`);
        return;
      }
      setRun(payload as RunAggregate);
    } catch {
      setError("Failed to reach the evaluation API");
    } finally {
      setIsRunning(false);
    }
  };

  const judgeScores = run?.mean_judge_scores ?? {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <GitBranch size={14} />
            Evaluation Run
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="namespace-input">
              Namespace
            </label>
            <input
              id="namespace-input"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="e.g. dev"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="dataset-name-input">
              Dataset name
            </label>
            <input
              id="dataset-name-input"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g. golden-eu-ai-act"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="max-entries-input">
              Max entries
            </label>
            <input
              id="max-entries-input"
              type="number"
              min={1}
              max={1000}
              value={maxEntries}
              onChange={(e) => setMaxEntries(Number(e.target.value) || 1)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={useLlmJudges}
              onChange={(e) => setUseLlmJudges(e.target.checked)}
              className="accent-brand"
            />
            Use LLM judges
          </label>
          <Button
            onClick={runEvaluation}
            disabled={isRunning || !datasetName.trim()}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {isRunning ? (
              <>
                <span className="animate-spin">⟳</span>
                Running...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Evaluation
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm text-error">
          {error}
        </div>
      )}

      {isRunning && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-8 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand border-t-transparent" />
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">Running evaluation...</p>
            <p className="text-xs text-text-secondary mt-1">
              Executing {maxEntries} entries through classify → retrieve → generate → judge
            </p>
          </div>
        </div>
      )}

      {run && !isRunning && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total" value={String(run.total ?? "—")} icon={Hash} />
            <MetricCard label="Success Rate" value={formatMetric(run.success_rate)} footer={`${run.succeeded ?? "—"} ok / ${run.failed ?? "—"} failed`} higherIsBetter />
            <MetricCard label="Mean Recall" value={formatMetric(run.mean_recall)} higherIsBetter />
            <MetricCard label="Mean Precision" value={formatMetric(run.mean_precision)} higherIsBetter />
            <MetricCard label="Cost" value={`$${(run.total_cost_usd ?? 0).toFixed(4)}`} icon={Coins} higherIsBetter={false} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Latency (total)" value={`${formatMetric(run.mean_latency?.total)}ms`} icon={Clock} higherIsBetter={false} />
          </div>

          {Object.keys(judgeScores).length > 0 && (
            <Card className="!p-4">
              <div className="text-sm font-medium mb-3">Mean Judge Scores</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(judgeScores).map(([dim, score]) => (
                  <MetricCard key={dim} label={dim} value={formatMetric(score)} higherIsBetter />
                ))}
              </div>
            </Card>
          )}

          {run.trace_id && (
            <p className="text-xs text-text-tertiary font-mono">traceId: {run.trace_id}</p>
          )}
        </div>
      )}
    </div>
  );
}