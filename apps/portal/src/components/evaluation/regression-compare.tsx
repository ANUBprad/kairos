"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  compareEvaluationRuns,
  getDatasetsForSelector,
  listRunsForDataset,
} from "@/lib/actions/evaluation";
import type {
  CompatibilityIssue,
  MetricComparisonOutcome,
  OverallVerdict,
  RegressionComparisonResult,
} from "@/lib/evaluation/regression";

type DatasetOption = Awaited<ReturnType<typeof getDatasetsForSelector>>[number];
type RunOption = Awaited<ReturnType<typeof listRunsForDataset>>[number];

function formatMetric(value: number, key: string): string {
  if (key.startsWith("latency")) return `${value.toFixed(0)}ms`;
  return value >= 1 ? value.toFixed(2) : value.toFixed(4);
}

function compatibilityMessage(error: CompatibilityIssue): string {
  switch (error.reason) {
    case "same_run":
      return "A run cannot be its own baseline. Pick two different runs.";
    case "different_datasets":
      return "These runs are on different datasets. Regression comparison requires two runs on the same dataset.";
    case "run_not_completed":
      return `${error.run === "baseline" ? "Baseline" : "Candidate"} run has status "${error.status}". Only completed runs are compared.`;
  }
}

function VerdictBadge({ verdict }: { verdict: MetricComparisonOutcome["verdict"] }) {
  switch (verdict) {
    case "improvement":
      return <Badge variant="success">Improvement</Badge>;
    case "regression":
      return <Badge variant="destructive">Regression</Badge>;
    case "no_significant_change":
      return <Badge variant="default">No change</Badge>;
    default:
      return <Badge variant="warning">Insufficient</Badge>;
  }
}

function OverallBanner({ overall }: { overall: OverallVerdict }) {
  const tone = overall.verdict === "regression"
    ? "border-error/30 bg-error/10 text-error"
    : overall.verdict === "improvement"
      ? "border-success/30 bg-success/10 text-success"
      : overall.verdict === "mixed" || overall.verdict === "insufficient"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-border bg-surface text-text-secondary";

  const message = overall.verdict === "regression"
    ? `Regression detected — candidate is statistically worse on ${overall.regressed} metric${overall.regressed === 1 ? "" : "s"}.`
    : overall.verdict === "improvement"
      ? `Improvement detected — candidate is statistically better on ${overall.improved} metric${overall.improved === 1 ? "" : "s"}.`
      : overall.verdict === "mixed"
        ? `Mixed signals — ${overall.improved} metric${overall.improved === 1 ? "" : "s"} improved, ${overall.regressed} regressed.`
        : overall.verdict === "insufficient"
          ? "Insufficient comparable observations — no verdict."
          : "No statistically significant change on any comparable metric.";

  return (
    <div className={`rounded-[var(--radius-lg)] border px-4 py-3 text-sm font-medium ${tone}`}>
      {message}
    </div>
  );
}

export function RegressionCompare() {
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [baselineId, setBaselineId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<RegressionComparisonResult | null>(null);

  useEffect(() => {
    getDatasetsForSelector()
      .then(setDatasets)
      .catch(() => setError("Failed to load datasets"));
  }, []);

  const loadRuns = useCallback(async (dsId: string) => {
    setError(null);
    setComparison(null);
    setBaselineId("");
    setCandidateId("");
    try {
      setRuns(await listRunsForDataset(dsId));
    } catch {
      setRuns([]);
    }
  }, []);

  const handleDatasetChange = (dsId: string) => {
    setDatasetId(dsId);
    if (dsId) void loadRuns(dsId);
    else setRuns([]);
  };

  const handleCompare = async () => {
    if (!baselineId || !candidateId || running) return;
    setRunning(true);
    setError(null);
    setComparison(null);
    try {
      setComparison(await compareEvaluationRuns(baselineId, candidateId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setRunning(false);
    }
  };

  const completedRuns = runs.filter((r) => r.status === "completed");
  const baselineOptions = completedRuns.filter((r) => r.id !== candidateId);
  const candidateOptions = completedRuns.filter((r) => r.id !== baselineId);
  const unfinishedCount = runs.length - completedRuns.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="!p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-4">
          <GitBranch size={14} />
          Baseline → New Run → Statistical Comparison
        </div>

        <div className="grid gap-4 lg:grid-cols-3 items-end">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="dataset-select">
              Dataset
            </label>
            <select
              id="dataset-select"
              value={datasetId}
              onChange={(e) => handleDatasetChange(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            >
              <option value="">Select a dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d._count.questions} questions)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="baseline-select">
              Baseline run
            </label>
            <select
              id="baseline-select"
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              aria-label="Select baseline run"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
              disabled={!datasetId || completedRuns.length === 0}
            >
              <option value="">{datasetId ? "Select a completed run" : "Pick a dataset first"}</option>
              {baselineOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Run ${r.createdAt.toLocaleDateString()}`} ({r.resultCount} cases)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="candidate-select">
              Candidate run
            </label>
            <select
              id="candidate-select"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              aria-label="Select candidate run"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
              disabled={!datasetId || completedRuns.length === 0 || !baselineId}
            >
              <option value="">{baselineId ? "Select a different completed run" : "Pick a baseline first"}</option>
              {candidateOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Run ${r.createdAt.toLocaleDateString()}`} ({r.resultCount} cases)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-tertiary">
            {datasetId && unfinishedCount > 0
              ? `${unfinishedCount} run${unfinishedCount === 1 ? "" : "s"} in progress or failed are excluded — only completed runs are compared.`
              : datasetId && completedRuns.length === 0
                ? "No runs yet on this dataset. Run a benchmark from the Evaluation page, then compare here."
                : "Compare two completed runs on the same dataset to detect statistically significant regressions. New runs are created from the Evaluation page."}
          </p>
          <Button
            onClick={handleCompare}
            disabled={!baselineId || !candidateId || running}
            variant="primary"
            size="lg"
            className="min-w-[180px]"
          >
            {running ? (
              <>
                <span className="animate-spin">⟳</span>
                Comparing...
              </>
            ) : (
              <>
                <Play size={16} />
                Compare Runs
              </>
            )}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {comparison && !comparison.ok && comparison.error && (
        <div className="rounded-[var(--radius-lg)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {compatibilityMessage(comparison.error)}
        </div>
      )}

      {comparison && comparison.ok && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="!p-4">
              <div className="text-xs font-medium text-text-secondary mb-1">Baseline</div>
              <div className="text-sm font-medium text-text-primary">{comparison.baseline.name || "Unnamed run"}</div>
              <div className="text-xs text-text-tertiary mt-1">{comparison.baseline.datasetName}</div>
              <div className="text-xs text-text-tertiary">
                {comparison.baseline.observationCount} results · {comparison.baseline.createdAt.slice(0, 10)}
              </div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs font-medium text-text-secondary mb-1">Candidate</div>
              <div className="text-sm font-medium text-text-primary">{comparison.candidate.name || "Unnamed run"}</div>
              <div className="text-xs text-text-tertiary mt-1">{comparison.candidate.datasetName}</div>
              <div className="text-xs text-text-tertiary">
                {comparison.candidate.observationCount} results · {comparison.candidate.createdAt.slice(0, 10)}
              </div>
            </Card>
          </div>

          <OverallBanner overall={comparison.overall} />

          <p className="text-xs text-text-tertiary">
            {comparison.alignment.shared} shared question{cases(comparison.alignment.shared)}
            {comparison.alignment.baselineOnly > 0 &&
              ` · ${comparison.alignment.baselineOnly} in baseline only`}
            {comparison.alignment.candidateOnly > 0 &&
              ` · ${comparison.alignment.candidateOnly} in candidate only`}
            {comparison.alignment.baselineOnly + comparison.alignment.candidateOnly > 0 &&
              " — these are reported, not extrapolated"}
          </p>

          <Card className="!p-5">
            <div className="text-sm font-medium mb-3">Per-Metric Statistical Comparison</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-tertiary">
                    <th className="py-2 pr-4 font-medium">Metric</th>
                    <th className="py-2 pr-4 font-medium">Baseline</th>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Δ</th>
                    <th className="py-2 pr-4 font-medium">n</th>
                    <th className="py-2 pr-4 font-medium">p-value</th>
                    <th className="py-2 pr-4 font-medium">Effect</th>
                    <th className="py-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.metrics.map((m) => (
                    <tr key={m.key} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-text-primary">{m.label}</div>
                        <div className="text-[11px] text-text-tertiary">
                          {m.higherIsBetter ? "higher is better" : "lower is better"}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {m.baselineMean === null ? "—" : formatMetric(m.baselineMean, m.key)}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {m.candidateMean === null ? "—" : formatMetric(m.candidateMean, m.key)}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {m.delta === null ? "—" : `${m.delta > 0 ? "+" : ""}${formatMetric(m.delta, m.key)}`}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{m.pairedCount}</td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {m.pValue === null ? "—" : m.pValue.toFixed(4)}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary capitalize">{m.effectSizeMagnitude ?? "—"}</td>
                      <td className="py-2">
                        <VerdictBadge verdict={m.verdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              Paired significance: paired t-test or Wilcoxon signed-rank per metric, α = 0.05, with effect size and a
              bootstrap 95% CI for the mean difference.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function cases(count: number): string {
  return count === 1 ? "" : "s";
}