"use client";

import {
  Database, FileText, Scissors, TableProperties,
  FlaskConical, BarChart3, Clock, TrendingUp,
  CheckCircle2, BookOpen, ArrowRight, Search,
  ScrollText, Bot, Cpu,
} from "lucide-react";
import { MetricCard, BarChart } from "@/lib/evaluation/visualization/charts";

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
}

const PIPELINE_STAGES = [
  { id: "documents", label: "Documents", icon: FileText, color: "bg-blue-500" },
  { id: "chunks", label: "Chunks", icon: Scissors, color: "bg-teal-500" },
  { id: "embeddings", label: "Embeddings", icon: TableProperties, color: "bg-emerald-500" },
  { id: "retrieval", label: "Retrieval", icon: Search, color: "bg-yellow-500" },
  { id: "prompt", label: "Prompt", icon: ScrollText, color: "bg-orange-500" },
  { id: "llm", label: "LLM", icon: Bot, color: "bg-purple-500" },
  { id: "evaluation", label: "Evaluation", icon: BarChart3, color: "bg-violet-500" },
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Research Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adaptive Retrieval-Augmented Generation Research Platform
        </p>
      </div>

      {/* Current Configuration */}
      <div className="rounded-xl border bg-card p-5 mb-8">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
          <Cpu size={16} />
          Current Configuration
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Knowledge Base</span>
            <p className="text-sm font-medium truncate">{currentKbName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{currentKbDocs} documents</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Retrieval Strategy</span>
            <p className="text-sm font-medium capitalize">{retrievalStrategy}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Embedding Model</span>
            <p className="text-sm font-medium">{embeddingModel}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Chunking Strategy</span>
            <p className="text-sm font-medium capitalize">{chunkingStrategy}</p>
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="rounded-xl border bg-card p-5 mb-8">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
          <Cpu size={16} />
          Pipeline
        </div>
        <div className="flex items-center justify-center flex-wrap gap-1 sm:gap-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${stage.color}`}>
                  <stage.icon size={16} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight size={14} className="text-muted-foreground/30 mx-0.5 sm:mx-1 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KB Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard label="Knowledge Bases" value={String(knowledgeBases)} icon={Database} />
        <MetricCard label="Documents" value={String(totalDocuments)} icon={FileText} />
        <MetricCard label="Chunks" value={String(totalChunks)} icon={Scissors} />
        <MetricCard label="Embeddings" value={String(totalEmbeddings)} icon={TableProperties} />
        <MetricCard label="Experiments" value={String(totalExperiments)} icon={FlaskConical} />
        <MetricCard label="Experiment Runs" value={String(totalExperimentRuns)} icon={BarChart3} />
        <MetricCard label="Avg Recall@K" value={avgRecall.toFixed(4)} icon={TrendingUp} higherIsBetter />
        <MetricCard label="Datasets" value={String(datasets.length)} icon={BookOpen} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Latest Evaluation */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <CheckCircle2 size={16} className="text-emerald-500" />
            Last Benchmark
          </div>
          {latestEval ? (
            <div className="space-y-3">
              <div>
                <p className="font-semibold">{latestEval.name || "Unnamed Evaluation"}</p>
                <p className="text-xs text-muted-foreground">{new Date(latestEval.date).toLocaleString()}</p>
              </div>
              {latestEval.metrics && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(latestEval.metrics)
                    .filter(([k]) => k.startsWith("avg") && k !== "avgLatencyMs")
                    .slice(0, 6)
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{key.replace("avg", "")}</span>
                        <span className="font-mono font-medium">{(val as number).toFixed(4)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No evaluations yet</p>
          )}
        </div>

        {/* Latest Report */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <BookOpen size={16} />
            Latest Report
          </div>
          {latestReport ? (
            <div className="space-y-3">
              <div>
                <p className="font-semibold">{latestReport.name || "Unnamed Report"}</p>
                <p className="text-xs text-muted-foreground">{new Date(latestReport.date).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(latestReport.metrics)
                  .filter(([k]) => k.startsWith("avg") && k !== "avgLatencyMs")
                  .slice(0, 6)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{key.replace("avg", "")}</span>
                      <span className="font-mono font-medium">{(val as number).toFixed(4)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No reports generated yet</p>
          )}
        </div>
      </div>

      {/* Leaderboard Preview */}
      {lbData.length > 0 && (
        <div className="rounded-lg border bg-card p-5 mb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <TrendingUp size={16} />
            Top Benchmark Runs (Composite Score)
          </div>
          <BarChart data={lbData} height={200} />
        </div>
      )}

      {/* Recall Timeline */}
      {timelineData.length > 1 && (
        <div className="rounded-lg border bg-card p-5 mb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
            <Clock size={16} />
            Recall@K Over Time
          </div>
          <div className="flex items-end gap-2 h-32">
            {timelineData.map((d, i) => {
              const maxVal = Math.max(...timelineData.map((x) => x.value), 0.01);
              const h = (d.value / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary opacity-70 hover:opacity-100 transition-opacity"
                    style={{ height: `${Math.max(h, 1)}%` }}
                    title={`${d.label}: ${d.value.toFixed(4)}`}
                  />
                  <span className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Benchmarks */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
          <BarChart3 size={16} />
          Recent Benchmark Runs
        </div>
        {recentRuns.length > 0 ? (
          <div className="space-y-2">
            {recentRuns.map((r) => {
              const m = r.aggregatedMetrics;
              return (
                <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-medium">{r.name || "Unnamed Run"}</span>
                      <span className="text-muted-foreground ml-2">— {r.datasetName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{r.questionCount} questions</span>
                    {m && <span>R@{m.avgRecallAtK?.toFixed(3)}</span>}
                    {m && <span>P@{m.avgPrecisionAtK?.toFixed(3)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Run benchmarks from the Evaluation page to see results here
          </p>
        )}
      </div>
    </div>
  );
}
