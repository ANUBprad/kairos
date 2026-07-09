"use client";

import { useState, useMemo } from "react";
import {
  Lightbulb, Target, BarChart3, DollarSign,
  ChevronDown, ChevronRight, Check,
  Copy, AlertTriangle, GitBranch,
  Sparkles,
} from "lucide-react";
import {
  analyzeConfigurationSpace,
  calculateCoverage,
  identifyCoverageGaps,
  generateParetoFrontier,
  prioritizeExperiments,
  planCostQuality,
  estimateTotalCost,
  generateAllCombinations,
  configToKey,
} from "@/lib/experiment-planner";
import type {
  ExperimentRecommendation,
  CoverageAnalysis,
} from "@/lib/experiment-planner/types";
import { PremiumCard, CardHeader, CardTitle, CardDescription } from "@/components/ui/premium-card";
import { MetricDisplay } from "@/components/ui/metric-display";

interface RunData {
  id: string;
  name: string;
  config: Record<string, unknown>;
  metrics: Record<string, number>;
  createdAt: string;
  costMs: number;
  dataset: {
    id: string;
    name: string;
    questionCount: number;
  };
  questionCount: number;
}

interface PlannerPageProps {
  runs: RunData[];
}

const METRIC_LABELS: Record<string, string> = {
  avgRecallAtK: "Recall@K",
  avgPrecisionAtK: "Precision@K",
  avgMRR: "MRR",
  avgNDCG: "nDCG",
  avgHitRate: "Hit Rate",
};

export function PlannerPage({ runs }: PlannerPageProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "coverage" | "pareto" | "queue" | "cost">("overview");
  const [selectedMetrics] = useState<string[]>(["avgRecallAtK", "avgMRR"]);
  const [budgetMs, setBudgetMs] = useState<number>(3600000);
  const [maxExperiments, setMaxExperiments] = useState<number>(10);
  const [copied, setCopied] = useState(false);
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());

  const plannerResult = useMemo(() => {
    if (runs.length === 0) return null;

    const space = analyzeConfigurationSpace(runs);
    const coverage = calculateCoverage(space, runs);
    const gaps = identifyCoverageGaps(coverage, space, runs);

    const runData = runs.map((r) => ({
      id: r.id,
      config: r.config as Record<string, unknown>,
      metrics: r.metrics,
      timestamp: r.createdAt,
      costMs: r.costMs,
    }));

    let pareto;
    try {
      pareto = generateParetoFrontier(
        runs.map((r) => ({
          id: r.id,
          config: r.config as Record<string, unknown>,
          metrics: r.metrics,
        })),
        selectedMetrics
      );
    } catch {
      pareto = {
        points: [],
        frontierPoints: [],
        dimensions: selectedMetrics,
        dominatedCount: 0,
        frontierCount: 0,
      };
    }

    const allCombinations = generateAllCombinations(space);
    const explored = new Set(runs.map((r) => configToKey(r.config as Record<string, string | number | boolean>)));

    const unexplored = allCombinations
      .filter((combo) => !explored.has(configToKey(combo)))
      .slice(0, 50);

    const recommendations = prioritizeExperiments({
      candidates: unexplored,
      runs: runData,
      dimensions: space.dimensions,
      metrics: selectedMetrics,
      objectives: selectedMetrics,
      budgetMs,
    });

    const queue = planCostQuality({
      recommendations,
      budgetMs,
      maxExperiments,
    });

    const exploredRatio = coverage.coverageScore;
    const bestImprovement = recommendations.length > 0 ? recommendations[0].expectedImprovement : 0;
    const criticalGaps = gaps.filter((g) => g.severity === "high").map((g) => g.description);

    return {
      space,
      coverage,
      pareto,
      recommendations,
      queue,
      summary: {
        exploredRatio,
        bestEstimatedImprovement: bestImprovement,
        criticalGaps,
        researchDirection: determineResearchDirection(coverage, pareto, recommendations),
      },
    };
  }, [runs, selectedMetrics, budgetMs, maxExperiments]);

  const toggleRecExpanded = (id: string) => {
    setExpandedRecs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-500";
    if (score >= 0.6) return "text-amber-500";
    return "text-red-500";
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "high") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (priority === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  if (runs.length === 0) {
    return (
      <PremiumCard variant="elevated">
        <CardHeader icon={<Target size={16} />}>
          <CardTitle>Experiment Planner</CardTitle>
          <CardDescription>AI-powered experiment recommendations</CardDescription>
        </CardHeader>
        <p className="text-sm text-text-secondary">
          No completed experiments found. Run benchmarks from the Evaluation page to get recommendations.
        </p>
      </PremiumCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <PremiumCard variant="gradient">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-[var(--radius-lg)] bg-brand/10">
            <Sparkles size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Experiment Planner</h1>
            <p className="text-sm text-text-secondary">
              AI-powered experiment recommendations based on your configuration space, coverage gaps, and expected information gain.
            </p>
          </div>
        </div>
      </PremiumCard>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(["overview", "coverage", "pareto", "queue", "cost"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-surface text-text-primary border-b-2 border-brand"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab === "overview" && <Lightbulb size={14} className="inline mr-1" />}
            {tab === "coverage" && <BarChart3 size={14} className="inline mr-1" />}
            {tab === "pareto" && <GitBranch size={14} className="inline mr-1" />}
            {tab === "queue" && <Target size={14} className="inline mr-1" />}
            {tab === "cost" && <DollarSign size={14} className="inline mr-1" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && plannerResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricDisplay
              label="Total Configurations"
              value={plannerResult.space.totalCombinations.toLocaleString()}
              compact
            />
            <MetricDisplay
              label="Explored"
              value={runs.length}
              compact
            />
            <MetricDisplay
              label="Coverage"
              value={`${(plannerResult.summary.exploredRatio * 100).toFixed(1)}%`}
              status={plannerResult.summary.exploredRatio >= 0.8 ? "excellent" : plannerResult.summary.exploredRatio >= 0.5 ? "good" : "warning"}
              compact
            />
            <MetricDisplay
              label="Best Expected Improvement"
              value={`${(plannerResult.summary.bestEstimatedImprovement * 100).toFixed(1)}%`}
              status="good"
              compact
            />
          </div>

          <PremiumCard variant="elevated">
            <CardHeader icon={<Lightbulb size={16} />}>
              <CardTitle>Research Direction</CardTitle>
            </CardHeader>
            <p className="text-sm text-text-secondary">{plannerResult.summary.researchDirection}</p>

            {plannerResult.summary.criticalGaps.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase mb-2">Critical Gaps</h3>
                <div className="space-y-1">
                  {plannerResult.summary.criticalGaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-bg-secondary">
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-text-secondary">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </PremiumCard>

          <PremiumCard variant="elevated">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Top Recommendations</h2>
            <div className="space-y-2">
              {plannerResult.recommendations.slice(0, 5).map((rec) => (
                <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(rec.priority)}`}>
                    {rec.priority}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">{rec.rationale}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      Expected: +{(rec.expectedImprovement * 100).toFixed(1)}% | Confidence: {(rec.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  {rec.paretoOptimal && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Pareto
                    </span>
                  )}
                </div>
              ))}
            </div>
          </PremiumCard>

          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(JSON.stringify(plannerResult, null, 2))}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-surface-hover flex items-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Export Full Result
            </button>
          </div>
        </div>
      )}

      {activeTab === "coverage" && plannerResult && (
        <div className="space-y-4">
          <PremiumCard variant="elevated">
            <CardHeader icon={<BarChart3 size={16} />}>
              <CardTitle>Configuration Coverage</CardTitle>
            </CardHeader>

            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className={`text-4xl font-bold ${getScoreColor(plannerResult.coverage.coverageScore)}`}>
                  {(plannerResult.coverage.coverageScore * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-text-tertiary">
                  {plannerResult.coverage.exploredCombinations} / {plannerResult.coverage.totalCombinations} combinations explored
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-text-primary mb-2">Dimension Coverage</h3>
            <div className="space-y-3">
              {plannerResult.coverage.dimensionCoverage.map((dim) => (
                <div key={dim.dimension}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text-primary">{dim.dimension}</span>
                    <span className={`text-xs font-bold ${getScoreColor(dim.coverage)}`}>
                      {(dim.coverage * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dim.coverage >= 0.8 ? "bg-green-500" : dim.coverage >= 0.5 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${dim.coverage * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {dim.exploredValues} / {dim.totalValues} values
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>

          {plannerResult.coverage.unexploredCombinations.length > 0 && (
            <PremiumCard variant="elevated">
              <CardHeader icon={<Target size={16} />}>
                <CardTitle>Unexplored Combinations</CardTitle>
                <CardDescription>Top 10 configurations to try next</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                {plannerResult.coverage.unexploredCombinations.slice(0, 10).map((combo, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-bg-secondary">
                    <span className="text-text-tertiary font-mono text-xs">
                      {Object.entries(combo).map(([k, v]) => `${k}=${String(v)}`).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}
        </div>
      )}

      {activeTab === "pareto" && plannerResult && (
        <div className="space-y-4">
          <PremiumCard variant="elevated">
            <CardHeader icon={<GitBranch size={16} />}>
              <CardTitle>Pareto Frontier</CardTitle>
              <CardDescription>Optimal trade-offs between metrics</CardDescription>
            </CardHeader>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-bg-secondary">
                <div className="text-2xl font-bold text-text-primary">{plannerResult.pareto.frontierCount}</div>
                <div className="text-xs text-text-tertiary">Pareto-Optimal Points</div>
              </div>
              <div className="p-3 rounded-lg bg-bg-secondary">
                <div className="text-2xl font-bold text-text-primary">{plannerResult.pareto.dominatedCount}</div>
                <div className="text-xs text-text-tertiary">Dominated Points</div>
              </div>
              <div className="p-3 rounded-lg bg-bg-secondary">
                <div className="text-2xl font-bold text-text-primary">{plannerResult.pareto.dimensions.length}</div>
                <div className="text-xs text-text-tertiary">Objectives</div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-text-primary mb-2">Pareto-Optimal Experiments</h3>
            <div className="space-y-2">
              {plannerResult.pareto.frontierPoints.map((point) => (
                <div key={point.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Rank {point.rank}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{point.id}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(point.objectives).map(([metric, value]) => (
                      <div key={metric}>
                        <span className="text-text-tertiary">{METRIC_LABELS[metric] || metric}: </span>
                        <span className="text-text-primary font-mono">{typeof value === "number" ? value.toFixed(4) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      )}

      {activeTab === "queue" && plannerResult && (
        <div className="space-y-4">
          <PremiumCard variant="elevated">
            <CardHeader icon={<Target size={16} />}>
              <CardTitle>Experiment Queue</CardTitle>
              <CardDescription>Prioritized experiment recommendations</CardDescription>
            </CardHeader>
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-tertiary">Max:</label>
                <input
                  type="number"
                  value={maxExperiments}
                  onChange={(e) => setMaxExperiments(Number(e.target.value))}
                  className="w-16 text-sm rounded border border-border bg-bg-primary px-2 py-1"
                  min={1}
                  max={20}
                />
              </div>
            </div>

            <div className="space-y-2">
              {plannerResult.queue.recommendations.map((rec) => (
                <div key={rec.id}>
                  <button
                    onClick={() => toggleRecExpanded(rec.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-blue-300 text-left"
                  >
                    <span className="text-xs font-bold text-text-tertiary w-6">#{rec.rank}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(rec.priority)}`}>
                      {rec.priority}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary">{rec.rationale}</div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        +{(rec.expectedImprovement * 100).toFixed(1)}% | {(rec.confidence * 100).toFixed(0)}% conf | {rec.estimatedCost.estimatedLatencyMs.toFixed(0)}ms
                      </div>
                    </div>
                    {rec.paretoOptimal && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Pareto
                      </span>
                    )}
                    {expandedRecs.has(rec.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {expandedRecs.has(rec.id) && (
                    <div className="ml-9 mt-2 p-3 rounded-lg bg-bg-secondary text-sm">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {Object.entries(rec.config).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-text-tertiary">{k}: </span>
                            <span className="text-text-primary font-mono text-xs">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        <div>Statistical basis: {rec.statisticalBasis}</div>
                        <div className="mt-1">Affected metrics: {rec.affectedMetrics.join(", ")}</div>
                        <div className="mt-1">Information gain: {(rec.expectedInformationGain * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </PremiumCard>

          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(JSON.stringify(plannerResult.queue, null, 2))}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-surface-hover flex items-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Export Queue
            </button>
          </div>
        </div>
      )}

      {activeTab === "cost" && plannerResult && (
        <div className="space-y-4">
          <PremiumCard variant="elevated">
            <CardHeader icon={<DollarSign size={16} />}>
              <CardTitle>Cost vs Quality</CardTitle>
              <CardDescription>Budget and resource analysis</CardDescription>
            </CardHeader>
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-tertiary">Budget (ms):</label>
                <input
                  type="number"
                  value={budgetMs}
                  onChange={(e) => setBudgetMs(Number(e.target.value))}
                  className="w-24 text-sm rounded border border-border bg-bg-primary px-2 py-1"
                  min={60000}
                  step={60000}
                />
              </div>
            </div>

            {(() => {
              const costInfo = estimateTotalCost(plannerResult.queue);
              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <MetricDisplay
                    label="Experiments"
                    value={costInfo.experimentsCount}
                    compact
                  />
                  <MetricDisplay
                    label="Total Time"
                    value={costInfo.totalLatencyFormatted}
                    compact
                  />
                  <MetricDisplay
                    label="Tokens"
                    value={costInfo.totalTokensFormatted}
                    compact
                  />
                  <MetricDisplay
                    label="Est. Cost"
                    value={costInfo.totalCostFormatted}
                    compact
                  />
                </div>
              );
            })()}

            <h3 className="text-sm font-semibold text-text-primary mb-2">Cost per Improvement</h3>
            <div className="space-y-2">
              {plannerResult.queue.recommendations.slice(0, 10).map((rec) => {
                return (
                  <div key={rec.id} className="flex items-center gap-3 p-2 rounded bg-bg-secondary">
                    <span className="text-xs font-bold text-text-tertiary w-6">#{rec.rank}</span>
                    <div className="flex-1">
                      <div className="text-sm text-text-primary">{rec.rationale.slice(0, 60)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-tertiary">+{(rec.expectedImprovement * 100).toFixed(1)}%</div>
                      <div className="text-xs text-text-tertiary">{rec.estimatedCost.estimatedLatencyMs.toFixed(0)}ms</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PremiumCard>
        </div>
      )}
    </div>
  );
}

function determineResearchDirection(
  coverage: CoverageAnalysis,
  pareto: { frontierCount: number; dominatedCount: number },
  recommendations: ExperimentRecommendation[]
): string {
  if (coverage.coverageScore < 0.1) {
    return "Focus on exploring the configuration space. Coverage is very low. Start with the most impactful dimensions.";
  }

  if (coverage.coverageScore < 0.3) {
    return "Continue exploring under-covered dimensions. Prioritize dimensions with low coverage scores.";
  }

  if (pareto.frontierCount > pareto.dominatedCount) {
    return "Many Pareto-optimal configurations found. Focus on fine-tuning around the frontier.";
  }

  if (recommendations.length > 0 && recommendations[0].expectedImprovement > 0.2) {
    return "High expected improvements available. Focus on the top recommendations.";
  }

  return "Coverage is moderate. Balance exploration of new regions with exploitation of promising areas.";
}
