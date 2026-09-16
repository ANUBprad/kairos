import { prisma } from "@/lib/prisma";

/**
 * Per-entry rows returned by the Intelligence service when `include_results`
 * is requested. Every key mirrors `EntryResult.to_dict()` (`intelligence/
 * evaluation/entry_result.py`); failed entries carry `status=error` plus
 * `error_type`/`error_message`.
 */
export interface IntelligenceEntryResult {
  entry_id: string;
  query: string;
  query_type: string;
  status: string;
  retrieved_chunks?: string[];
  retrieval_type?: string;
  fallback_triggered?: boolean;
  generated_answer?: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  model?: string;
  cost_usd?: number;
  trace_id?: string;
  recall?: number | null;
  precision?: number | null;
  judge_scores?: Record<string, number>;
  composite_judge_score?: number | null;
  latency_classify?: number;
  latency_retrieval?: number;
  latency_generation?: number;
  latency_total?: number;
  error_type?: string | null;
  error_message?: string | null;
}

export interface IntelligenceOutcome {
  total: number;
  succeeded: number;
  failed: number;
  success_rate: number;
  mean_latency: { classify: number; retrieval: number; generation: number; total: number };
  total_tokens: { prompt_tokens: number; completion_tokens: number };
  total_cost_usd?: number | null;
  mean_recall?: number | null;
  mean_precision?: number | null;
  mean_judge_scores?: Record<string, number>;
  results: IntelligenceEntryResult[];
  trace_id?: string;
}

export interface IntelligenceRunConfig {
  topK?: number;
  generate?: boolean;
  judge?: boolean;
  useLlmJudges?: boolean;
}

const SECONDS_TO_MS = 1000;

function intMs(seconds: number | null | undefined): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return Math.round(seconds * SECONDS_TO_MS);
}

function retrievalMetricsFor(entry: IntelligenceEntryResult): Record<string, number> | null {
  const metrics: Record<string, number> = {};
  if (typeof entry.recall === "number" && Number.isFinite(entry.recall)) metrics.recallAtK = entry.recall;
  if (typeof entry.precision === "number" && Number.isFinite(entry.precision)) metrics.precisionAtK = entry.precision;
  return Object.keys(metrics).length > 0 ? metrics : null;
}

function generationMetricsFor(entry: IntelligenceEntryResult): Record<string, number> | null {
  const scores = entry.judge_scores ?? {};
  const metrics: Record<string, number> = {};
  for (const [dimension, score] of Object.entries(scores)) {
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    const key = dimension === "llm_answer_relevancy" ? "answerRelevancy" : dimension;
    metrics[key] = score;
  }
  if (typeof entry.composite_judge_score === "number" && Number.isFinite(entry.composite_judge_score)) {
    metrics.compositeJudgeScore = entry.composite_judge_score;
  }
  return Object.keys(metrics).length > 0 ? metrics : null;
}

function aggregateMetricsFor(outcome: IntelligenceOutcome): Record<string, unknown> {
  const agg: Record<string, unknown> = {};
  if (typeof outcome.mean_recall === "number" && Number.isFinite(outcome.mean_recall)) agg.avgRecallAtK = outcome.mean_recall;
  if (typeof outcome.mean_precision === "number" && Number.isFinite(outcome.mean_precision)) agg.avgPrecisionAtK = outcome.mean_precision;
  if (outcome.mean_judge_scores) {
    for (const [dimension, score] of Object.entries(outcome.mean_judge_scores)) {
      if (typeof score !== "number" || !Number.isFinite(score)) continue;
      const key = dimension === "llm_answer_relevancy" ? "avgAnswerRelevancy" : `avg${dimension[0].toUpperCase()}${dimension.slice(1)}`;
      agg[key] = score;
    }
  }
  const latencyMs = intMs(outcome.mean_latency.total);
  if (latencyMs !== null) agg.avgLatencyMs = latencyMs;
  if (typeof outcome.success_rate === "number" && Number.isFinite(outcome.success_rate)) agg.successRate = outcome.success_rate;
  agg.total = outcome.total;
  agg.succeeded = outcome.succeeded;
  agg.failed = outcome.failed;
  const hasAnyTokens =
    outcome.total_tokens != null &&
    typeof outcome.total_tokens.prompt_tokens === "number" &&
    typeof outcome.total_tokens.completion_tokens === "number";
  if (hasAnyTokens) agg.totalTokens = outcome.total_tokens;
  if (typeof outcome.total_cost_usd === "number" && Number.isFinite(outcome.total_cost_usd)) {
    agg.totalCostUsd = outcome.total_cost_usd;
  }
  return agg;
}

async function syncQuestions(
  datasetId: string,
  entries: IntelligenceEntryResult[],
): Promise<Map<string, string>> {
  const texts = [...new Set(entries.map((e) => e.query).filter((t) => t.length > 0))];
  if (texts.length === 0) return new Map();

  const existing = await prisma.benchmarkQuestion.findMany({
    where: { datasetId, question: { in: texts } },
    select: { id: true, question: true },
  });
  const byText = new Map(existing.map((q) => [q.question, q.id]));

  const missing = texts.filter((t) => !byText.has(t));
  if (missing.length > 0) {
    await prisma.benchmarkQuestion.createMany({
      data: missing.map((t) => ({ question: t, datasetId, metadata: { intelligenceSource: true } })),
    });
    const created = await prisma.benchmarkQuestion.findMany({
      where: { datasetId, question: { in: missing } },
      select: { id: true, question: true },
    });
    for (const q of created) byText.set(q.question, q.id);
  }
  return byText;
}

export async function createIntelligenceRun(input: {
  datasetName: string;
  knowledgeBaseId: string;
  userId: string;
  label?: string;
  config: IntelligenceRunConfig;
}): Promise<{ runId: string; datasetId: string }> {
  let dataset = await prisma.benchmarkDataset.findFirst({
    where: { name: input.datasetName, knowledgeBaseId: input.knowledgeBaseId },
    select: { id: true },
  });
  if (!dataset) {
    dataset = await prisma.benchmarkDataset.create({
      data: {
        name: input.datasetName,
        description: "Intelligence evaluation dataset",
        source: "intelligence",
        knowledgeBaseId: input.knowledgeBaseId,
      },
      select: { id: true },
    });
  }

  const run = await prisma.benchmarkRun.create({
    data: {
      name: input.label || `Intelligence run ${new Date().toISOString().split(".")[0].replace("T", " ")}`,
      datasetId: dataset.id,
      createdById: input.userId,
      configSnapshot: {
        engine: "intelligence",
        datasetName: input.datasetName,
        topK: input.config.topK ?? null,
        generate: input.config.generate ?? true,
        judge: input.config.judge ?? true,
        useLlmJudges: input.config.useLlmJudges ?? false,
      } as never,
      status: "running",
    },
  });

  return { runId: run.id, datasetId: dataset.id };
}

export async function completeIntelligenceRun(runId: string, outcome: IntelligenceOutcome): Promise<void> {
  const run = await prisma.benchmarkRun.findUnique({
    where: { id: runId },
    select: { status: true, datasetId: true, configSnapshot: true },
  });
  if (!run || run.status !== "running") return;

  const questionIds = await syncQuestions(run.datasetId, outcome.results);
  const persisted: Array<Record<string, unknown>> = [];
  for (const entry of outcome.results) {
    const questionId = questionIds.get(entry.query);
    if (!questionId) continue;
    const failed = entry.status !== "ok";
    persisted.push({
      questionId,
      runId,
      retrievedChunkIds: entry.retrieved_chunks?.length ? entry.retrieved_chunks.join(",") : null,
      retrievedChunks: entry.retrieved_chunks?.length ? entry.retrieved_chunks : null,
      generatedAnswer: entry.generated_answer ?? null,
      retrievalMetrics: retrievalMetricsFor(entry),
      generationMetrics: generationMetricsFor(entry),
      error: failed
        ? { status: entry.status, errorType: entry.error_type ?? null, errorMessage: entry.error_message ?? null }
        : null,
      latencySearchMs: intMs(entry.latency_retrieval),
      latencyGenerationMs: intMs(entry.latency_generation),
      totalLatencyMs: intMs(entry.latency_total),
      configSnapshot: {
        engine: "intelligence",
        queryType: entry.query_type,
        retrievalType: entry.retrieval_type ?? "",
        fallbackTriggered: entry.fallback_triggered ?? false,
        model: entry.model ?? "",
        traceId: entry.trace_id ?? "",
      },
    });
  }
  if (persisted.length > 0) {
    await prisma.benchmarkResult.createMany({ data: persisted as never });
  }

  const evaluated = outcome.total > 0;
  const allFailed = evaluated && outcome.succeeded === 0;
  if (!evaluated || persisted.length === 0 || allFailed) {
    await prisma.benchmarkRun.update({
      where: { id: runId },
      data: { status: "failed", completedAt: new Date() },
    });
    return;
  }

  const configSnapshot = {
    ...((run.configSnapshot as Record<string, unknown>) ?? {}),
    ...(outcome.trace_id ? { traceId: outcome.trace_id } : {}),
  };
  await prisma.benchmarkRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      configSnapshot: configSnapshot as never,
      aggregatedMetrics: aggregateMetricsFor(outcome) as never,
    },
  });
}

export async function failIntelligenceRun(runId: string): Promise<void> {
  const run = await prisma.benchmarkRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  // A finalized run (completed or already failed) is never flipped back.
  if (!run || run.status !== "running") return;
  await prisma.benchmarkRun.update({
    where: { id: runId },
    data: { status: "failed", completedAt: new Date() },
  });
}