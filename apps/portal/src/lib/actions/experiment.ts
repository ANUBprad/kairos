"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getSession() {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

async function assertKbAccess(kbId: string, userId: string) {
  const member = await prisma.member.findFirst({
    where: { userId, organization: { projects: { some: { knowledgeBases: { some: { id: kbId } } } } } },
  });
  if (!member) throw new Error("Access denied");
}

// ─── Experiment CRUD ──────────────────────────────────────────────

export interface CreateExperimentInput {
  name: string;
  description?: string;
  knowledgeBaseId: string;
  datasetId?: string;
  embeddingModel?: string;
  retriever?: string;
  reranker?: string;
  llm?: string;
  promptTemplate?: string;
  chunkStrategy?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  similarityThreshold?: number;
  retrievalMode?: string;
  tags?: string[];
}

export async function createExperiment(input: CreateExperimentInput) {
  const session = await getSession();
  await assertKbAccess(input.knowledgeBaseId, session.user.id);

  const experiment = await prisma.experiment.create({
    data: {
      name: input.name,
      description: input.description,
      knowledgeBaseId: input.knowledgeBaseId,
      datasetId: input.datasetId,
      createdById: session.user.id,
      embeddingModel: input.embeddingModel ?? "text-embedding-3-small",
      retriever: input.retriever ?? "vector",
      reranker: input.reranker ?? "none",
      llm: input.llm ?? "gpt-4o-mini",
      promptTemplate: input.promptTemplate ?? "default",
      chunkStrategy: input.chunkStrategy ?? "fixed",
      chunkSize: input.chunkSize ?? 512,
      chunkOverlap: input.chunkOverlap ?? 50,
      topK: input.topK ?? 10,
      similarityThreshold: input.similarityThreshold ?? 0.7,
      retrievalMode: input.retrievalMode ?? "vector",
      tags: input.tags ?? [],
      configA: {
        embeddingModel: input.embeddingModel ?? "text-embedding-3-small",
        retriever: input.retriever ?? "vector",
        reranker: input.reranker ?? "none",
        llm: input.llm ?? "gpt-4o-mini",
        chunkStrategy: input.chunkStrategy ?? "fixed",
        chunkSize: input.chunkSize ?? 512,
        chunkOverlap: input.chunkOverlap ?? 50,
        topK: input.topK ?? 10,
        similarityThreshold: input.similarityThreshold ?? 0.7,
        retrievalMode: input.retrievalMode ?? "vector",
      },
    },
  });

  revalidatePath("/app/experiments");
  return experiment;
}

export async function listExperiments(knowledgeBaseId?: string) {
  const session = await getSession();
  const where: Record<string, unknown> = {};
  if (knowledgeBaseId) {
    where.knowledgeBaseId = knowledgeBaseId;
    await assertKbAccess(knowledgeBaseId, session.user.id);
  } else {
    where.knowledgeBase = {
      project: {
        organization: {
          members: { some: { userId: session.user.id } },
        },
      },
    };
  }

  return prisma.experiment.findMany({
    where,
    include: {
      knowledgeBase: { select: { id: true, name: true } },
      dataset: { select: { id: true, name: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { runs: true, artifacts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getExperiment(id: string) {
  const session = await getSession();
  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      knowledgeBase: { select: { id: true, name: true } },
      dataset: { select: { id: true, name: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 50 },
      artifacts: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!experiment) throw new Error("Experiment not found");
  await assertKbAccess(experiment.knowledgeBaseId, session.user.id);
  return experiment;
}

export async function updateExperiment(id: string, data: Partial<CreateExperimentInput & { isFavorite: boolean; isArchived: boolean; status: string; winner: string }>) {
  const session = await getSession();
  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) throw new Error("Experiment not found");
  await assertKbAccess(existing.knowledgeBaseId, session.user.id);

  const experiment = await prisma.experiment.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
      ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.winner !== undefined && { winner: data.winner }),
      ...(data.tags !== undefined && { tags: data.tags }),
    },
  });

  revalidatePath("/app/experiments");
  return experiment;
}

export async function deleteExperiment(id: string) {
  const session = await getSession();
  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) throw new Error("Experiment not found");
  await assertKbAccess(existing.knowledgeBaseId, session.user.id);

  await prisma.experiment.delete({ where: { id } });
  revalidatePath("/app/experiments");
}

export async function duplicateExperiment(id: string) {
  const session = await getSession();
  const existing = await prisma.experiment.findUnique({
    where: { id },
    include: { runs: false },
  });
  if (!existing) throw new Error("Experiment not found");
  await assertKbAccess(existing.knowledgeBaseId, session.user.id);

  const experiment = await prisma.experiment.create({
    data: {
      name: `${existing.name} (copy)`,
      description: existing.description,
      knowledgeBaseId: existing.knowledgeBaseId,
      datasetId: existing.datasetId,
      createdById: session.user.id,
      embeddingModel: existing.embeddingModel,
      retriever: existing.retriever,
      reranker: existing.reranker,
      llm: existing.llm,
      promptTemplate: existing.promptTemplate,
      chunkStrategy: existing.chunkStrategy,
      chunkSize: existing.chunkSize,
      chunkOverlap: existing.chunkOverlap,
      topK: existing.topK,
      similarityThreshold: existing.similarityThreshold,
      retrievalMode: existing.retrievalMode,
      tags: existing.tags,
      configA: existing.configA as never,
      configB: existing.configB ?? undefined,
    },
  });

  revalidatePath("/app/experiments");
  return experiment;
}

// ─── Experiment Runs ──────────────────────────────────────────────

export async function listExperimentRuns(experimentId: string) {
  const session = await getSession();
  const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
  if (!experiment) throw new Error("Experiment not found");
  await assertKbAccess(experiment.knowledgeBaseId, session.user.id);

  return prisma.experimentRun.findMany({
    where: { experimentId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getExperimentRun(id: string) {
  const session = await getSession();
  const run = await prisma.experimentRun.findUnique({
    where: { id },
    include: { experiment: { select: { id: true, name: true, knowledgeBaseId: true } } },
  });
  if (!run) throw new Error("Run not found");
  await assertKbAccess(run.knowledgeBaseId, session.user.id);
  return run;
}

export async function deleteExperimentRun(id: string) {
  const session = await getSession();
  const run = await prisma.experimentRun.findUnique({ where: { id } });
  if (!run) throw new Error("Run not found");
  await assertKbAccess(run.knowledgeBaseId, session.user.id);

  await prisma.experimentRun.delete({ where: { id } });
  revalidatePath("/app/experiments");
}

// ─── Artifacts ────────────────────────────────────────────────────

export async function listArtifacts(experimentId: string) {
  const session = await getSession();
  const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
  if (!experiment) throw new Error("Experiment not found");
  await assertKbAccess(experiment.knowledgeBaseId, session.user.id);

  return prisma.experimentArtifact.findMany({
    where: { experimentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createArtifact(experimentId: string, data: { type: string; name: string; mimeType: string; size: number; data?: unknown }) {
  const session = await getSession();
  const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
  if (!experiment) throw new Error("Experiment not found");
  await assertKbAccess(experiment.knowledgeBaseId, session.user.id);

  return prisma.experimentArtifact.create({
    data: {
      experimentId,
      type: data.type,
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
      data: data.data as never,
    },
  });
}

export async function deleteArtifact(id: string) {
  const session = await getSession();
  const artifact = await prisma.experimentArtifact.findUnique({
    where: { id },
    include: { experiment: true },
  });
  if (!artifact) throw new Error("Artifact not found");
  await assertKbAccess(artifact.experiment.knowledgeBaseId, session.user.id);

  await prisma.experimentArtifact.delete({ where: { id } });
}

// ─── Dataset Versioning ───────────────────────────────────────────

export async function listDatasetsWithVersions() {
  const session = await getSession();
  return prisma.benchmarkDataset.findMany({
    where: {
      OR: [
        { knowledgeBaseId: null },
        { knowledgeBase: { project: { organization: { members: { some: { userId: session.user.id } } } } } },
      ],
    },
    include: {
      _count: { select: { questions: true, runs: true, childVersions: true } },
      parentVersion: { select: { id: true, name: true, version: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createDatasetVersion(parentId: string, data: { name: string; description?: string; tags?: string[] }) {
  const session = await getSession();
  const parent = await prisma.benchmarkDataset.findUnique({ where: { id: parentId } });
  if (!parent) throw new Error("Dataset not found");
  if (parent.knowledgeBaseId) await assertKbAccess(parent.knowledgeBaseId, session.user.id);

  const maxVersion = await prisma.benchmarkDataset.aggregate({
    where: { OR: [{ id: parentId }, { parentVersionId: parentId }] },
    _max: { version: true },
  });

  const newVersion = (maxVersion._max.version ?? parent.version) + 1;

  const questions = await prisma.benchmarkQuestion.findMany({
    where: { datasetId: parentId },
  });

  const dataset = await prisma.benchmarkDataset.create({
    data: {
      name: data.name,
      description: data.description ?? parent.description,
      source: parent.source,
      tags: data.tags ?? parent.tags,
      version: newVersion,
      parentVersionId: parentId,
      knowledgeBaseId: parent.knowledgeBaseId,
      questions: {
        create: questions.map((q) => ({
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          expectedContext: q.expectedContext,
          referenceDocId: q.referenceDocId,
          metadata: (q.metadata || undefined) as never,
        })),
      },
    },
  });

  revalidatePath("/app/experiments");
  return dataset;
}

export async function rollbackDataset(datasetId: string) {
  const session = await getSession();
  const dataset = await prisma.benchmarkDataset.findUnique({ where: { id: datasetId } });
  if (!dataset) throw new Error("Dataset not found");
  if (!dataset.parentVersionId) throw new Error("No previous version to rollback to");
  if (dataset.knowledgeBaseId) await assertKbAccess(dataset.knowledgeBaseId, session.user.id);

  const parent = await prisma.benchmarkDataset.findUnique({
    where: { id: dataset.parentVersionId },
    include: { questions: true },
  });
  if (!parent) throw new Error("Parent version not found");

  await prisma.benchmarkQuestion.deleteMany({ where: { datasetId } });
  await prisma.benchmarkQuestion.createMany({
    data: parent.questions.map((q) => ({
      datasetId: dataset.id,
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      expectedContext: q.expectedContext,
      referenceDocId: q.referenceDocId,
      metadata: (q.metadata || undefined) as never,
    })),
  });

  return prisma.benchmarkDataset.update({
    where: { id: datasetId },
    data: { name: parent.name, description: parent.description, tags: parent.tags },
  });
}

// ─── Comparisons ──────────────────────────────────────────────────

export async function createComparison(experimentAId: string, experimentBId: string) {
  const session = await getSession();
  const [expA, expB] = await Promise.all([
    prisma.experiment.findUnique({ where: { id: experimentAId } }),
    prisma.experiment.findUnique({ where: { id: experimentBId } }),
  ]);
  if (!expA || !expB) throw new Error("Experiment not found");
  await assertKbAccess(expA.knowledgeBaseId, session.user.id);

  const latestRunA = await prisma.experimentRun.findFirst({
    where: { experimentId: experimentAId, status: "completed" },
    orderBy: { createdAt: "desc" },
  });
  const latestRunB = await prisma.experimentRun.findFirst({
    where: { experimentId: experimentBId, status: "completed" },
    orderBy: { createdAt: "desc" },
  });

  return {
    experimentA: expA,
    experimentB: expB,
    runA: latestRunA,
    runB: latestRunB,
    metricsA: (latestRunA?.metrics as Record<string, number>) ?? {},
    metricsB: (latestRunB?.metrics as Record<string, number>) ?? {},
  };
}
