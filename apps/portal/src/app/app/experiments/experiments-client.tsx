"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  GitCompare,
  Database,
  BarChart3,
  AlertTriangle,
  Zap,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExperimentList } from "@/components/app/experiment-studio/experiment-list";
import { ExperimentComparisonView } from "@/components/app/experiment-studio/experiment-comparison";
import { DatasetBuilder } from "@/components/app/experiment-studio/dataset-builder";
import { EvaluationCenter } from "@/components/app/experiment-studio/evaluation-center";
import { FailureAnalysis } from "@/components/app/experiment-studio/failure-analysis";
import { BenchmarkCenter } from "@/components/app/experiment-studio/benchmark-center";
import { InsightsEngine } from "@/components/app/experiment-studio/insights-engine";
import type { Experiment, EvaluationDataset, ExperimentComparison, BenchmarkStrategy } from "@/components/app/experiment-studio/types";
import { METRIC_CONFIG } from "@/components/app/experiment-studio/types";

interface Props {
  initialExperiments: Experiment[];
  initialDatasets: EvaluationDataset[];
}

const DEMO_EXPERIMENTS: Experiment[] = [
  {
    id: "exp-1",
    name: "Hybrid Retrieval + GPT-4o",
    description: "Baseline experiment with hybrid retrieval and GPT-4o generation",
    status: "completed",
    datasetId: "ds-1",
    datasetName: "Product FAQ",
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Product Docs",
    embeddingModel: "text-embedding-3-small",
    retriever: "Hybrid",
    reranker: "Cross Encoder",
    llm: "GPT-4o",
    promptTemplate: "default",
    chunkStrategy: "fixed",
    chunkSize: 512,
    chunkOverlap: 50,
    topK: 10,
    similarityThreshold: 0.7,
    retrievalMode: "hybrid",
    tags: ["baseline", "production"],
    isFavorite: true,
    isArchived: false,
    createdAt: "2026-07-20T10:00:00Z",
    startedAt: "2026-07-20T10:00:05Z",
    completedAt: "2026-07-20T10:02:30Z",
    runtimeMs: 150000,
    cost: 0.042,
    owner: "admin",
    metrics: {
      recallAtK: 0.87,
      precisionAtK: 0.72,
      mrr: 0.81,
      ndcg: 0.84,
      faithfulness: 0.91,
      answerRelevancy: 0.88,
      contextPrecision: 0.79,
      contextRecall: 0.85,
      groundedness: 0.89,
      hallucinationRate: 0.08,
      citationAccuracy: 0.82,
      retrievalSuccessRate: 0.92,
      latencyMs: 2300,
      embeddingCost: 0.008,
      generationCost: 0.034,
      totalCost: 0.042,
      tokenUsage: { embeddingTokens: 1200, promptTokens: 3200, completionTokens: 800, totalTokens: 5200 },
    },
    timeline: [
      { id: "t1", type: "created", label: "Created", description: "Experiment initialized", timestamp: "2026-07-20T10:00:00Z" },
      { id: "t2", type: "started", label: "Started", description: "Execution began", timestamp: "2026-07-20T10:00:05Z", durationMs: 200 },
      { id: "t3", type: "embedding", label: "Embedding", description: "Query embedding generated", timestamp: "2026-07-20T10:00:06Z", durationMs: 180 },
      { id: "t4", type: "retrieval", label: "Retrieval", description: "Hybrid search completed (10 chunks)", timestamp: "2026-07-20T10:00:07Z", durationMs: 850 },
      { id: "t5", type: "generation", label: "Generation", description: "LLM response generated", timestamp: "2026-07-20T10:00:08Z", durationMs: 1200 },
      { id: "t6", type: "evaluation", label: "Evaluation", description: "Metrics computed", timestamp: "2026-07-20T10:00:10Z", durationMs: 300 },
      { id: "t7", type: "completed", label: "Completed", description: "All 50 questions evaluated", timestamp: "2026-07-20T10:02:30Z" },
    ],
  },
  {
    id: "exp-2",
    name: "Vector Only + Claude",
    description: "Dense retrieval with Claude 3.5 Sonnet",
    status: "completed",
    datasetId: "ds-1",
    datasetName: "Product FAQ",
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Product Docs",
    embeddingModel: "text-embedding-3-large",
    retriever: "Vector",
    reranker: "None",
    llm: "Claude 3.5 Sonnet",
    promptTemplate: "default",
    chunkStrategy: "fixed",
    chunkSize: 1024,
    chunkOverlap: 100,
    topK: 5,
    similarityThreshold: 0.65,
    retrievalMode: "vector",
    tags: ["comparison"],
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-07-21T14:00:00Z",
    startedAt: "2026-07-21T14:00:05Z",
    completedAt: "2026-07-21T14:03:00Z",
    runtimeMs: 175000,
    cost: 0.058,
    owner: "admin",
    metrics: {
      recallAtK: 0.78,
      precisionAtK: 0.81,
      mrr: 0.75,
      ndcg: 0.79,
      faithfulness: 0.94,
      answerRelevancy: 0.91,
      contextPrecision: 0.85,
      contextRecall: 0.78,
      groundedness: 0.92,
      hallucinationRate: 0.05,
      citationAccuracy: 0.88,
      retrievalSuccessRate: 0.85,
      latencyMs: 3100,
      embeddingCost: 0.012,
      generationCost: 0.046,
      totalCost: 0.058,
      tokenUsage: { embeddingTokens: 1800, promptTokens: 2800, completionTokens: 900, totalTokens: 5500 },
    },
    timeline: [
      { id: "t1", type: "created", label: "Created", description: "Experiment initialized", timestamp: "2026-07-21T14:00:00Z" },
      { id: "t2", type: "started", label: "Started", description: "Execution began", timestamp: "2026-07-21T14:00:05Z", durationMs: 150 },
      { id: "t3", type: "embedding", label: "Embedding", description: "Query embedding generated", timestamp: "2026-07-21T14:00:06Z", durationMs: 220 },
      { id: "t4", type: "retrieval", label: "Retrieval", description: "Vector search completed (5 chunks)", timestamp: "2026-07-21T14:00:07Z", durationMs: 620 },
      { id: "t5", type: "generation", label: "Generation", description: "LLM response generated", timestamp: "2026-07-21T14:00:08Z", durationMs: 1800 },
      { id: "t6", type: "evaluation", label: "Evaluation", description: "Metrics computed", timestamp: "2026-07-21T14:00:10Z", durationMs: 280 },
      { id: "t7", type: "completed", label: "Completed", description: "All 50 questions evaluated", timestamp: "2026-07-21T14:03:00Z" },
    ],
  },
  {
    id: "exp-3",
    name: "BM25 Baseline",
    description: "Keyword-only retrieval for comparison",
    status: "completed",
    datasetId: "ds-1",
    datasetName: "Product FAQ",
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Product Docs",
    embeddingModel: "N/A",
    retriever: "BM25",
    reranker: "None",
    llm: "GPT-4o",
    promptTemplate: "default",
    chunkStrategy: "fixed",
    chunkSize: 512,
    chunkOverlap: 50,
    topK: 10,
    similarityThreshold: 0.5,
    retrievalMode: "keyword",
    tags: ["baseline", "keyword"],
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-07-19T08:00:00Z",
    startedAt: "2026-07-19T08:00:05Z",
    completedAt: "2026-07-19T08:01:45Z",
    runtimeMs: 100000,
    cost: 0.035,
    owner: "admin",
    metrics: {
      recallAtK: 0.65,
      precisionAtK: 0.58,
      mrr: 0.61,
      ndcg: 0.63,
      faithfulness: 0.82,
      answerRelevancy: 0.78,
      contextPrecision: 0.62,
      contextRecall: 0.68,
      groundedness: 0.80,
      hallucinationRate: 0.15,
      citationAccuracy: 0.71,
      retrievalSuccessRate: 0.72,
      latencyMs: 800,
      embeddingCost: 0,
      generationCost: 0.035,
      totalCost: 0.035,
      tokenUsage: { embeddingTokens: 0, promptTokens: 2600, completionTokens: 700, totalTokens: 3300 },
    },
    timeline: [
      { id: "t1", type: "created", label: "Created", description: "Experiment initialized", timestamp: "2026-07-19T08:00:00Z" },
      { id: "t2", type: "started", label: "Started", description: "Execution began", timestamp: "2026-07-19T08:00:05Z", durationMs: 100 },
      { id: "t3", type: "retrieval", label: "Retrieval", description: "BM25 search completed (10 chunks)", timestamp: "2026-07-19T08:00:06Z", durationMs: 400 },
      { id: "t4", type: "generation", label: "Generation", description: "LLM response generated", timestamp: "2026-07-19T08:00:07Z", durationMs: 900 },
      { id: "t5", type: "completed", label: "Completed", description: "All 50 questions evaluated", timestamp: "2026-07-19T08:01:45Z" },
    ],
  },
  {
    id: "exp-4",
    name: "Multi-Query + Reranking",
    description: "Multi-query expansion with cross-encoder reranking",
    status: "running",
    datasetId: "ds-1",
    datasetName: "Product FAQ",
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Product Docs",
    embeddingModel: "text-embedding-3-small",
    retriever: "Hybrid",
    reranker: "Cross Encoder",
    llm: "GPT-4o",
    promptTemplate: "default",
    chunkStrategy: "semantic",
    chunkSize: 768,
    chunkOverlap: 80,
    topK: 15,
    similarityThreshold: 0.6,
    retrievalMode: "hybrid",
    tags: ["experimental", "multi-query"],
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-07-22T09:00:00Z",
    startedAt: "2026-07-22T09:00:10Z",
    owner: "admin",
    runtimeMs: 45000,
    timeline: [
      { id: "t1", type: "created", label: "Created", description: "Experiment initialized", timestamp: "2026-07-22T09:00:00Z" },
      { id: "t2", type: "started", label: "Started", description: "Execution began", timestamp: "2026-07-22T09:00:10Z", durationMs: 150 },
      { id: "t3", type: "embedding", label: "Embedding", description: "Generating multiple query variations", timestamp: "2026-07-22T09:00:11Z", durationMs: 450 },
    ],
  },
  {
    id: "exp-5",
    name: "Chunk Size A/B Test",
    description: "Comparing 256 vs 1024 token chunks",
    status: "draft",
    datasetId: "ds-1",
    datasetName: "Product FAQ",
    knowledgeBaseId: "kb-1",
    knowledgeBaseName: "Product Docs",
    embeddingModel: "text-embedding-3-small",
    retriever: "Vector",
    reranker: "None",
    llm: "GPT-4o-mini",
    promptTemplate: "default",
    chunkStrategy: "fixed",
    chunkSize: 256,
    chunkOverlap: 25,
    topK: 8,
    similarityThreshold: 0.7,
    retrievalMode: "vector",
    tags: ["ab-test", "chunking"],
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-07-22T11:00:00Z",
    owner: "admin",
  },
];

const DEMO_STRATEGIES: BenchmarkStrategy[] = [
  { id: "bm25", name: "BM25", description: "Keyword-based retrieval", speed: 0.95, quality: 0.55, memory: 0.3, cost: 0, metrics: { recallAtK: 0.65, precisionAtK: 0.58, mrr: 0.61, ndcg: 0.63, faithfulness: 0.82, answerRelevancy: 0.78, contextPrecision: 0.62, contextRecall: 0.68, groundedness: 0.80, hallucinationRate: 0.15, citationAccuracy: 0.71, retrievalSuccessRate: 0.72, latencyMs: 800, embeddingCost: 0, generationCost: 0.035, totalCost: 0.035, tokenUsage: { embeddingTokens: 0, promptTokens: 2600, completionTokens: 700, totalTokens: 3300 } } },
  { id: "dense", name: "Dense (Vector)", description: "Semantic embedding search", speed: 0.8, quality: 0.75, memory: 0.6, cost: 0.01, metrics: { recallAtK: 0.78, precisionAtK: 0.81, mrr: 0.75, ndcg: 0.79, faithfulness: 0.94, answerRelevancy: 0.91, contextPrecision: 0.85, contextRecall: 0.78, groundedness: 0.92, hallucinationRate: 0.05, citationAccuracy: 0.88, retrievalSuccessRate: 0.85, latencyMs: 1200, embeddingCost: 0.012, generationCost: 0.046, totalCost: 0.058, tokenUsage: { embeddingTokens: 1800, promptTokens: 2800, completionTokens: 900, totalTokens: 5500 } } },
  { id: "hybrid", name: "Hybrid", description: "Combined keyword + semantic", speed: 0.7, quality: 0.85, memory: 0.7, cost: 0.012, metrics: { recallAtK: 0.87, precisionAtK: 0.72, mrr: 0.81, ndcg: 0.84, faithfulness: 0.91, answerRelevancy: 0.88, contextPrecision: 0.79, contextRecall: 0.85, groundedness: 0.89, hallucinationRate: 0.08, citationAccuracy: 0.82, retrievalSuccessRate: 0.92, latencyMs: 1500, embeddingCost: 0.008, generationCost: 0.034, totalCost: 0.042, tokenUsage: { embeddingTokens: 1200, promptTokens: 3200, completionTokens: 800, totalTokens: 5200 } } },
  { id: "hybrid-rerank", name: "Hybrid + Rerank", description: "Hybrid with cross-encoder reranking", speed: 0.5, quality: 0.92, memory: 0.8, cost: 0.018, metrics: { recallAtK: 0.91, precisionAtK: 0.84, mrr: 0.88, ndcg: 0.90, faithfulness: 0.93, answerRelevancy: 0.90, contextPrecision: 0.88, contextRecall: 0.90, groundedness: 0.91, hallucinationRate: 0.06, citationAccuracy: 0.86, retrievalSuccessRate: 0.95, latencyMs: 2800, embeddingCost: 0.008, generationCost: 0.034, totalCost: 0.042, tokenUsage: { embeddingTokens: 1200, promptTokens: 3200, completionTokens: 800, totalTokens: 5200 } } },
];

type TabKey = "experiments" | "compare" | "datasets" | "evaluation" | "failures" | "benchmarks" | "insights";

const TABS: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: "experiments", label: "Experiments", icon: Brain },
  { key: "compare", label: "Compare", icon: GitCompare },
  { key: "datasets", label: "Datasets", icon: Database },
  { key: "evaluation", label: "Evaluation", icon: BarChart3 },
  { key: "failures", label: "Failures", icon: AlertTriangle },
  { key: "benchmarks", label: "Benchmarks", icon: Zap },
  { key: "insights", label: "Insights", icon: Sparkles },
];

export function ExperimentsClient({ initialExperiments, initialDatasets }: Props) {
  const experiments = initialExperiments.length > 0 ? initialExperiments : DEMO_EXPERIMENTS;
  const datasets = initialDatasets.length > 0 ? initialDatasets : [];

  const [activeTab, setActiveTab] = useState<TabKey>("experiments");
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [, setComparisonId] = useState<string | null>(null);

  const selectedExperiment = useMemo(
    () => experiments.find((e) => e.id === selectedExperimentId) ?? null,
    [experiments, selectedExperimentId]
  );

  const completedExperiments = useMemo(
    () => experiments.filter((e) => e.status === "completed" && e.metrics),
    [experiments]
  );

  const demoComparison: ExperimentComparison | null = useMemo(() => {
    if (completedExperiments.length < 2) return null;
    const a = completedExperiments[0];
    const b = completedExperiments[1];
    const metricKeys = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy", "contextPrecision", "contextRecall", "groundedness", "hallucinationRate", "citationAccuracy", "latencyMs", "totalCost", "totalTokens", "embeddingCost", "generationCost", "tokenUsage"] as const;
    const metrics = {} as ExperimentComparison["metrics"];
    for (const key of metricKeys) {
      if (key === "tokenUsage") continue;
      const valA = key === "totalTokens" ? a.metrics!.tokenUsage.totalTokens : (a.metrics as Record<string, number>)[key];
      const valB = key === "totalTokens" ? b.metrics!.tokenUsage.totalTokens : (b.metrics as Record<string, number>)[key];
      const delta = valA - valB;
      const pct = valB !== 0 ? delta / Math.abs(valB) : 0;
      const higherIsBetter = METRIC_CONFIG[key as keyof typeof METRIC_CONFIG]?.higherIsBetter ?? true;
      const winner = higherIsBetter ? (valA > valB ? "a" : valA < valB ? "b" : "tie") : (valA < valB ? "a" : valA > valB ? "b" : "tie");
      (metrics as Record<string, unknown>)[key] = { a: valA, b: valB, delta, percentChange: pct, winner };
    }
    return {
      id: "cmp-1",
      experimentAId: a.id,
      experimentBId: b.id,
      experimentA: a,
      experimentB: b,
      metrics: metrics as ExperimentComparison["metrics"],
      createdAt: new Date().toISOString(),
    };
  }, [completedExperiments]);

  const demoResults = useMemo(() => {
    if (completedExperiments.length === 0) return [];
    return Array.from({ length: 20 }, (_, i) => ({
      questionId: `q-${i}`,
      question: `Question ${i + 1}: What is the return policy?`,
      expectedAnswer: "You can return items within 30 days.",
      generatedAnswer: i % 4 === 0 ? "The return policy allows returns within 30 days of purchase." : i % 7 === 0 ? "Items can be exchanged." : "You can return items within 30 days of purchase for a full refund.",
      retrievedChunks: [`chunk-${i}`, `chunk-${i + 1}`],
      relevantChunks: i % 3 === 0 ? [`chunk-${i}`] : [`chunk-${i}`, `chunk-${i + 1}`, `chunk-${i + 2}`],
      metrics: {
        recallAtK: i % 5 === 0 ? 0.4 : 0.85,
        precisionAtK: 0.7,
        mrr: i % 6 === 0 ? 0.5 : 0.9,
        ndcg: 0.8,
        faithfulness: i % 4 === 0 ? 0.3 : 0.92,
        answerRelevancy: 0.85,
      },
      latencyMs: 1500 + Math.random() * 2000,
      tokenUsage: { embeddingTokens: 100, promptTokens: 2000, completionTokens: 500, totalTokens: 2600 },
    }));
  }, [completedExperiments]);

  const handleSelectExperiment = useCallback((id: string) => {
    setSelectedExperimentId(id);
    setActiveTab("evaluation");
  }, []);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== "evaluation") setSelectedExperimentId(null);
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col">
      <div className="border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Brain size={20} className="text-brand" />
              Experiment Studio
            </h1>
            <p className="text-xs text-text-secondary">AI-Powered RAG Experimentation & Evaluation</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">{experiments.length} experiments</Badge>
            <Badge variant="success" className="text-[10px]">{completedExperiments.length} completed</Badge>
          </div>
        </div>
        <nav className="flex items-center gap-1 mt-3 -mb-px overflow-x-auto" role="tablist" aria-label="Experiment Studio sections">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap",
                activeTab === key
                  ? "bg-surface text-brand border border-border border-b-surface"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              )}
              role="tab"
              aria-selected={activeTab === key}
              aria-controls={`panel-${key}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6" role="tabpanel" id={`panel-${activeTab}`}>
        {activeTab === "experiments" && (
          <ExperimentList
            experiments={experiments}
            onSelect={handleSelectExperiment}
            onCompare={(ids) => { setComparisonId(ids[0]); setActiveTab("compare"); }}
          />
        )}

        {activeTab === "compare" && (
          demoComparison ? (
            <ExperimentComparisonView comparison={demoComparison} />
          ) : (
            <div className="py-16 text-center">
              <GitCompare size={40} className="mx-auto text-text-tertiary mb-3" />
              <p className="text-sm text-text-secondary">Need at least 2 completed experiments to compare</p>
            </div>
          )
        )}

        {activeTab === "datasets" && (
          <DatasetBuilder datasets={datasets} />
        )}

        {activeTab === "evaluation" && selectedExperiment?.metrics ? (
          <EvaluationCenter
            currentMetrics={selectedExperiment.metrics}
            baselineMetrics={completedExperiments.length > 0 ? completedExperiments[0].metrics : undefined}
          />
        ) : activeTab === "evaluation" ? (
          <div className="space-y-6">
            <ExperimentList experiments={completedExperiments} onSelect={handleSelectExperiment} />
            {completedExperiments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Default Evaluation</h3>
                <EvaluationCenter
                  currentMetrics={completedExperiments[0].metrics!}
                  baselineMetrics={completedExperiments.length > 1 ? completedExperiments[1].metrics : undefined}
                />
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "failures" && (
          demoResults.length > 0 ? (
            <FailureAnalysis results={demoResults} />
          ) : (
            <div className="py-16 text-center">
              <AlertTriangle size={40} className="mx-auto text-text-tertiary mb-3" />
              <p className="text-sm text-text-secondary">No experiment results to analyze</p>
            </div>
          )
        )}

        {activeTab === "benchmarks" && (
          <BenchmarkCenter strategies={DEMO_STRATEGIES} />
        )}

        {activeTab === "insights" && (
          <InsightsEngine experiments={experiments} />
        )}
      </div>
    </div>
  );
}
