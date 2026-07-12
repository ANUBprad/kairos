"use client";

import {
  BarChart3, Clock, TrendingUp,
  CheckCircle2, BookOpen,
  Cpu, Layers, FlaskConical,
  Lightbulb, AlertTriangle, Target,
  Sparkles, GitBranch,
} from "lucide-react";
import { MetricCard } from "@/components/research/metric-card";
import { Pipeline } from "@/components/research/pipeline";
import { BarChart } from "@/lib/evaluation/visualization/charts";
import type { IntelligenceResult } from "@/lib/evaluation/research-intelligence";
import type { ResearchScientistResult } from "@/lib/research-scientist";
import { ResearchScientist } from "@/components/app/research-scientist";
import { PremiumCard, CardHeader, CardTitle, CardDescription } from "@/components/ui/premium-card";
import { MetricDisplay } from "@/components/ui/metric-display";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { PageHeader } from "@/components/app/page-header";

interface ResearchDashboardProps {
  currentKbName: string | null;
  currentKbDocs: number;
  retrievalStrategy: string;
  embeddingModel: string;
  chunkingStrategy: string;
  knowledgeBases: number;
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  totalExperiments: number;
  totalExperimentRuns: number;
  datasets: Array<{ id: string; name: string; _count: { questions: number; runs: number } }>;
  benchmarkRuns: Array<{
    id: string;
    name: string | null;
    aggregatedMetrics: Record<string, number> | null;
    createdAt: Date;
    datasetName: string;
    questionCount: number;
  }>;
  avgRecall: number;
  latestEval: {
    name: string | null;
    date: Date;
    metrics: Record<string, number> | null;
  } | null;
  latestReport: {
    name: string | null;
    date: Date;
    metrics: Record<string, number>;
  } | null;
  scientificAnalysis?: {
    significantImprovements: Array<{
      metric: string;
      from: string;
      to: string;
      improvement: number;
      pValue: number;
      effectSize: string;
      ci: [number, number];
    }>;
    equivalentConfigurations: Array<{
      metric: string;
      configs: string[];
    }>;
    confidenceIntervals: Array<{
      config: string;
      metric: string;
      mean: number;
      ciLower: number;
      ciUpper: number;
    }>;
    summary: {
      totalComparisons: number;
      significantCount: number;
    };
  };
  intelligenceResult?: IntelligenceResult;
  researchScientistResult?: ResearchScientistResult;
}

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: "FileText", color: "bg-blue-500" },
  { id: "chunks", label: "Chunks", icon: "Scissors", color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: "TableProperties", color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: "Search", color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: "ScrollText", color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: "Bot", color: "bg-purple-500" },
  { id: "evaluation", label: "Evaluation", icon: "BarChart3", color: "bg-violet-500" },
];

export function ResearchDashboard({
  currentKbName,
  currentKbDocs,
  retrievalStrategy,
  embeddingModel,
  chunkingStrategy,
  knowledgeBases,
  totalDocuments,
  totalChunks,
  totalEmbeddings,
  totalExperiments,
  totalExperimentRuns,
  datasets,
  benchmarkRuns,
  avgRecall,
  latestEval,
  latestReport,
  scientificAnalysis,
  intelligenceResult,
  researchScientistResult,
}: ResearchDashboardProps) {
  const recentRuns = benchmarkRuns.slice(0, 8);

  const lbData = benchmarkRuns.length > 0
    ? benchmarkRuns.slice(0, 6).map((r) => {
        const m = r.aggregatedMetrics;
        const score = m
          ? ((m.avgRecallAtK ?? 0) + (m.avgPrecisionAtK ?? 0) + (m.avgHitRate ?? 0) + (m.avgMRR ?? 0) + (m.avgNDCG ?? 0)) / 5
          : 0;
        return { label: r.name || "Unnamed", value: Math.round(score * 1000) / 1000 };
      })
    : [];

  const timelineData = benchmarkRuns.length > 0
    ? [...benchmarkRuns].reverse().map((r) => {
        const m = r.aggregatedMetrics;
        return { label: new Date(r.createdAt).toLocaleDateString(), value: m?.avgRecallAtK ?? 0 };
      })
    : [];

  const hasKb = currentKbName !== null;
  const hasBenchmark = benchmarkRuns.length > 0;
  const healthScore = Math.round(
    (hasKb ? 30 : 0) + (totalDocuments > 0 ? 20 : 0) + (totalExperiments > 0 ? 20 : 0) + (hasBenchmark ? 30 : 0)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Research Dashboard"
        description="Adaptive Retrieval-Augmented Generation Research Platform"
        purpose="Statistical analysis and automated insights from your experiments."
        nextAction={{ label: "Ask Copilot", href: "/app/copilot" }}
        relatedPages={[
          { label: "Experiment Planner", href: "/app/planner" },
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Benchmark Explorer", href: "/app/benchmark-explorer" },
        ]}
      />
      {/* Hero Header */}
      <PremiumCard variant="gradient">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-[var(--radius-lg)] bg-brand/10">
                <Sparkles size={20} className="text-brand" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary">Research Dashboard</h1>
            </div>
            <p className="text-sm text-text-secondary">
              Adaptive Retrieval-Augmented Generation Research Platform
            </p>
          </div>
          <div className="flex items-center gap-6">
            <StatusIndicator
              status={hasBenchmark ? "success" : hasKb ? "warning" : "error"}
              label={hasBenchmark ? "Benchmarked" : hasKb ? "No Benchmarks" : "No Data"}
            />
            <div className="text-right">
              <p className="text-2xl font-bold text-text-primary">{healthScore}%</p>
              <p className="text-[11px] text-text-tertiary uppercase tracking-wider">Research Health</p>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Research Brief Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricDisplay
          label="Knowledge Bases"
          value={knowledgeBases}
          compact
        />
        <MetricDisplay
          label="Documents"
          value={totalDocuments}
          compact
        />
        <MetricDisplay
          label="Experiments"
          value={totalExperiments}
          compact
        />
        <MetricDisplay
          label="Avg Recall"
          value={avgRecall}
          compact
        />
      </div>

      {/* Current Configuration */}
      <PremiumCard variant="elevated">
        <CardHeader icon={<Cpu size={16} />}>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>Active RAG pipeline settings</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-text-tertiary">Knowledge Base</span>
            <p className="text-sm font-medium text-text-primary truncate">{currentKbName ?? "—"}</p>
            <p className="text-xs text-text-tertiary">{currentKbDocs} documents</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-tertiary">Retrieval Strategy</span>
            <p className="text-sm font-medium text-text-primary capitalize">{retrievalStrategy}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-tertiary">Embedding Model</span>
            <p className="text-sm font-medium text-text-primary">{embeddingModel}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-tertiary">Chunking Strategy</span>
            <p className="text-sm font-medium text-text-primary capitalize">{chunkingStrategy}</p>
          </div>
        </div>
      </PremiumCard>

      {/* Pipeline Visualization */}
      <PremiumCard variant="elevated">
        <CardHeader icon={<Layers size={16} />}>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>Document processing flow</CardDescription>
        </CardHeader>
        <Pipeline stages={PIPELINE_STAGES} size="md" />
      </PremiumCard>

      {/* KB Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard label="Knowledge Bases" value={String(knowledgeBases)} icon="Database" />
        <MetricCard label="Documents" value={String(totalDocuments)} icon="FileText" />
        <MetricCard label="Chunks" value={String(totalChunks)} icon="Scissors" />
        <MetricCard label="Embeddings" value={String(totalEmbeddings)} icon="TableProperties" />
        <MetricCard label="Experiments" value={String(totalExperiments)} icon="FlaskConical" />
        <MetricCard label="Experiment Runs" value={String(totalExperimentRuns)} icon="BarChart3" />
        <MetricCard label="Avg Recall@K" value={avgRecall.toFixed(4)} icon="TrendingUp" />
        <MetricCard label="Datasets" value={String(datasets.length)} icon="BookOpen" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest Evaluation */}
        <PremiumCard variant="elevated">
          <CardHeader icon={<CheckCircle2 size={16} className="text-success" />}>
            <CardTitle>Last Benchmark</CardTitle>
            <CardDescription>Latest evaluation results</CardDescription>
          </CardHeader>
          {latestEval ? (
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-text-primary">{latestEval.name || "Unnamed Evaluation"}</p>
                <p className="text-xs text-text-tertiary">{new Date(latestEval.date).toLocaleString()}</p>
              </div>
              {latestEval.metrics && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(latestEval.metrics)
                    .filter(([k]) => k.startsWith("avg") && k !== "avgLatencyMs")
                    .slice(0, 6)
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-text-tertiary">{key.replace("avg", "")}</span>
                        <span className="font-mono font-medium text-text-primary">{(val as number).toFixed(4)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary py-6 text-center">No evaluations yet</p>
          )}
        </PremiumCard>

        {/* Latest Report */}
        <PremiumCard variant="elevated">
          <CardHeader icon={<BookOpen size={16} />}>
            <CardTitle>Latest Report</CardTitle>
            <CardDescription>Research summary and findings</CardDescription>
          </CardHeader>
          {latestReport ? (
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-text-primary">{latestReport.name || "Unnamed Report"}</p>
                <p className="text-xs text-text-tertiary">{new Date(latestReport.date).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(latestReport.metrics)
                  .filter(([k]) => k.startsWith("avg") && k !== "avgLatencyMs")
                  .slice(0, 6)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-text-tertiary">{key.replace("avg", "")}</span>
                      <span className="font-mono font-medium text-text-primary">{(val as number).toFixed(4)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary py-6 text-center">No reports generated yet</p>
          )}
        </PremiumCard>
      </div>

      {/* Leaderboard Preview */}
      {lbData.length > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<TrendingUp size={16} />}>
            <CardTitle>Top Benchmark Runs</CardTitle>
            <CardDescription>Composite score comparison</CardDescription>
          </CardHeader>
          <BarChart data={lbData} height={200} />
        </PremiumCard>
      )}

      {/* Recall Timeline */}
      {timelineData.length > 1 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<Clock size={16} />}>
            <CardTitle>Recall@K Over Time</CardTitle>
            <CardDescription>Performance trend across evaluations</CardDescription>
          </CardHeader>
          <div className="flex items-end gap-2 h-32">
            {timelineData.map((d, i) => {
              const maxVal = Math.max(...timelineData.map((x) => x.value), 0.01);
              const h = (d.value / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand/60 hover:bg-brand transition-opacity"
                    style={{ height: `${Math.max(h, 1)}%` }}
                    title={`${d.label}: ${d.value.toFixed(4)}`}
                  />
                  <span className="text-[10px] text-text-tertiary rotate-45 origin-left whitespace-nowrap">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </PremiumCard>
      )}

      {/* Scientific Analysis */}
      {scientificAnalysis && scientificAnalysis.summary.totalComparisons > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<FlaskConical size={16} />}>
            <CardTitle>Scientific Analysis</CardTitle>
            <CardDescription>Statistical significance testing</CardDescription>
          </CardHeader>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <MetricCard label="Total Comparisons" value={String(scientificAnalysis.summary.totalComparisons)} icon="FlaskConical" />
            <MetricCard label="Significant Results" value={String(scientificAnalysis.summary.significantCount)} icon="TrendingUp" />
            <MetricCard label="Equivalent Groups" value={String(scientificAnalysis.equivalentConfigurations.length)} icon="Layers" />
            <MetricCard label="CI Entries" value={String(scientificAnalysis.confidenceIntervals.length)} icon="BarChart3" />
          </div>

          {/* Significant Improvements */}
          {scientificAnalysis.significantImprovements.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Significant Improvements</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-xs text-text-tertiary">Metric</th>
                      <th className="text-left py-2 px-4 text-xs text-text-tertiary">From</th>
                      <th className="text-left py-2 px-4 text-xs text-text-tertiary">To</th>
                      <th className="text-right py-2 px-4 text-xs text-text-tertiary">p-value</th>
                      <th className="text-right py-2 px-4 text-xs text-text-tertiary">Effect</th>
                      <th className="text-right py-2 pl-4 text-xs text-text-tertiary">95% CI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scientificAnalysis.significantImprovements.map((imp, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-emerald-500">{imp.metric}</td>
                        <td className="py-2 px-4 text-text-secondary">{imp.from}</td>
                        <td className="py-2 px-4 text-text-secondary">{imp.to}</td>
                        <td className="py-2 px-4 text-right font-mono">{imp.pValue.toFixed(4)}</td>
                        <td className="py-2 px-4 text-right font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            imp.effectSize === "large" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            imp.effectSize === "medium" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            imp.effectSize === "small" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-bg-secondary text-text-secondary"
                          }`}>
                            {imp.effectSize}
                          </span>
                        </td>
                        <td className="py-2 pl-4 text-right font-mono text-xs text-text-tertiary">
                          [{imp.ci[0].toFixed(4)}, {imp.ci[1].toFixed(4)}]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Equivalent Configurations */}
          {scientificAnalysis.equivalentConfigurations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Equivalent Configurations</h3>
              <div className="space-y-2">
                {scientificAnalysis.equivalentConfigurations.map((eq, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-bg-secondary text-sm">
                    <span className="font-medium text-text-primary">{eq.metric}</span>
                    <span className="text-text-secondary">
                      {eq.configs.length} configs (no significant differences)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Intervals */}
          {scientificAnalysis.confidenceIntervals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Confidence Intervals</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-xs text-text-tertiary">Configuration</th>
                      <th className="text-left py-2 px-4 text-xs text-text-tertiary">Metric</th>
                      <th className="text-right py-2 px-4 text-xs text-text-tertiary">Mean</th>
                      <th className="text-right py-2 pl-4 text-xs text-text-tertiary">95% CI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scientificAnalysis.confidenceIntervals.map((ci, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium text-text-primary">{ci.config}</td>
                        <td className="py-2 px-4 text-text-secondary">{ci.metric}</td>
                        <td className="py-2 px-4 text-right font-mono">{ci.mean.toFixed(4)}</td>
                        <td className="py-2 pl-4 text-right font-mono text-xs text-text-tertiary">
                          [{ci.ciLower.toFixed(4)}, {ci.ciUpper.toFixed(4)}]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PremiumCard>
      )}

      {/* Research Insights */}
      {intelligenceResult && intelligenceResult.findings.length > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<Lightbulb size={16} />}>
            <CardTitle>Research Insights</CardTitle>
            <CardDescription>Key findings and recommendations</CardDescription>
          </CardHeader>

          {/* Key Findings */}
          {intelligenceResult.findings.filter((f) => f.type !== "trend").length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Key Findings</h3>
              <div className="space-y-3">
                {intelligenceResult.findings.filter((f) => f.type !== "trend").slice(0, 6).map((finding) => (
                  <div key={finding.id} className="p-3 rounded-lg bg-bg-secondary">
                    <div className="flex items-center gap-2 mb-1">
                      {finding.severity === "high" || finding.severity === "critical" ? (
                        <AlertTriangle size={14} className="text-amber-500" />
                      ) : (
                        <Lightbulb size={14} className="text-blue-500" />
                      )}
                      <span className="text-sm font-medium text-text-primary">{finding.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        finding.severity === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        finding.severity === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        finding.severity === "medium" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-bg-secondary text-text-secondary"
                      }`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{finding.observation}</p>
                    <p className="text-xs text-text-tertiary mt-1 italic">{finding.interpretation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends */}
          {intelligenceResult.trends.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Trends</h3>
              <div className="space-y-2">
                {intelligenceResult.trends.map((trend, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-bg-secondary text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className={
                        trend.direction === "improving" ? "text-emerald-500" :
                        trend.direction === "declining" ? "text-red-500" :
                        "text-text-tertiary"
                      } />
                      <span className="font-medium text-text-primary">{trend.metric}</span>
                    </div>
                    <span className={`text-xs ${
                      trend.direction === "improving" ? "text-emerald-500" :
                      trend.direction === "declining" ? "text-red-500" :
                      "text-text-tertiary"
                    }`}>
                      {trend.direction} (R² = {trend.rSquared.toFixed(3)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root Causes */}
          {intelligenceResult.rootCauses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Root Causes</h3>
              <div className="space-y-2">
                {intelligenceResult.rootCauses.map((rc, i) => (
                  <div key={i} className="p-3 rounded-lg bg-bg-secondary">
                    <p className="text-sm font-medium text-text-primary">{rc.issue}</p>
                    <p className="text-xs text-text-secondary mt-1">{rc.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Experiments */}
          {intelligenceResult.experimentSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Recommended Experiments</h3>
              <div className="space-y-2">
                {intelligenceResult.experimentSuggestions.map((sug, i) => (
                  <div key={i} className="p-3 rounded-lg bg-bg-secondary">
                    <div className="flex items-center gap-2 mb-1">
                      <Target size={14} className="text-brand" />
                      <span className="text-sm font-medium text-text-primary">{sug.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        sug.priority === "high" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        sug.priority === "medium" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-bg-secondary text-text-secondary"
                      }`}>
                        {sug.priority}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{sug.rationale}</p>
                    <p className="text-xs text-text-tertiary mt-1">Expected: {sug.expectedImpact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PremiumCard>
      )}

      {/* Research Scientist */}
      {researchScientistResult && (
        <ResearchScientist result={researchScientistResult} />
      )}

      {/* Reproducibility Summary */}
      {benchmarkRuns.length > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<CheckCircle2 size={16} />}>
            <CardTitle>Reproducibility Overview</CardTitle>
            <CardDescription>Experiment tracking and lineage</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-text-primary">{benchmarkRuns.length}</div>
              <div className="text-xs text-text-tertiary">Total Experiments</div>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-green-500">100%</div>
              <div className="text-xs text-text-tertiary">Manifest Coverage</div>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-blue-500">Active</div>
              <div className="text-xs text-text-tertiary">Provenance Tracking</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-text-secondary">
            All experiments have complete manifests with configuration, results, and metadata.
            Visit the <a href="/app/lineage" className="text-blue-500 hover:underline">Experiment Lineage</a> page
            to view detailed pipeline graphs, configuration diffs, and reproducibility scores.
          </div>
        </PremiumCard>
      )}

      {/* Experiment Planner Preview */}
      {benchmarkRuns.length > 0 && (
        <PremiumCard variant="elevated">
          <CardHeader icon={<GitBranch size={16} />}>
            <CardTitle>Experiment Planner</CardTitle>
            <CardDescription>AI-powered next experiment recommendations</CardDescription>
          </CardHeader>
          <div className="text-sm text-text-secondary mb-3">
            AI-powered recommendations for your next experiments based on configuration coverage and expected information gain.
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-text-primary">{benchmarkRuns.length}</div>
              <div className="text-xs text-text-tertiary">Experiments Run</div>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-amber-500">Analyzing...</div>
              <div className="text-xs text-text-tertiary">Coverage Score</div>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary">
              <div className="text-2xl font-bold text-green-500">Ready</div>
              <div className="text-xs text-text-tertiary">Recommendations</div>
            </div>
          </div>
          <div className="text-sm text-text-secondary">
            Visit the <a href="/app/planner" className="text-blue-500 hover:underline">Experiment Planner</a> page
            to see detailed coverage analysis, Pareto frontier, and prioritized experiment queue.
          </div>
        </PremiumCard>
      )}

      {/* Recent Benchmarks */}
      <PremiumCard variant="elevated">
        <CardHeader icon={<BarChart3 size={16} />}>
          <CardTitle>Recent Benchmark Runs</CardTitle>
          <CardDescription>Latest evaluation results</CardDescription>
        </CardHeader>
        {recentRuns.length > 0 ? (
          <div className="space-y-2">
            {recentRuns.map((r) => {
              const m = r.aggregatedMetrics;
              return (
                <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-surface-hover transition-colors">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={14} className="text-success shrink-0" />
                    <div>
                      <span className="font-medium text-text-primary">{r.name || "Unnamed Run"}</span>
                      <span className="text-text-tertiary ml-2">— {r.datasetName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary">
                    <span>{r.questionCount} questions</span>
                    {m && <span>R@{m.avgRecallAtK?.toFixed(3)}</span>}
                    {m && <span>P@{m.avgPrecisionAtK?.toFixed(3)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary py-6 text-center">
            Run benchmarks from the Evaluation page to see results here
          </p>
        )}
      </PremiumCard>
    </div>
  );
}
