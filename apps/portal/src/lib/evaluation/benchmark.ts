import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { round } from "@/lib/utils";
import type { RetrievalConfig } from "@/lib/retrieval/types";
import { runRetrieval } from "@/lib/retrieval/service";
import { getAIProvider } from "@/lib/ai/providers";
import { calculateRetrievalMetrics } from "./metrics/retrieval";
import { calculateGenerationMetrics } from "./metrics/generation";
import { calculateAverageMetrics } from "./metrics/retrieval";
import { calculateAverageGenerationMetrics } from "./metrics/generation";
import { assertDatasetAccess } from "./access";
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
  questions: Array<{
    question: string;
    expectedAnswer?: string;
    expectedContext?: string;
    referenceDocId?: string;
    metadata?: unknown;
  }>;
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
          expectedContext: q.expectedContext,
          referenceDocId: q.referenceDocId,
          metadata: q.metadata as never,
        })),
      },
    },
    include: { questions: true },
  });
}

// Deterministic canonical serialization: object keys are sorted, so two
// objects with the same members in different key order hash identically.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

// Sha256 over the evaluation-relevant question content (no ids, no timestamps):
// identical question sets always hash identically, so snapshot versions from
// unchanged content deduplicate to the same row instead of stacking duplicates.
export function datasetContentHash(
  questions: Array<{
    question: string;
    expectedAnswer?: string | null;
    expectedContext?: string | null;
    referenceDocId?: string | null;
    metadata?: unknown;
  }>,
): string {
  const canonical = questions
    .map((q) =>
      stableStringify([
        q.question,
        q.expectedAnswer ?? null,
        q.expectedContext ?? null,
        q.referenceDocId ?? null,
        q.metadata ?? null,
      ]),
    )
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export interface BenchmarkDatasetVersionInput {
  name?: string;
  description?: string;
  source?: string;
  tags?: string[];
}

type VersionableQuestions = Array<{
  id: string;
  question: string;
  expectedAnswer: string | null;
  expectedContext: string | null;
  referenceDocId: string | null;
  metadata: unknown;
}>;

// Copies the parent dataset into an immutable snapshot row with a fresh
// version number. The unique (parentVersionId, version) constraint resets the
// race: on a duplicate-version collision (two concurrent creates) we recompute
// and retry once — a lazy senior's idempotence without a lock.
async function createVersionRow(
  parent: {
    id: string;
    name: string;
    version: number;
    description: string | null;
    source: string | null;
    tags: string[];
    knowledgeBaseId: string | null;
    questions: VersionableQuestions;
  },
  hash: string,
  input?: BenchmarkDatasetVersionInput,
  attempt = 1,
) {
  const { _max } = await prisma.benchmarkDataset.aggregate({
    where: { OR: [{ id: parent.id }, { parentVersionId: parent.id }] },
    _max: { version: true },
  });
  const nextVersion = Math.max(parent.version, _max?.version ?? 0) + 1;

  try {
    return await prisma.benchmarkDataset.create({
      data: {
        name: input?.name?.trim() ? input.name.trim() : `${parent.name} v${nextVersion}`,
        description: input?.description ?? parent.description,
        source: parent.source,
        tags: input?.tags ?? parent.tags,
        version: nextVersion,
        contentHash: hash,
        parentVersionId: parent.id,
        knowledgeBaseId: parent.knowledgeBaseId,
        questions: {
          create: parent.questions.map((q) => ({
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            expectedContext: q.expectedContext,
            referenceDocId: q.referenceDocId,
            metadata: q.metadata as never,
          })),
        },
      },
      include: { questions: true },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002" && attempt < 3) {
      return createVersionRow(parent, hash, input, attempt + 1);
    }
    throw err;
  }
}

export async function createBenchmarkDatasetVersion(
  datasetId: string,
  input?: BenchmarkDatasetVersionInput,
) {
  const parent = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    include: { questions: true },
  });
  if (!parent) throw new Error("Dataset not found");
  if (parent.parentVersionId) {
    throw new Error("Published dataset versions are immutable; create a new version from the root dataset only");
  }

  const hash = datasetContentHash(parent.questions);

  const existing = await prisma.benchmarkDataset.findFirst({
    where: { parentVersionId: datasetId, contentHash: hash },
    include: { questions: true },
  });
  if (existing) return existing;

  return createVersionRow(parent, hash, input);
}

export interface PublishSnapshotInput {
  name: string;
  description?: string | null;
  tags?: string[];
  source: string;
  knowledgeBaseId?: string;
  questions: Array<{
    question: string;
    expectedAnswer?: string | null;
    expectedContext?: string | null;
    referenceDocId?: string | null;
    metadata?: unknown;
  }>;
}

// Bridges curated external datasets (e.g. a golden dataset) into the benchmark
// platform. The first publish creates a root dataset keyed by `source`;
// re-publishing identical content deduplicates to the same row, and changed
// content lands in a fresh immutable child version under the same root, so
// runs from every publish stay comparable (regression tracking fans out to the
// whole version family).
export async function publishDatasetSnapshot(
  input: PublishSnapshotInput,
): Promise<{ id: string; name: string; version: number; questions: VersionableQuestions }> {
  const hash = datasetContentHash(input.questions);

  const root = await prisma.benchmarkDataset.findFirst({ where: { source: input.source } });
  if (!root) {
    return prisma.benchmarkDataset.create({
      data: {
        name: input.name,
        description: input.description,
        source: input.source,
        tags: input.tags ?? [],
        contentHash: hash,
        knowledgeBaseId: input.knowledgeBaseId,
        questions: { create: snapshotQuestions(input.questions) },
      },
      include: { questions: true },
    });
  }

  const existing = await prisma.benchmarkDataset.findFirst({
    where: { OR: [{ id: root.id }, { parentVersionId: root.id }], contentHash: hash },
    include: { questions: true },
  });
  if (existing) return existing;

  return createSnapshotVersion(root, hash, input);
}

function snapshotQuestions(
  questions: PublishSnapshotInput["questions"],
): Array<{
  question: string;
  expectedAnswer: string | null;
  expectedContext: string | null;
  referenceDocId: string | null;
  metadata: never;
}> {
  return questions.map((q) => ({
    question: q.question,
    expectedAnswer: q.expectedAnswer ?? null,
    expectedContext: q.expectedContext ?? null,
    referenceDocId: q.referenceDocId ?? null,
    metadata: q.metadata as never,
  }));
}

// Immutable child snapshot for changed published content. Mirrors
// createVersionRow: (parentVersionId, version) is unique, so a P2002
// collision (concurrent publishes) recomputes the next version and retries.
async function createSnapshotVersion(
  root: {
    id: string;
    name: string;
    version: number;
    description: string | null;
    source: string | null;
    tags: string[];
    knowledgeBaseId: string | null;
  },
  hash: string,
  input: PublishSnapshotInput,
  attempt = 1,
) {
  const { _max } = await prisma.benchmarkDataset.aggregate({
    where: { OR: [{ id: root.id }, { parentVersionId: root.id }] },
    _max: { version: true },
  });
  const nextVersion = Math.max(root.version, _max?.version ?? 0) + 1;

  try {
    return await prisma.benchmarkDataset.create({
      data: {
        name: `${root.name} v${nextVersion}`,
        description: input.description ?? root.description,
        source: root.source,
        tags: input.tags ?? root.tags,
        version: nextVersion,
        contentHash: hash,
        parentVersionId: root.id,
        knowledgeBaseId: input.knowledgeBaseId ?? root.knowledgeBaseId,
        questions: { create: snapshotQuestions(input.questions) },
      },
      include: { questions: true },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002" && attempt < 3) {
      return createSnapshotVersion(root, hash, input, attempt + 1);
    }
    throw err;
  }
}

export async function listBenchmarkDatasetVersions(datasetId: string) {
  const row = await prisma.benchmarkDataset.findUnique({ where: { id: datasetId } });
  if (!row) throw new Error("Dataset not found");
  const rootId = row.parentVersionId ?? row.id;
  const versions = await prisma.benchmarkDataset.findMany({
    where: { parentVersionId: rootId },
    orderBy: { version: "asc" },
    include: { _count: { select: { questions: true, runs: true } } },
  });
  return { rootId, versions };
}

export async function getBenchmarkDatasets(userId?: string) {
  return prisma.benchmarkDataset.findMany({
    ...(userId
      ? {
          where: {
            OR: [
              { knowledgeBaseId: null },
              { knowledgeBase: { project: { organization: { members: { some: { userId } } } } } },
            ],
          },
        }
      : {}),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true } } },
  });
}

export async function getBenchmarkDataset(id: string) {
  const detail = await prisma.benchmarkDataset.findUnique({
    where: { id },
    include: { questions: true },
  });
  if (!detail) return null;

  // Child-version runs are not reachable through the root row's `runs`
  // relation (it is anchored to datasetId = root.id), so collect family
  // runs with a top-level filter instead.
  const runs = await prisma.benchmarkRun.findMany({
    where: { OR: [{ datasetId: id }, { dataset: { parentVersionId: id } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { ...detail, runs };
}

export async function getBenchmarkRuns(datasetId: string, userId?: string) {
  if (userId) {
    await assertDatasetAccess(datasetId, userId);
  }
  return prisma.benchmarkRun.findMany({
    where: {
      OR: [
        { datasetId },
        { dataset: { parentVersionId: datasetId } },
      ],
    },
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
  const dataset = await prisma.benchmarkDataset.findUnique({ where: { id } });
  if (!dataset) throw new Error("Dataset not found");
  if (dataset.parentVersionId) {
    throw new Error("Published dataset versions are immutable and cannot be deleted; delete the root dataset to remove the version chain");
  }
  await prisma.benchmarkDataset.deleteMany({ where: { parentVersionId: id } });
  return prisma.benchmarkDataset.delete({ where: { id } });
}

export async function deleteBenchmarkRun(id: string) {
  return prisma.benchmarkRun.delete({ where: { id } });
}

export interface RunTarget {
  id: string;
  name: string;
  questions: VersionableQuestions;
}

// Evaluation always runs against what is published, never against the mutable
// root as currently edited. A root resolves to the snapshot whose content
// matches it today; when the content drifted (or no snapshot exists yet) a
// fresh immutable version is created so the persisted run pins exactly the
// questions that were evaluated. Non-persisting experiments resolve without
// creating rows and fall back to the latest snapshot, then the root.
export async function resolveRunDataset(
  datasetId: string,
  opts: { createIfMissing: boolean },
): Promise<RunTarget> {
  const parent = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    include: { questions: true },
  });
  if (!parent) throw new Error("Dataset not found");
  if (parent.parentVersionId) {
    return { id: parent.id, name: parent.name, questions: parent.questions };
  }

  const hash = datasetContentHash(parent.questions);

  const matching = await prisma.benchmarkDataset.findFirst({
    where: { parentVersionId: parent.id, contentHash: hash },
  });
  if (matching) {
    const questions = await prisma.benchmarkQuestion.findMany({ where: { datasetId: matching.id } });
    return { id: matching.id, name: matching.name, questions };
  }

  if (opts.createIfMissing) {
    const created = await createBenchmarkDatasetVersion(parent.id);
    return { id: created.id, name: created.name, questions: created.questions };
  }

  const latest = await prisma.benchmarkDataset.findFirst({
    where: { parentVersionId: parent.id },
    orderBy: { version: "desc" },
  });
  if (latest) {
    const questions = await prisma.benchmarkQuestion.findMany({ where: { datasetId: latest.id } });
    return { id: latest.id, name: latest.name, questions };
  }

  return { id: parent.id, name: parent.name, questions: parent.questions };
}

export async function runBenchmark(
  datasetId: string,
  knowledgeBaseId: string,
  config: RetrievalConfig,
  label?: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const target = await resolveRunDataset(datasetId, { createIfMissing: true });
  if (target.questions.length === 0) throw new Error("Dataset has no questions");

  const run = await prisma.benchmarkRun.create({
    data: {
      name: label || `Run ${new Date().toISOString().split(".")[0].replace("T", " ")}`,
      datasetId: target.id,
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

  let promptTokensTotal = 0;
  let completionTokensTotal = 0;
  let usageComplete = true;

  for (let i = 0; i < target.questions.length; i++) {
    const q = target.questions[i];

    try {
      onProgress?.({ current: i + 1, total: target.questions.length, question: q.question, status: "running" });

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

      let generatedAnswer = "";
      try {
        const provider = getAIProvider((config.embeddingProvider as "openai" | "gemini") || "openai");
        const contextStr = contexts.map((c, i) => `[Source ${i + 1}] ${c}`).join("\n\n");
        const genResponse = await provider.generateChat({
          model: (config as unknown as Record<string, unknown>).chatModel as string || provider.getDefaultModel(),
          messages: [
            {
              role: "system",
              content: `Answer the user's question based ONLY on the provided context. Cite sources using [Source N] format.\n\n## Context\n${contextStr || "No context available."}`,
            },
            { role: "user", content: q.question },
          ],
          temperature: 0.1,
          maxTokens: 1024,
        });
        generatedAnswer = genResponse.content;
        if (genResponse.usage) {
          promptTokensTotal += genResponse.usage.promptTokens ?? 0;
          completionTokensTotal += genResponse.usage.completionTokens ?? 0;
        } else {
          usageComplete = false;
        }
      } catch {
        generatedAnswer = "";
        usageComplete = false;
      }

      const generationMetrics = calculateGenerationMetrics({
        question: q.question,
        generatedAnswer,
        retrievedContexts: contexts,
        expectedAnswer: q.expectedAnswer || undefined,
      });

      results.push({
        questionId: q.id,
        runId: run.id,
        retrievedChunkIds: allChunkIds.join(","),
        retrievedChunks: retrievalResult.chunks as never,
        generatedAnswer,
        retrievalMetrics: retrievalMetrics as never,
        generationMetrics: generationMetrics as never,
        latencyEmbeddingMs: retrievalResult.metrics?.embeddingMs ?? null,
        latencySearchMs: retrievalResult.metrics?.vectorSearchMs ?? null,
        totalLatencyMs: retrievalResult.latencyMs,
        configSnapshot: config as never,
      });

      onProgress?.({ current: i + 1, total: target.questions.length, question: q.question, status: "completed" });
    } catch (err) {
      usageComplete = false;
      onProgress?.({ current: i + 1, total: target.questions.length, question: q.question, status: "error", error: String(err) });
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

  if (results.length > 0) {
    const avgLatency = results.reduce((s, r) => s + (r.totalLatencyMs || 0), 0) / results.length;
    aggregatedMetrics.avgLatencyMs = Math.round(avgLatency * 100) / 100;
  }

  const allQuestionsHadUsage = usageComplete && results.length === target.questions.length;
  if (allQuestionsHadUsage) {
    (aggregatedMetrics as Record<string, unknown>).totalTokens = {
      prompt_tokens: promptTokensTotal,
      completion_tokens: completionTokensTotal,
    };
  }

  await prisma.benchmarkRun.update({
    where: { id: run.id },
    data: {
      status: results.length === 0 ? "failed" : "completed",
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

  const agg = run.aggregatedMetrics as Record<string, unknown> | null;
  const tokens = agg?.totalTokens as
    | { prompt_tokens: unknown; completion_tokens: unknown }
    | null
    | undefined;
  const tokenUsage =
    tokens &&
    typeof tokens.prompt_tokens === "number" &&
    typeof tokens.completion_tokens === "number"
      ? {
          total: tokens.prompt_tokens + tokens.completion_tokens,
          prompt: tokens.prompt_tokens,
          completion: tokens.completion_tokens,
        }
      : null;
  const rawCost = agg?.totalCostUsd;
  const estimatedCost = typeof rawCost === "number" && Number.isFinite(rawCost) ? rawCost : null;

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
    tokenUsage,
    estimatedCost,
    chunkCount: null,
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
        tokenUsage: null,
        estimatedCost: null,
        chunkCount: null,
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
        tokenUsage: null,
        estimatedCost: null,
        chunkCount: null,
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
  const target = await resolveRunDataset(datasetId, { createIfMissing: false });
  if (target.questions.length === 0) throw new Error("Dataset has no questions");

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

    for (let i = 0; i < target.questions.length; i++) {
      const q = target.questions[i];
      onProgress?.(`${strategy.name}: ${i + 1}/${target.questions.length} - ${q.question.slice(0, 60)}`);

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
