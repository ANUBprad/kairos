"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/errors";
import {
  createBenchmarkDataset,
  getBenchmarkDatasets,
  getBenchmarkDataset,
  getBenchmarkRun,
  deleteBenchmarkDataset,
  deleteBenchmarkRun,
  runBenchmark,
  generateEvaluationReport,
  compareBenchmarkRuns,
  runStrategyBenchmark,
} from "@/lib/evaluation/benchmark";
import { runBenchmarkCampaign, type CampaignConfig, type CampaignResult } from "@/lib/evaluation/campaign";
import { generateLeaderboard, type LeaderboardEntry } from "@/lib/evaluation/leaderboard";
import { generateRecommendations, type StrategyConfig, type Recommendation } from "@/lib/evaluation/recommendations";
import type { RetrievalConfig } from "@/lib/retrieval/types";

async function assertKbAccess(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: {
                where: { userId },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
    throw new Error("Knowledge base not found");
  }

  return kb;
}

export async function createDataset(data: {
  name: string;
  description?: string;
  source?: string;
  knowledgeBaseId?: string;
  questions: Array<{ question: string; expectedAnswer?: string; referenceDocId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  try {
    if (data.knowledgeBaseId) {
      await assertKbAccess(data.knowledgeBaseId, session.user.id);
    }

    const dataset = await createBenchmarkDataset(data);
    revalidatePath("/app/evaluation");
    return dataset;
  } catch (error) {
    logError("createDataset", error, { userId: session.user.id, kbId: data.knowledgeBaseId });
    throw error;
  }
}

export async function importJsonDataset(
  formData: FormData,
) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const text = await file.text();
  const json = JSON.parse(text);

  const name = formData.get("name") as string || file.name.replace(/\.[^/.]+$/, "");
  const description = formData.get("description") as string || undefined;
  const source = formData.get("source") as string || undefined;
  const kbId = formData.get("knowledgeBaseId") as string || undefined;

  if (!json.questions || !Array.isArray(json.questions)) {
    throw new Error("JSON must have a 'questions' array");
  }

  if (kbId) {
    await assertKbAccess(kbId, session.user.id);
  }

  const dataset = await createBenchmarkDataset({
    name,
    description,
    source,
    knowledgeBaseId: kbId,
    questions: json.questions.map((q: { question: string; expected_answer?: string; expectedAnswer?: string; reference_doc_id?: string; referenceDocId?: string }) => ({
      question: q.question,
      expectedAnswer: q.expectedAnswer || q.expected_answer,
      referenceDocId: q.referenceDocId || q.reference_doc_id,
    })),
  });

  revalidatePath("/app/evaluation");
  return dataset;
}

export async function listDatasets() {
  const session = await getServerSession();
  if (!session) return [];

  return getBenchmarkDatasets();
}

export async function getDataset(datasetId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  return getBenchmarkDataset(datasetId);
}

export async function getRun(runId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  return getBenchmarkRun(runId);
}

export async function deleteDataset(datasetId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  await deleteBenchmarkDataset(datasetId);
  revalidatePath("/app/evaluation");
}

export async function deleteRun(runId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  await deleteBenchmarkRun(runId);
  revalidatePath("/app/evaluation");
}

export async function startBenchmark(
  datasetId: string,
  knowledgeBaseId: string,
  config: RetrievalConfig,
  label?: string,
) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  try {
    await assertKbAccess(knowledgeBaseId, session.user.id);

    const runId = await runBenchmark(datasetId, knowledgeBaseId, config, label);
    revalidatePath("/app/evaluation");
    return runId;
  } catch (error) {
    logError("startBenchmark", error, { userId: session.user.id, datasetId, kbId: knowledgeBaseId });
    throw error;
  }
}

export async function getReport(runId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  try {
    const run = await prisma.benchmarkRun.findUnique({
      where: { id: runId },
      include: {
        dataset: true,
        results: { take: 1 },
      },
    });

    if (!run) throw new Error("Run not found");

    return generateEvaluationReport(run as never);
  } catch (error) {
    logError("getReport", error, { userId: session.user.id, runId });
    throw error;
  }
}

export async function compareRuns(runAId: string, runBId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const [runA, runB] = await Promise.all([
    prisma.benchmarkRun.findUnique({ where: { id: runAId } }),
    prisma.benchmarkRun.findUnique({ where: { id: runBId } }),
  ]);

  if (!runA || !runB) throw new Error("One or both runs not found");

  return compareBenchmarkRuns(
    runA as { name: string | null; aggregatedMetrics: Record<string, number> | null },
    runB as { name: string | null; aggregatedMetrics: Record<string, number> | null },
  );
}

export async function getDatasetsForSelector() {
  const session = await getServerSession();
  if (!session) return [];

  return prisma.benchmarkDataset.findMany({
    select: { id: true, name: true, _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function compareRetrievalStrategies(
  datasetId: string,
  knowledgeBaseId: string,
) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  await assertKbAccess(knowledgeBaseId, session.user.id);

  const strategies = [
    { name: "Vector", config: { retrievalStrategy: "vector" as const, retrievalMode: "vector" as const } },
    { name: "BM25", config: { retrievalStrategy: "keyword" as const, retrievalMode: "keyword" as const } },
    { name: "Hybrid", config: { retrievalStrategy: "hybrid" as const, retrievalMode: "hybrid" as const, vectorWeight: 1.0, keywordWeight: 1.0 } },
    { name: "Query-Expansion", config: { retrievalStrategy: "vector" as const, retrievalMode: "vector" as const, enableQueryExpansion: true } },
    { name: "Reranking", config: { retrievalStrategy: "vector" as const, retrievalMode: "vector" as const, enableReranking: true } },
  ];

  const results = await runStrategyBenchmark(datasetId, knowledgeBaseId, strategies);
  return results;
}

export async function getBaselines() {
  const session = await getServerSession();
  if (!session) return [];

  return prisma.benchmarkRun.findMany({
    where: { status: "completed" },
    select: { id: true, name: true, aggregatedMetrics: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function runCampaign(
  datasetId: string,
  knowledgeBaseId: string,
  strategies: CampaignConfig["strategies"],
  embeddingModels: string[],
  chunkStrategies: string[],
  topKs: number[],
  campaignName: string,
): Promise<CampaignResult> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  try {
    await assertKbAccess(knowledgeBaseId, session.user.id);

    return runBenchmarkCampaign(
      {
        datasetId,
        knowledgeBaseId,
        strategies,
        embeddingModels,
      chunkStrategies,
      topKs,
    },
    campaignName,
  );
  } catch (error) {
    logError("runCampaign", error, { userId: session.user.id, datasetId, kbId: knowledgeBaseId });
    throw error;
  }
}

export async function getLeaderboard(runIds: string[]): Promise<LeaderboardEntry[]> {
  const session = await getServerSession();
  if (!session) return [];

  const runs = await prisma.benchmarkRun.findMany({
    where: { id: { in: runIds } },
    select: { name: true, aggregatedMetrics: true },
  });

  return generateLeaderboard(
    runs.map((r) => ({
      label: r.name || "Unnamed",
      aggregatedMetrics: r.aggregatedMetrics as Record<string, number> | null,
    })),
  );
}

export async function getRecommendations(strategyConfigs: StrategyConfig[]): Promise<Recommendation[]> {
  const session = await getServerSession();
  if (!session) return [];

  return generateRecommendations(strategyConfigs);
}
