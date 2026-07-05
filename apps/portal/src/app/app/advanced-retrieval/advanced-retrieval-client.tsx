"use client";

import { useMemo, useState } from "react";
import {
  GitBranch, Play, FlaskConical, Search,
  Brain, BarChart3, BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { RETRIEVAL_STRATEGIES } from "@/lib/retrieval/types";
import { executeRetrieval } from "@/lib/actions/retrieval-lab";
import { BarChart, MetricCard } from "@/lib/evaluation/visualization/charts";
import type { RetrievalConfig, RetrievalResultDisplay } from "@/lib/retrieval/types";

interface KB {
  id: string; name: string; retrievalConfig: unknown;
}

interface BenchmarkRun {
  id: string; name: string | null; status: string; aggregatedMetrics: unknown; createdAt: Date;
  dataset: { name: string }; _count: { results: number };
}

interface ExperimentRun {
  id: string; totalLatency: number | null; chunkCount: number | null;
  embeddingModel: string | null; retrievalMode: string | null;
  configSnapshot: unknown; createdAt: Date;
}

interface Props {
  kbs: KB[];
  benchmarkRuns: BenchmarkRun[];
  experimentRuns: ExperimentRun[];
}

export function AdvancedRetrievalDashboard({ kbs, benchmarkRuns, experimentRuns }: Props) {
  const [selectedKb, setSelectedKb] = useState(kbs[0]?.id || "");
  const [strategy, setStrategy] = useState<string>("hybrid");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievalResultDisplay | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!selectedKb || !query.trim()) return;
    setLoading(true);
    try {
      const config: RetrievalConfig = {
        chunkStrategy: "recursive",
        chunkSize: 1000,
        chunkOverlap: 200,
        topK: 10,
        similarityThreshold: 0.5,
        embeddingModel: "text-embedding-3-small",
        retrievalMode: strategy as RetrievalConfig["retrievalMode"],
        embeddingProvider: "openai",
        retrievalStrategy: strategy as RetrievalConfig["retrievalStrategy"],
        enableQueryExpansion: true,
        enableMultiQuery: false,
        enableReranking: false,
        enableCompression: true,
        vectorWeight: 1.0,
        keywordWeight: 1.0,
        rrfK: 60,
        maxContextTokens: 4000,
      };
      const result = await executeRetrieval(selectedKb, query.trim(), config, true);
      setResults(result);
    } catch (err) {
      console.error("Advanced retrieval execution failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const strategies = RETRIEVAL_STRATEGIES;
  const completedRuns = benchmarkRuns.filter((r) => r.status === "completed");

  const stats = useMemo(() => {
    const latencies = experimentRuns.map((r) => r.totalLatency).filter((v): v is number => v !== null);
    return {
      totalBenchmarks: completedRuns.length,
      totalExperiments: experimentRuns.length,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      kbCount: kbs.length,
    };
  }, [completedRuns, experimentRuns, kbs]);

  const benchmarkChartData = completedRuns.slice(0, 10).map((r) => {
    const m = r.aggregatedMetrics as Record<string, number> | null;
    return { label: r.name || r.dataset.name, value: m?.avgRecallAtK ?? 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Advanced Retrieval</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Compare retrieval strategies and analyze performance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Knowledge Bases" value={String(stats.kbCount)} footer="Available for retrieval" />
        <MetricCard label="Completed Benchmarks" value={String(stats.totalBenchmarks)} footer="Benchmark runs" />
        <MetricCard label="Experiment Runs" value={String(stats.totalExperiments)} footer="Retrieval experiments" />
        <MetricCard label="Avg Retrieval Latency" value={`${stats.avgLatency.toFixed(1)}ms`} higherIsBetter={false} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="!p-4 lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Play size={16} />
            Test Retrieval Strategy
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Knowledge Base</label>
            <select
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              {kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              {strategies.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              {strategies.find((s) => s.value === strategy)?.description}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Query</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a test query..."
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm resize-none"
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading || !query.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50 text-sm font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              <>
                <Play size={14} />
                Run Retrieval
              </>
            )}
          </button>
        </Card>

        <Card className="!p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Search size={16} />
            Results
          </div>
          {results ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>{results.totalChunks} chunks</span>
                <span>{results.latencyMs.toFixed(1)}ms</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {results.chunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-brand">#{chunk.rank}</span>
                      <span className="text-xs text-text-secondary">{Math.round(chunk.similarity * 100)}%</span>
                      <span className="text-xs text-text-secondary truncate">{chunk.documentName}</span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-3">{chunk.content}</p>
                  </div>
                ))}
              </div>
              {results.debug?.traceSteps && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs font-medium mb-2">Retrieval Pipeline Trace</div>
                  <div className="space-y-1">
                    {results.debug.traceSteps.map((step, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">{step.description}</span>
                        <span className="font-mono">{step.durationMs.toFixed(1)}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
              <FlaskConical size={32} className="mb-2" />
              <p className="text-sm">Run a retrieval to see results</p>
            </div>
          )}
        </Card>
      </div>

      {completedRuns.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-4">
            <BarChart3 size={16} />
            Benchmark Performance by Strategy
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="text-xs text-text-secondary mb-2">Recall@K (Top 10 benchmark runs)</div>
              <BarChart data={benchmarkChartData} height={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-text-secondary mb-1">Avg Recall@K</div>
                <div className="text-lg font-semibold font-mono">
                  {completedRuns.length > 0
                    ? (completedRuns.reduce((s, r) => {
                        const m = r.aggregatedMetrics as Record<string, number> | null;
                        return s + (m?.avgRecallAtK ?? 0);
                      }, 0) / completedRuns.length).toFixed(3)
                    : "N/A"}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-text-secondary mb-1">Avg MRR</div>
                <div className="text-lg font-semibold font-mono">
                  {completedRuns.length > 0
                    ? (completedRuns.reduce((s, r) => {
                        const m = r.aggregatedMetrics as Record<string, number> | null;
                        return s + (m?.avgMRR ?? 0);
                      }, 0) / completedRuns.length).toFixed(3)
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="!p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <BookOpen size={16} />
            Available Strategies
          </div>
          <div className="space-y-2">
            {strategies.map((s) => (
              <div key={s.value} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-hover">
                <GitBranch size={14} className="mt-0.5 text-text-secondary" />
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-text-secondary">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Brain size={16} />
            Retrieval Techniques
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">1</span>
              </div>
              <div>
                <p className="font-medium">Vector Search</p>
                <p className="text-xs text-text-secondary">Embedding-based semantic similarity search</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">2</span>
              </div>
              <div>
                <p className="font-medium">BM25 Keyword Search</p>
                <p className="text-xs text-text-secondary">Term-frequency based lexical search</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">3</span>
              </div>
              <div>
                <p className="font-medium">RRF Fusion</p>
                <p className="text-xs text-text-secondary">Reciprocal Rank Fusion combines multiple rankings</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">4</span>
              </div>
              <div>
                <p className="font-medium">Query Expansion</p>
                <p className="text-xs text-text-secondary">LLM generates alternative query phrasings</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">5</span>
              </div>
              <div>
                <p className="font-medium">Multi-Query</p>
                <p className="text-xs text-text-secondary">Multiple semantic variations searched independently</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">6</span>
              </div>
              <div>
                <p className="font-medium">Cross-Encoder Reranking</p>
                <p className="text-xs text-text-secondary">LLM-based relevance scoring reranks top results</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand">7</span>
              </div>
              <div>
                <p className="font-medium">Context Compression</p>
                <p className="text-xs text-text-secondary">Dedup, merge, and trim redundant context</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
