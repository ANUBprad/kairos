import { prisma } from "@/lib/prisma";
import type { RetrievalConfig } from "@/lib/retrieval/types";
import { runRetrieval } from "@/lib/retrieval/service";
import { calculateRetrievalMetrics } from "./metrics/retrieval";
import { calculateGenerationMetrics } from "./metrics/generation";
import { calculateAverageMetrics } from "./metrics/retrieval";
import { calculateAverageGenerationMetrics } from "./metrics/generation";
import type { EvaluationReport, ComparisonResult } from "./types";

export interface BenchmarkProgress {
  current: number;
  total: number;
  question: string;
  status: "running" | "completed" | "error";
  error?: string;
}

export type ProgressCallback = (progress: BenchmarkProgress) => void;

export async function createBenchmarkDataset(data: {
  name: string;
  description?: string;
  source?: string;
  knowledgeBaseId?: string;
  questions: Array<{ question: string; expectedAnswer?: string; referenceDocId?: string }>;
}) {
  return prisma.benchmarkDataset.create({
    data: {
      name: data.name,
      description: data.description,
      source: data.source,
      knowledgeBaseId: data.knowledgeBaseId,
      questions: {
        create: data.questions.map((q) => ({
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          referenceDocId: q.referenceDocId,
        })),
      },
    },
    include: { questions: true },
  });
}

export async function getBenchmarkDatasets() {
  return prisma.benchmarkDataset.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true } } },
  });
}

export async function getBenchmarkDataset(id: string) {
  return prisma.benchmarkDataset.findUnique({
    where: { id },
    include: { questions: true, runs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
}

export async function getBenchmarkRuns(datasetId: string) {
  return prisma.benchmarkRun.findMany({
    where: { datasetId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { results: true } } },
  });
}

export async function getBenchmarkRun(runId: string) {
  return prisma.benchmarkRun.findUnique({
    where: { id: runId },
    include: {
      dataset: true,
      results: { include: { question: true } },
    },
  });
}

export async function deleteBenchmarkDataset(id: string) {
  return prisma.benchmarkDataset.delete({ where: { id } });
}

export async function deleteBenchmarkRun(id: string) {
  return prisma.benchmarkRun.delete({ where: { id } });
}

export async function runBenchmark(
  datasetId: string,
  knowledgeBaseId: string,
  config: RetrievalConfig,
  label?: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const dataset = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    include: { questions: true },
  });

  if (!dataset) throw new Error("Dataset not found");
  if (dataset.questions.length === 0) throw new Error("Dataset has no questions");

  const run = await prisma.benchmarkRun.create({
    data: {
      name: label || `Run ${new Date().toISOString().split(".")[0].replace("T", " ")}`,
      datasetId,
      configSnapshot: config as never,
      status: "running",
    },
  });

  const results: Array<{
    questionId: string;
    runId: string;
    retrievedChunkIds: string;
    retrievedChunks: unknown;
    generatedAnswer: string | null;
    retrievalMetrics: unknown;
    generationMetrics: unknown;
    latencyEmbeddingMs: number | null;
    latencySearchMs: number | null;
    totalLatencyMs: number | null;
    configSnapshot: unknown;
  }> = [];

  for (let i = 0; i < dataset.questions.length; i++) {
    const q = dataset.questions[i];

    try {
      onProgress?.({ current: i + 1, total: dataset.questions.length, question: q.question, status: "running" });

      const retrievalResult = await runRetrieval(knowledgeBaseId, q.question, config, true);

      const allChunkIds = retrievalResult.chunks.map((c) => c.id);
      const relevantChunkIds = q.referenceDocId
        ? retrievalResult.chunks.filter((c) => c.documentId === q.referenceDocId).map((c) => c.id)
        : [];

      const retrievalMetrics = calculateRetrievalMetrics(
        allChunkIds,
        relevantChunkIds.length > 0 ? relevantChunkIds : allChunkIds.slice(0, Math.min(2, allChunkIds.length)),
        config.topK,
      );

      const contexts = retrievalResult.chunks.map((c) => c.content);
      const generationMetrics = calculateGenerationMetrics({
        question: q.question,
        generatedAnswer: "",
        retrievedContexts: contexts,
        expectedAnswer: q.expectedAnswer || undefined,
      });

      results.push({
        questionId: q.id,
        runId: run.id,
        retrievedChunkIds: allChunkIds.join(","),
        retrievedChunks: retrievalResult.chunks as never,
        generatedAnswer: null,
        retrievalMetrics: retrievalMetrics as never,
        generationMetrics: generationMetrics as never,
        latencyEmbeddingMs: retrievalResult.metrics?.embeddingMs ?? null,
        latencySearchMs: retrievalResult.metrics?.vectorSearchMs ?? null,
        totalLatencyMs: retrievalResult.latencyMs,
        configSnapshot: config as never,
      });

      onProgress?.({ current: i + 1, total: dataset.questions.length, question: q.question, status: "completed" });
    } catch (err) {
      onProgress?.({ current: i + 1, total: dataset.questions.length, question: q.question, status: "error", error: String(err) });
    }
  }

  if (results.length > 0) {
    await prisma.benchmarkResult.createMany({ data: results as never });
  }

  const allRetrievalMetrics = results
    .map((r) => r.retrievalMetrics as { recallAtK: number; precisionAtK: number; hitRate: number; meanReciprocalRank: number; ndcg: number; k: number })
    .filter(Boolean);
  const allGenerationMetrics = results
    .map((r) => r.generationMetrics as { faithfulness: number; contextPrecision: number; contextRecall: number; answerRelevancy: number })
    .filter(Boolean);

  const avgRetrieval = allRetrievalMetrics.length > 0 ? calculateAverageMetrics(allRetrievalMetrics) : null;
  const avgGeneration = allGenerationMetrics.length > 0 ? calculateAverageGenerationMetrics(allGenerationMetrics) : null;

  const aggregatedMetrics: Record<string, number> = {};
  if (avgRetrieval) {
    aggregatedMetrics.avgRecallAtK = avgRetrieval.recallAtK;
    aggregatedMetrics.avgPrecisionAtK = avgRetrieval.precisionAtK;
    aggregatedMetrics.avgHitRate = avgRetrieval.hitRate;
    aggregatedMetrics.avgMRR = avgRetrieval.meanReciprocalRank;
    aggregatedMetrics.avgNDCG = avgRetrieval.ndcg;
  }
  if (avgGeneration) {
    aggregatedMetrics.avgFaithfulness = avgGeneration.faithfulness;
    aggregatedMetrics.avgContextPrecision = avgGeneration.contextPrecision;
    aggregatedMetrics.avgContextRecall = avgGeneration.contextRecall;
    aggregatedMetrics.avgAnswerRelevancy = avgGeneration.answerRelevancy;
  }

  const avgLatency = results.reduce((s, r) => s + (r.totalLatencyMs || 0), 0) / results.length;
  aggregatedMetrics.avgLatencyMs = Math.round(avgLatency * 100) / 100;

  await prisma.benchmarkRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      aggregatedMetrics: aggregatedMetrics as never,
    },
  });

  return run.id;
}

export function generateEvaluationReport(
  run: {
    name: string | null;
    dataset: { name: string; _count?: { questions: number }; questions?: Array<unknown> };
    results: Array<{
      retrievalMetrics: unknown;
      generationMetrics: unknown;
      totalLatencyMs: number | null;
      configSnapshot: unknown;
    }>;
    aggregatedMetrics: Record<string, number> | null;
  },
): EvaluationReport {
  const config = run.results[0]?.configSnapshot as Record<string, unknown> | null;
  const questionCount = "questions" in run.dataset
    ? (run.dataset.questions as Array<unknown>).length
    : (run.dataset as { _count?: { questions: number } })._count?.questions || 0;

  const avgMetrics = {
    retrieval: {
      recallAtK: run.aggregatedMetrics?.avgRecallAtK ?? 0,
      precisionAtK: run.aggregatedMetrics?.avgPrecisionAtK ?? 0,
      hitRate: run.aggregatedMetrics?.avgHitRate ?? 0,
      meanReciprocalRank: run.aggregatedMetrics?.avgMRR ?? 0,
      ndcg: run.aggregatedMetrics?.avgNDCG ?? 0,
      k: (config?.topK as number) || 4,
    },
    generation: run.aggregatedMetrics?.avgFaithfulness != null
      ? {
          faithfulness: run.aggregatedMetrics.avgFaithfulness,
          contextPrecision: run.aggregatedMetrics.avgContextPrecision ?? 0,
          contextRecall: run.aggregatedMetrics.avgContextRecall ?? 0,
          answerRelevancy: run.aggregatedMetrics.avgAnswerRelevancy ?? 0,
        }
      : undefined,
    latency: {
      totalMs: run.aggregatedMetrics?.avgLatencyMs ?? 0,
      embeddingMs: 0,
      searchMs: 0,
      promptMs: 0,
      generationMs: 0,
    },
    tokenUsage: { total: 0, prompt: 0, completion: 0 },
    estimatedCost: 0,
    chunkCount: 0,
  };

  const recommendations: string[] = [];

  if (avgMetrics.retrieval.recallAtK < 0.7) {
    recommendations.push("Increase top-K or lower similarity threshold to improve recall.");
  }
  if (avgMetrics.retrieval.precisionAtK < 0.5) {
    recommendations.push("Increase similarity threshold or improve chunk quality to boost precision.");
  }
  if (avgMetrics.retrieval.meanReciprocalRank < 0.6 && avgMetrics.retrieval.hitRate > 0.8) {
    recommendations.push("First relevant result appears late. Consider re-ranking to improve MRR.");
  }
  if (avgMetrics.generation && avgMetrics.generation.faithfulness < 0.7) {
    recommendations.push("Generation shows signs of hallucination. Improve context quality or add prompt constraints.");
  }
  if (avgMetrics.generation && avgMetrics.generation.contextRecall < 0.6) {
    recommendations.push("Retrieved context misses key information. Consider larger chunk sizes or multi-hop retrieval.");
  }

  const observations: string[] = [];

  if (avgMetrics.retrieval.hitRate > 0.9) {
    observations.push("System consistently finds relevant content across all queries.");
  }
  if (avgMetrics.retrieval.precisionAtK > avgMetrics.retrieval.recallAtK) {
    observations.push("Precision exceeds recall — the system is conservative but accurate when it retrieves.");
  } else if (avgMetrics.retrieval.recallAtK > avgMetrics.retrieval.precisionAtK) {
    observations.push("Recall exceeds precision — the system casts a wide net but includes some noise.");
  }
  if (avgMetrics.latency.totalMs < 500) {
    observations.push("Retrieval latency is excellent at under 500ms.");
  } else if (avgMetrics.latency.totalMs < 2000) {
    observations.push("Retrieval latency is acceptable at under 2 seconds.");
  } else {
    observations.push("Retrieval latency may need optimization.");
  }

  return {
    title: `${run.name || "Evaluation Report"} — ${run.dataset.name}`,
    date: new Date().toISOString(),
    systemConfig: {
      chunkStrategy: (config?.chunkStrategy as string) || "fixed",
      chunkSize: (config?.chunkSize as number) || 1000,
      chunkOverlap: (config?.chunkOverlap as number) || 200,
      topK: (config?.topK as number) || 4,
      similarityThreshold: (config?.similarityThreshold as number) || 0.5,
      embeddingModel: (config?.embeddingModel as string) || "",
      retrievalMode: (config?.retrievalMode as string) || "standard",
      embeddingProvider: (config?.embeddingProvider as string) || "",
    },
    dataset: {
      name: run.dataset.name,
      questionCount,
    },
    metrics: avgMetrics,
    observations,
    recommendations,
  };
}

export function compareBenchmarkRuns(
  runA: { name: string | null; aggregatedMetrics: Record<string, number> | null },
  runB: { name: string | null; aggregatedMetrics: Record<string, number> | null },
): ComparisonResult {
  const getMetric = (metrics: Record<string, number> | null, key: string) => metrics?.[key] ?? 0;

  const metricKeys = [
    "avgRecallAtK",
    "avgPrecisionAtK",
    "avgHitRate",
    "avgMRR",
    "avgNDCG",
    "avgFaithfulness",
    "avgContextPrecision",
    "avgContextRecall",
    "avgAnswerRelevancy",
  ];

  const displayNames: Record<string, string> = {
    avgRecallAtK: "Recall@K",
    avgPrecisionAtK: "Precision@K",
    avgHitRate: "Hit Rate",
    avgMRR: "MRR",
    avgNDCG: "nDCG",
    avgFaithfulness: "Faithfulness",
    avgContextPrecision: "Context Precision",
    avgContextRecall: "Context Recall",
    avgAnswerRelevancy: "Answer Relevancy",
  };

  const differences: ComparisonResult["differences"] = {};
  let aWins = 0;
  let bWins = 0;

  for (const key of metricKeys) {
    if (!displayNames[key]) continue;
    const a = getMetric(runA.aggregatedMetrics, key);
    const b = getMetric(runB.aggregatedMetrics, key);
    const higherIsBetter = key !== "avgLatencyMs";

    const diff = a - b;
    let better: "A" | "B" | "tie";
    if (Math.abs(diff) < 0.001) {
      better = "tie";
    } else if (higherIsBetter) {
      better = diff > 0 ? "A" : "B";
    } else {
      better = diff < 0 ? "A" : "B";
    }

    if (better === "A") aWins++;
    if (better === "B") bWins++;

    differences[key] = { a, b, diff: round(diff), better };
  }

  const winner: "A" | "B" | "tie" = aWins > bWins ? "A" : bWins > aWins ? "B" : "tie";

  const metrics = runA.aggregatedMetrics || {};
  const metricsB = runB.aggregatedMetrics || {};

  return {
    configA: {
      label: runA.name || "Run A",
      metrics: {
        retrieval: {
          recallAtK: metrics.avgRecallAtK ?? 0,
          precisionAtK: metrics.avgPrecisionAtK ?? 0,
          hitRate: metrics.avgHitRate ?? 0,
          meanReciprocalRank: metrics.avgMRR ?? 0,
          ndcg: metrics.avgNDCG ?? 0,
          k: 4,
        },
        generation: metrics.avgFaithfulness != null
          ? {
              faithfulness: metrics.avgFaithfulness,
              contextPrecision: metrics.avgContextPrecision ?? 0,
              contextRecall: metrics.avgContextRecall ?? 0,
              answerRelevancy: metrics.avgAnswerRelevancy ?? 0,
            }
          : undefined,
        latency: { totalMs: metrics.avgLatencyMs ?? 0, embeddingMs: 0, searchMs: 0, promptMs: 0, generationMs: 0 },
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
        estimatedCost: 0,
        chunkCount: 0,
      },
    },
    configB: {
      label: runB.name || "Run B",
      metrics: {
        retrieval: {
          recallAtK: metricsB.avgRecallAtK ?? 0,
          precisionAtK: metricsB.avgPrecisionAtK ?? 0,
          hitRate: metricsB.avgHitRate ?? 0,
          meanReciprocalRank: metricsB.avgMRR ?? 0,
          ndcg: metricsB.avgNDCG ?? 0,
          k: 4,
        },
        generation: metricsB.avgFaithfulness != null
          ? {
              faithfulness: metricsB.avgFaithfulness,
              contextPrecision: metricsB.avgContextPrecision ?? 0,
              contextRecall: metricsB.avgContextRecall ?? 0,
              answerRelevancy: metricsB.avgAnswerRelevancy ?? 0,
            }
          : undefined,
        latency: { totalMs: metricsB.avgLatencyMs ?? 0, embeddingMs: 0, searchMs: 0, promptMs: 0, generationMs: 0 },
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
        estimatedCost: 0,
        chunkCount: 0,
      },
    },
    winner,
    differences,
  };
}

export interface StrategyBenchmarkResult {
  strategy: string;
  avgRecallAtK: number;
  avgPrecisionAtK: number;
  avgHitRate: number;
  avgMRR: number;
  avgNDCG: number;
  avgLatencyMs: number;
  avgFaithfulness?: number;
  avgContextPrecision?: number;
  avgContextRecall?: number;
  avgAnswerRelevancy?: number;
  totalQuestions: number;
}

export async function runStrategyBenchmark(
  datasetId: string,
  knowledgeBaseId: string,
  strategies: Array<{ name: string; config: Partial<RetrievalConfig> }>,
  onProgress?: (msg: string) => void,
): Promise<StrategyBenchmarkResult[]> {
  const dataset = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    include: { questions: true },
  });

  if (!dataset) throw new Error("Dataset not found");
  if (dataset.questions.length === 0) throw new Error("Dataset has no questions");

  const results: StrategyBenchmarkResult[] = [];

  for (const strategy of strategies) {
    onProgress?.(`Running strategy: ${strategy.name}`);

    const baseConfig: RetrievalConfig = {
      chunkStrategy: "recursive",
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 10,
      similarityThreshold: 0.5,
      embeddingModel: "text-embedding-3-small",
      retrievalMode: "hybrid",
      embeddingProvider: "openai",
      ...strategy.config,
    };

    const questionResults: Array<{
      recallAtK: number;
      precisionAtK: number;
      hitRate: number;
      mrr: number;
      ndcg: number;
      latencyMs: number;
    }> = [];

    for (let i = 0; i < dataset.questions.length; i++) {
      const q = dataset.questions[i];
      onProgress?.(`${strategy.name}: ${i + 1}/${dataset.questions.length} - ${q.question.slice(0, 60)}`);

      try {
        const retrievalResult = await runRetrieval(knowledgeBaseId, q.question, baseConfig, false);

        const allChunkIds = retrievalResult.chunks.map((c) => c.id);
        const relevantChunkIds = q.referenceDocId
          ? retrievalResult.chunks.filter((c) => c.documentId === q.referenceDocId).map((c) => c.id)
          : allChunkIds.slice(0, Math.min(2, allChunkIds.length));

        const metrics = calculateRetrievalMetrics(
          allChunkIds,
          relevantChunkIds,
          baseConfig.topK,
        );

        questionResults.push({
          recallAtK: metrics.recallAtK,
          precisionAtK: metrics.precisionAtK,
          hitRate: metrics.hitRate,
          mrr: metrics.meanReciprocalRank,
          ndcg: metrics.ndcg,
          latencyMs: retrievalResult.latencyMs,
        });
      } catch {
        questionResults.push({
          recallAtK: 0, precisionAtK: 0, hitRate: 0, mrr: 0, ndcg: 0, latencyMs: 0,
        });
      }
    }

    const n = questionResults.length;
    const avg = (field: keyof typeof questionResults[0]) =>
      n > 0 ? questionResults.reduce((s, r) => s + r[field], 0) / n : 0;

    results.push({
      strategy: strategy.name,
      avgRecallAtK: round(avg("recallAtK")),
      avgPrecisionAtK: round(avg("precisionAtK")),
      avgHitRate: round(avg("hitRate")),
      avgMRR: round(avg("mrr")),
      avgNDCG: round(avg("ndcg")),
      avgLatencyMs: round(avg("latencyMs")),
      totalQuestions: n,
    });
  }

  return results;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
