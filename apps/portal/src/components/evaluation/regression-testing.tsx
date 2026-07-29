"use client";

import { useState, useCallback } from "react";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptVersion {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
}

interface TestCase {
  id: string;
  question: string;
  expectedOutput?: string;
}

interface RegressionResult {
  testCaseId: string;
  question: string;
  status: "pass" | "fail" | "improvement" | "regression";
  currentScore: number;
  baselineScore: number;
  delta: number;
  metrics: {
    relevance: { current: number; baseline: number };
    accuracy: { current: number; baseline: number };
    coherence: { current: number; baseline: number };
  };
}

interface RegressionTestRun {
  id: string;
  promptVersion: PromptVersion;
  comparisonTarget: string;
  timestamp: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    regressions: number;
    improvements: number;
    passRate: number;
  };
  results: RegressionResult[];
  metricsComparison: {
    label: string;
    current: number;
    baseline: number;
    delta: number;
    status: "improved" | "regressed" | "unchanged";
  }[];
}

const MOCK_PROMPT_VERSIONS: PromptVersion[] = [
  { id: "pv-1", name: "Customer Support Prompt", version: "v2.3", createdAt: new Date("2026-07-20") },
  { id: "pv-2", name: "Customer Support Prompt", version: "v2.2", createdAt: new Date("2026-07-15") },
  { id: "pv-3", name: "Customer Support Prompt", version: "v2.1", createdAt: new Date("2026-07-10") },
  { id: "pv-4", name: "FAQ Generator Prompt", version: "v1.4", createdAt: new Date("2026-07-18") },
  { id: "pv-5", name: "FAQ Generator Prompt", version: "v1.3", createdAt: new Date("2026-07-12") },
  { id: "pv-6", name: "Code Review Assistant", version: "v3.0", createdAt: new Date("2026-07-22") },
];

const MOCK_TEST_CASES: TestCase[] = [
  { id: "tc-1", question: "How do I reset my password?", expectedOutput: "Step-by-step password reset instructions" },
  { id: "tc-2", question: "What are your business hours?", expectedOutput: "Business hours and holiday schedule" },
  { id: "tc-3", question: "Can I get a refund?", expectedOutput: "Refund policy and process details" },
  { id: "tc-4", question: "How do I contact support?", expectedOutput: "Contact channels and response times" },
  { id: "tc-5", question: "Is there a free trial?", expectedOutput: "Free trial details and limitations" },
  { id: "tc-6", question: "What payment methods do you accept?", expectedOutput: "List of supported payment methods" },
  { id: "tc-7", question: "How do I upgrade my plan?", expectedOutput: "Upgrade process and pricing comparison" },
  { id: "tc-8", question: "Can I export my data?", expectedOutput: "Data export instructions and formats" },
  { id: "tc-9", question: "Do you offer API access?", expectedOutput: "API documentation and access details" },
  { id: "tc-10", question: "What integrations are available?", expectedOutput: "List of supported integrations" },
  { id: "tc-11", question: "How do I cancel my subscription?", expectedOutput: "Cancellation process and retention offers" },
  { id: "tc-12", question: "Is my data secure?", expectedOutput: "Security measures and compliance info" },
];

function generateMockResults(comparisonTarget: string): RegressionTestRun {
  const seed = comparisonTarget.length + Date.now();
  const results: RegressionResult[] = MOCK_TEST_CASES.map((tc, i) => {
    const baseScore = 0.7 + (i % 3) * 0.08;
    const variance = ((seed + i * 7) % 10) / 100;
    const currentScore = Math.min(1, Math.max(0.3, baseScore + variance));
    const baselineScore = Math.min(1, Math.max(0.3, baseScore + variance - 0.05 + ((i * 13) % 10) / 100));
    const delta = currentScore - baselineScore;

    let status: RegressionResult["status"];
    if (delta > 0.02) status = "improvement";
    else if (delta < -0.02) status = "regression";
    else if (currentScore >= 0.75) status = "pass";
    else status = "fail";

    return {
      testCaseId: tc.id,
      question: tc.question,
      status,
      currentScore: Math.round(currentScore * 1000) / 1000,
      baselineScore: Math.round(baselineScore * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
      metrics: {
        relevance: {
          current: Math.round((currentScore + ((i * 3) % 10) / 100) * 1000) / 1000,
          baseline: Math.round((baselineScore + ((i * 2) % 8) / 100) * 1000) / 1000,
        },
        accuracy: {
          current: Math.round((currentScore + ((i * 5) % 12) / 100) * 1000) / 1000,
          baseline: Math.round((baselineScore + ((i * 4) % 10) / 100) * 1000) / 1000,
        },
        coherence: {
          current: Math.round((currentScore + ((i * 7) % 8) / 100) * 1000) / 1000,
          baseline: Math.round((baselineScore + ((i * 6) % 9) / 100) * 1000) / 1000,
        },
      },
    };
  });

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const regressions = results.filter((r) => r.status === "regression").length;
  const improvements = results.filter((r) => r.status === "improvement").length;

  const avgCurrent = results.reduce((s, r) => s + r.currentScore, 0) / results.length;
  const avgBaseline = results.reduce((s, r) => s + r.baselineScore, 0) / results.length;

  return {
    id: `reg-${Date.now()}`,
    promptVersion: MOCK_PROMPT_VERSIONS[0],
    comparisonTarget,
    timestamp: new Date(),
    summary: {
      total: results.length,
      passed,
      failed,
      regressions,
      improvements,
      passRate: Math.round(((passed + improvements) / results.length) * 100),
    },
    results,
    metricsComparison: [
      {
        label: "Overall Score",
        current: Math.round(avgCurrent * 1000) / 1000,
        baseline: Math.round(avgBaseline * 1000) / 1000,
        delta: Math.round((avgCurrent - avgBaseline) * 1000) / 1000,
        status: avgCurrent - avgBaseline > 0.01 ? "improved" : avgCurrent - avgBaseline < -0.01 ? "regressed" : "unchanged",
      },
      {
        label: "Relevance",
        current: Math.round((avgCurrent + 0.02) * 1000) / 1000,
        baseline: Math.round((avgBaseline + 0.01) * 1000) / 1000,
        delta: Math.round((avgCurrent - avgBaseline + 0.01) * 1000) / 1000,
        status: "improved",
      },
      {
        label: "Accuracy",
        current: Math.round((avgCurrent - 0.01) * 1000) / 1000,
        baseline: Math.round((avgBaseline + 0.02) * 1000) / 1000,
        delta: Math.round((avgCurrent - avgBaseline - 0.03) * 1000) / 1000,
        status: "regressed",
      },
      {
        label: "Coherence",
        current: Math.round((avgCurrent + 0.01) * 1000) / 1000,
        baseline: Math.round((avgBaseline + 0.01) * 1000) / 1000,
        delta: Math.round((avgCurrent - avgBaseline) * 1000) / 1000,
        status: "unchanged",
      },
      {
        label: "Latency (ms)",
        current: Math.round(120 + ((seed % 50) - 25)),
        baseline: Math.round(135 + ((seed % 40) - 20)),
        delta: 0,
        status: "improved",
      },
    ],
  };
}

function StatusIcon({ status }: { status: RegressionResult["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 size={16} className="text-success" />;
    case "fail":
      return <XCircle size={16} className="text-error" />;
    case "improvement":
      return <TrendingUp size={16} className="text-success" />;
    case "regression":
      return <TrendingDown size={16} className="text-error" />;
  }
}

function StatusBadge({ status }: { status: RegressionResult["status"] }) {
  const config = {
    pass: { label: "Pass", className: "bg-success/10 text-success border-success/30" },
    fail: { label: "Fail", className: "bg-error/10 text-error border-error/30" },
    improvement: { label: "Improved", className: "bg-success/10 text-success border-success/30" },
    regression: { label: "Regression", className: "bg-error/10 text-error border-error/30" },
  };
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[8px] border", c.className)}>
      <StatusIcon status={status} />
      {c.label}
    </span>
  );
}

function MetricDelta({ value, higherIsBetter = true }: { value: number; higherIsBetter?: boolean }) {
  if (Math.abs(value) < 0.001) {
    return (
      <span className="inline-flex items-center gap-0.5 text-text-tertiary text-xs">
        <Minus size={12} />
        0.000
      </span>
    );
  }

  const isPositive = value > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-mono tabular-nums", isGood ? "text-success" : "text-error")}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isPositive ? "+" : ""}
      {value.toFixed(3)}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof CheckCircle2; color: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 space-y-1">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono tabular-nums">{value}</p>
    </div>
  );
}

export function RegressionTesting() {
  const [selectedVersion, setSelectedVersion] = useState<string>(MOCK_PROMPT_VERSIONS[0].id);
  const [comparisonTarget, setComparisonTarget] = useState<string>("previous_version");
  const [isRunning, setIsRunning] = useState(false);
  const [testRun, setTestRun] = useState<RegressionTestRun | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const runRegressionTest = useCallback(async () => {
    setIsRunning(true);
    setTestRun(null);
    await new Promise((r) => setTimeout(r, 1500));
    const result = generateMockResults(comparisonTarget);
    setTestRun(result);
    setIsRunning(false);
  }, [comparisonTarget]);

  const selectedVersionData = MOCK_PROMPT_VERSIONS.find((v) => v.id === selectedVersion);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-brand/10">
          <FlaskConical size={20} className="text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Regression Testing</h2>
          <p className="text-sm text-text-secondary">Test prompt versions against baselines to detect regressions</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <BarChart3 size={14} />
            Prompt Version
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="prompt-version-select">
              Select version to test
            </label>
            <div className="relative">
              <select
                id="prompt-version-select"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-8 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              >
                {MOCK_PROMPT_VERSIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.version}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>
            {selectedVersionData && (
              <p className="text-xs text-text-tertiary">
                Created {selectedVersionData.createdAt.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <RotateCcw size={14} />
            Comparison Target
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary" htmlFor="comparison-target-select">
              Compare against
            </label>
            <div className="relative">
              <select
                id="comparison-target-select"
                value={comparisonTarget}
                onChange={(e) => setComparisonTarget(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-8 text-sm rounded-lg border border-border bg-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              >
                <option value="previous_version">vs Previous Version</option>
                <option value="golden_dataset">vs Golden Dataset</option>
                <option value="previous_model">vs Previous Model</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>
            <p className="text-xs text-text-tertiary">
              {comparisonTarget === "previous_version" && "Compare current version against the immediately preceding version"}
              {comparisonTarget === "golden_dataset" && "Test against curated golden dataset entries with known-good outputs"}
              {comparisonTarget === "previous_model" && "Test with a different model configuration to compare performance"}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Play size={14} />
            Execute Test
          </div>
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Run {MOCK_TEST_CASES.length} test cases against the selected comparison target.
            </p>
            <Button
              onClick={runRegressionTest}
              disabled={isRunning}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Running Tests...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Regression Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand border-t-transparent" />
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Running regression tests...</p>
              <p className="text-xs text-text-secondary mt-1">Evaluating {MOCK_TEST_CASES.length} test cases</p>
            </div>
            <div className="w-64 h-1.5 rounded-full bg-surface-hover overflow-hidden">
              <div className="h-full bg-brand rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        </div>
      )}

      {testRun && !isRunning && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Total Tests" value={testRun.summary.total} icon={FlaskConical} color="text-info" />
            <SummaryCard label="Passed" value={testRun.summary.passed} icon={CheckCircle2} color="text-success" />
            <SummaryCard label="Failed" value={testRun.summary.failed} icon={XCircle} color="text-error" />
            <SummaryCard label="Regressions" value={testRun.summary.regressions} icon={TrendingDown} color="text-error" />
            <SummaryCard label="Improvements" value={testRun.summary.improvements} icon={TrendingUp} color="text-success" />
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-text-primary">Metrics Comparison</h3>
                <span className={cn(
                  "text-xs px-2.5 py-0.5 rounded-full font-medium border",
                  testRun.summary.passRate >= 80
                    ? "bg-success/10 text-success border-success/30"
                    : testRun.summary.passRate >= 50
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-error/10 text-error border-error/30"
                )}>
                  {testRun.summary.passRate}% Pass Rate
                </span>
              </div>
              <span className="text-xs text-text-tertiary">
                {testRun.timestamp.toLocaleString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 pr-4 font-medium text-text-secondary">Metric</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">Current</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">Baseline</th>
                    <th className="text-right py-2.5 px-4 font-medium text-text-secondary">Delta</th>
                    <th className="text-right py-2.5 pl-4 font-medium text-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testRun.metricsComparison.map((m) => (
                    <tr key={m.label} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 font-medium text-text-primary">{m.label}</td>
                      <td className="text-right py-3 px-4 font-mono tabular-nums text-text-primary">
                        {m.label.includes("Latency") ? `${m.current}ms` : m.current.toFixed(3)}
                      </td>
                      <td className="text-right py-3 px-4 font-mono tabular-nums text-text-secondary">
                        {m.label.includes("Latency") ? `${m.baseline}ms` : m.baseline.toFixed(3)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <MetricDelta
                          value={m.label.includes("Latency") ? m.current - m.baseline : m.delta}
                          higherIsBetter={!m.label.includes("Latency")}
                        />
                      </td>
                      <td className="text-right py-3 pl-4">
                        {m.status === "improved" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <TrendingUp size={12} />
                            Improved
                          </span>
                        )}
                        {m.status === "regressed" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-error">
                            <TrendingDown size={12} />
                            Regressed
                          </span>
                        )}
                        {m.status === "unchanged" && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                            <Minus size={12} />
                            Unchanged
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Per-Question Results</h3>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-brand hover:text-brand-hover transition-colors"
              >
                {showDetails ? "Show Less" : "Show All"}
              </button>
            </div>

            <div className="space-y-2">
              {(showDetails ? testRun.results : testRun.results.slice(0, 6)).map((r, i) => (
                <div
                  key={r.testCaseId}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                    r.status === "regression"
                      ? "border-error/30 bg-error/5"
                      : r.status === "improvement"
                      ? "border-success/30 bg-success/5"
                      : "border-border hover:bg-surface-hover"
                  )}
                >
                  <span className="text-xs text-text-tertiary w-6 shrink-0 font-mono">#{i + 1}</span>
                  <StatusIcon status={r.status} />
                  <p className="flex-1 text-sm text-text-primary truncate">{r.question}</p>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">Score</p>
                      <p className="text-sm font-mono tabular-nums text-text-primary">{r.currentScore.toFixed(3)}</p>
                    </div>
                    <MetricDelta value={r.delta} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>

            {!showDetails && testRun.results.length > 6 && (
              <p className="text-xs text-text-tertiary text-center mt-3">
                + {testRun.results.length - 6} more test cases
              </p>
            )}
          </div>

          {testRun.summary.regressions > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-error/30 bg-error/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-error" />
                <h3 className="text-sm font-semibold text-error">Regressions Detected</h3>
              </div>
              <div className="space-y-2">
                {testRun.results
                  .filter((r) => r.status === "regression")
                  .map((r) => (
                    <div key={r.testCaseId} className="flex items-center gap-3 text-sm">
                      <TrendingDown size={14} className="text-error shrink-0" />
                      <span className="text-text-primary flex-1 truncate">{r.question}</span>
                      <span className="text-xs font-mono text-error">
                        {r.baselineScore.toFixed(3)} → {r.currentScore.toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {testRun.summary.improvements > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-success/30 bg-success/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-success" />
                <h3 className="text-sm font-semibold text-success">Improvements Detected</h3>
              </div>
              <div className="space-y-2">
                {testRun.results
                  .filter((r) => r.status === "improvement")
                  .map((r) => (
                    <div key={r.testCaseId} className="flex items-center gap-3 text-sm">
                      <TrendingUp size={14} className="text-success shrink-0" />
                      <span className="text-text-primary flex-1 truncate">{r.question}</span>
                      <span className="text-xs font-mono text-success">
                        {r.baselineScore.toFixed(3)} → {r.currentScore.toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!testRun && !isRunning && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface p-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <FlaskConical size={40} className="text-text-tertiary" />
            <div>
              <p className="text-sm font-medium text-text-primary">No test results yet</p>
              <p className="text-xs text-text-secondary mt-1">
                Select a prompt version and comparison target, then click &quot;Run Regression Test&quot;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
