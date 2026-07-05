import { prisma } from "@/lib/prisma";
import type { RetrievalConfig } from "@/lib/retrieval/types";
import { runRetrieval } from "@/lib/retrieval/service";
import { calculateRetrievalMetrics } from "./metrics/retrieval";
import { calculateDescriptiveStats, type DescriptiveStats } from "./statistics";

export interface CampaignConfig {
  knowledgeBaseId: string;
  datasetId: string;
  strategies: Array<{
    name: string;
    config: Partial<RetrievalConfig>;
  }>;
  embeddingModels: string[];
  chunkStrategies: string[];
  topKs: number[];
}

export interface CampaignProgress {
  phase: "initializing" | "running" | "analyzing" | "complete";
  current: number;
  total: number;
  message: string;
}

export type CampaignCallback = (progress: CampaignProgress) => void;

export interface CampaignResult {
  id: string;
  name: string;
  createdAt: string;
  strategyResults: Array<{
    strategyLabel: string;
    retrievalConfig: Partial<RetrievalConfig>;
    metrics: Record<string, number>;
    perQuestionStats: Record<string, DescriptiveStats>;
  }>;
  summary: {
    totalExperiments: number;
    bestStrategy: string;
    bestRecall: number;
    avgLatencyMs: number;
  };
}

export async function runBenchmarkCampaign(
  config: CampaignConfig,
  campaignName: string,
  onProgress?: CampaignCallback,
): Promise<CampaignResult> {
  onProgress?.({ phase: "initializing", current: 0, total: 0, message: "Loading dataset..." });

  const dataset = await prisma.benchmarkDataset.findUnique({
    where: { id: config.datasetId },
    include: { questions: true },
  });

  if (!dataset || dataset.questions.length === 0) {
    throw new Error("Dataset not found or empty");
  }

  const experiments: Array<{
    strategyLabel: string;
    retrievalConfig: Partial<RetrievalConfig>;
  }> = [];

  for (const strategy of config.strategies) {
    for (const model of config.embeddingModels) {
      for (const chunkStrategy of config.chunkStrategies) {
        for (const topK of config.topKs) {
          experiments.push({
            strategyLabel: `${strategy.name} / ${model} / ${chunkStrategy} / top${topK}`,
            retrievalConfig: {
              ...strategy.config,
              embeddingModel: model,
              chunkStrategy: chunkStrategy as never,
              topK,
            },
          });
        }
      }
    }
  }

  const totalExperiments = experiments.length;
  onProgress?.({ phase: "running", current: 0, total: totalExperiments, message: `Running ${totalExperiments} experiments...` });

  const strategyResults: CampaignResult["strategyResults"] = [];

  for (let expIdx = 0; expIdx < experiments.length; expIdx++) {
    const exp = experiments[expIdx];
    const baseConfig: RetrievalConfig = {
      chunkStrategy: "recursive",
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 10,
      similarityThreshold: 0.5,
      embeddingModel: "text-embedding-3-small",
      retrievalMode: "hybrid",
      embeddingProvider: "openai",
      ...exp.retrievalConfig,
    };

    const perQuestionRecall: number[] = [];
    const perQuestionPrecision: number[] = [];
    const perQuestionMRR: number[] = [];
    const perQuestionNDCG: number[] = [];
    const perQuestionHitRate: number[] = [];
    const perQuestionLatency: number[] = [];

    for (let qi = 0; qi < dataset.questions.length; qi++) {
      const q = dataset.questions[qi];
      onProgress?.({
        phase: "running",
        current: expIdx * dataset.questions.length + qi + 1,
        total: totalExperiments * dataset.questions.length,
        message: `${exp.strategyLabel}: Q${qi + 1}/${dataset.questions.length}`,
      });

      try {
        const retrievalResult = await runRetrieval(config.knowledgeBaseId, q.question, baseConfig, false);
        const allChunkIds = retrievalResult.chunks.map((c) => c.id);
        const relevantChunkIds = q.referenceDocId
          ? retrievalResult.chunks.filter((c) => c.documentId === q.referenceDocId).map((c) => c.id)
          : allChunkIds.slice(0, Math.min(2, allChunkIds.length));

        const metrics = calculateRetrievalMetrics(allChunkIds, relevantChunkIds, baseConfig.topK);
        perQuestionRecall.push(metrics.recallAtK);
        perQuestionPrecision.push(metrics.precisionAtK);
        perQuestionMRR.push(metrics.meanReciprocalRank);
        perQuestionNDCG.push(metrics.ndcg);
        perQuestionHitRate.push(metrics.hitRate);
        perQuestionLatency.push(retrievalResult.latencyMs);
      } catch {
        perQuestionRecall.push(0);
        perQuestionPrecision.push(0);
        perQuestionMRR.push(0);
        perQuestionNDCG.push(0);
        perQuestionHitRate.push(0);
        perQuestionLatency.push(0);
      }
    }

    const avgRecall = perQuestionRecall.reduce((s, v) => s + v, 0) / perQuestionRecall.length;
    const avgPrecision = perQuestionPrecision.reduce((s, v) => s + v, 0) / perQuestionPrecision.length;
    const avgMRR = perQuestionMRR.reduce((s, v) => s + v, 0) / perQuestionMRR.length;
    const avgNDCG = perQuestionNDCG.reduce((s, v) => s + v, 0) / perQuestionNDCG.length;
    const avgHitRate = perQuestionHitRate.reduce((s, v) => s + v, 0) / perQuestionHitRate.length;
    const avgLatency = perQuestionLatency.reduce((s, v) => s + v, 0) / perQuestionLatency.length;

    strategyResults.push({
      strategyLabel: exp.strategyLabel,
      retrievalConfig: exp.retrievalConfig,
      metrics: {
        avgRecallAtK: Math.round(avgRecall * 10000) / 10000,
        avgPrecisionAtK: Math.round(avgPrecision * 10000) / 10000,
        avgMRR: Math.round(avgMRR * 10000) / 10000,
        avgNDCG: Math.round(avgNDCG * 10000) / 10000,
        avgHitRate: Math.round(avgHitRate * 10000) / 10000,
        avgLatencyMs: Math.round(avgLatency * 100) / 100,
      },
      perQuestionStats: {
        recallAtK: calculateDescriptiveStats(perQuestionRecall),
        precisionAtK: calculateDescriptiveStats(perQuestionPrecision),
        mrr: calculateDescriptiveStats(perQuestionMRR),
        ndcg: calculateDescriptiveStats(perQuestionNDCG),
        hitRate: calculateDescriptiveStats(perQuestionHitRate),
        latencyMs: calculateDescriptiveStats(perQuestionLatency),
      },
    });
  }

  onProgress?.({ phase: "analyzing", current: 0, total: 0, message: "Generating results..." });

  const sortedByRecall = [...strategyResults].sort((a, b) => b.metrics.avgRecallAtK - a.metrics.avgRecallAtK);
  const best = sortedByRecall[0];
  const avgAllLatency = strategyResults.reduce((s, r) => s + r.metrics.avgLatencyMs, 0) / strategyResults.length;

  const result: CampaignResult = {
    id: `campaign-${Date.now()}`,
    name: campaignName,
    createdAt: new Date().toISOString(),
    strategyResults,
    summary: {
      totalExperiments,
      bestStrategy: best?.strategyLabel || "",
      bestRecall: best?.metrics.avgRecallAtK || 0,
      avgLatencyMs: Math.round(avgAllLatency * 100) / 100,
    },
  };

  onProgress?.({ phase: "complete", current: totalExperiments, total: totalExperiments, message: "Campaign complete!" });

  return result;
}
