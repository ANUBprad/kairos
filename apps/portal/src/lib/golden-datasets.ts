/**
 * Golden Datasets Library for Kairos
 *
 * Provides CRUD, import/export, versioning, validation, and stats for golden datasets.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export interface GoldenDatasetInfo {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  difficulty: string;
  version: number;
  organizationId: string;
  ownerId: string;
  parentId: string | null;
  entryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoldenDatasetEntryInfo {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedCitations: string[];
  context: string | null;
  tags: string[];
  category: string | null;
  metadata: Prisma.JsonValue | null;
  datasetId: string;
  createdAt: Date;
}

export interface CreateDatasetInput {
  name: string;
  description?: string;
  tags?: string[];
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
}

export interface CreateEntryInput {
  question: string;
  expectedAnswer: string;
  expectedCitations?: string[];
  context?: string;
  tags?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportDatasetInput {
  name: string;
  description?: string;
  tags?: string[];
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
  entries: CreateEntryInput[];
}

export interface DatasetStats {
  totalEntries: number;
  byDifficulty: Record<string, number>;
  byCategory: Record<string, number>;
}

function toDatasetInfo(
  dataset: {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    difficulty: string;
    version: number;
    organizationId: string;
    ownerId: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  entryCount: number
): GoldenDatasetInfo {
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    tags: dataset.tags,
    difficulty: dataset.difficulty,
    version: dataset.version,
    organizationId: dataset.organizationId,
    ownerId: dataset.ownerId,
    parentId: dataset.parentId,
    entryCount,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
  };
}

function toEntryInfo(entry: {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedCitations: string[];
  context: string | null;
  tags: string[];
  category: string | null;
  metadata: Prisma.JsonValue | null;
  datasetId: string;
  createdAt: Date;
}): GoldenDatasetEntryInfo {
  return {
    id: entry.id,
    question: entry.question,
    expectedAnswer: entry.expectedAnswer,
    expectedCitations: entry.expectedCitations,
    context: entry.context,
    tags: entry.tags,
    category: entry.category,
    metadata: entry.metadata,
    datasetId: entry.datasetId,
    createdAt: entry.createdAt,
  };
}

export async function createDataset(
  organizationId: string,
  userId: string,
  input: CreateDatasetInput
): Promise<GoldenDatasetInfo> {
  const dataset = await prisma.goldenDataset.create({
    data: {
      name: input.name,
      description: input.description,
      tags: input.tags ?? [],
      difficulty: input.difficulty ?? "MEDIUM",
      organizationId,
      ownerId: userId,
    },
  });

  logger.info("Created golden dataset", { datasetId: dataset.id, name: dataset.name });

  return toDatasetInfo(dataset, 0);
}

export async function getDataset(
  datasetId: string
): Promise<{ dataset: GoldenDatasetInfo; entries: GoldenDatasetEntryInfo[] } | null> {
  const dataset = await prisma.goldenDataset.findUnique({
    where: { id: datasetId },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!dataset) return null;

  return {
    dataset: toDatasetInfo(dataset, dataset.entries.length),
    entries: dataset.entries.map(toEntryInfo),
  };
}

export async function listDatasets(
  organizationId: string,
  options: {
    difficulty?: string;
    tags?: string[];
    search?: string;
  } = {}
): Promise<GoldenDatasetInfo[]> {
  const where: Prisma.GoldenDatasetWhereInput = {
    organizationId,
  };

  if (options.difficulty) {
    where.difficulty = options.difficulty as Prisma.EnumDatasetDifficultyFilter["equals"];
  }

  if (options.tags && options.tags.length > 0) {
    where.tags = { hasSome: options.tags };
  }

  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const datasets = await prisma.goldenDataset.findMany({
    where,
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return datasets.map((d) => toDatasetInfo(d, d._count.entries));
}

export async function updateDataset(
  datasetId: string,
  input: Partial<CreateDatasetInput>
): Promise<GoldenDatasetInfo> {
  const data: Prisma.GoldenDatasetUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.difficulty !== undefined) data.difficulty = input.difficulty;

  const dataset = await prisma.goldenDataset.update({
    where: { id: datasetId },
    data,
    include: {
      _count: { select: { entries: true } },
    },
  });

  logger.info("Updated golden dataset", { datasetId });

  return toDatasetInfo(dataset, dataset._count.entries);
}

export async function deleteDataset(datasetId: string): Promise<boolean> {
  try {
    await prisma.goldenDataset.delete({ where: { id: datasetId } });
    logger.info("Deleted golden dataset", { datasetId });
    return true;
  } catch {
    return false;
  }
}

export async function addEntry(
  datasetId: string,
  input: CreateEntryInput
): Promise<GoldenDatasetEntryInfo> {
  const entry = await prisma.goldenDatasetEntry.create({
    data: {
      question: input.question,
      expectedAnswer: input.expectedAnswer,
      expectedCitations: input.expectedCitations ?? [],
      context: input.context ?? null,
      tags: input.tags ?? [],
      category: input.category ?? null,
      metadata: input.metadata as Prisma.InputJsonValue ?? undefined,
      datasetId,
    },
  });

  return toEntryInfo(entry);
}

export async function bulkAddEntries(
  datasetId: string,
  entries: CreateEntryInput[]
): Promise<{ count: number }> {
  const result = await prisma.goldenDatasetEntry.createMany({
    data: entries.map((e) => ({
      question: e.question,
      expectedAnswer: e.expectedAnswer,
      expectedCitations: e.expectedCitations ?? [],
      context: e.context ?? null,
      tags: e.tags ?? [],
      category: e.category ?? null,
      metadata: e.metadata as Prisma.InputJsonValue ?? undefined,
      datasetId,
    })),
  });

  logger.info("Bulk added entries to golden dataset", {
    datasetId,
    count: result.count,
  });

  return { count: result.count };
}

export async function updateEntry(
  entryId: string,
  input: Partial<CreateEntryInput>
): Promise<GoldenDatasetEntryInfo> {
  const data: Prisma.GoldenDatasetEntryUpdateInput = {};

  if (input.question !== undefined) data.question = input.question;
  if (input.expectedAnswer !== undefined) data.expectedAnswer = input.expectedAnswer;
  if (input.expectedCitations !== undefined) data.expectedCitations = input.expectedCitations;
  if (input.context !== undefined) data.context = input.context;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.category !== undefined) data.category = input.category;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const entry = await prisma.goldenDatasetEntry.update({
    where: { id: entryId },
    data,
  });

  return toEntryInfo(entry);
}

export async function deleteEntry(entryId: string): Promise<boolean> {
  try {
    await prisma.goldenDatasetEntry.delete({ where: { id: entryId } });
    return true;
  } catch {
    return false;
  }
}

export async function importDataset(
  organizationId: string,
  userId: string,
  input: ImportDatasetInput
): Promise<GoldenDatasetInfo> {
  const dataset = await prisma.goldenDataset.create({
    data: {
      name: input.name,
      description: input.description,
      tags: input.tags ?? [],
      difficulty: input.difficulty ?? "MEDIUM",
      organizationId,
      ownerId: userId,
      entries: {
        create: input.entries.map((e) => ({
          question: e.question,
          expectedAnswer: e.expectedAnswer,
          expectedCitations: e.expectedCitations ?? [],
          context: e.context ?? null,
          tags: e.tags ?? [],
          category: e.category ?? null,
          metadata: e.metadata as Prisma.InputJsonValue ?? undefined,
        })),
      },
    },
  });

  const entryCount = await prisma.goldenDatasetEntry.count({
    where: { datasetId: dataset.id },
  });

  logger.info("Imported golden dataset", {
    datasetId: dataset.id,
    name: dataset.name,
    entryCount,
  });

  return toDatasetInfo(dataset, entryCount);
}

export async function exportDataset(
  datasetId: string
): Promise<Omit<ImportDatasetInput, "entries"> & { entries: CreateEntryInput[] } | null> {
  const dataset = await prisma.goldenDataset.findUnique({
    where: { id: datasetId },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!dataset) return null;

  return {
    name: dataset.name,
    description: dataset.description ?? undefined,
    tags: dataset.tags,
    difficulty: dataset.difficulty as ImportDatasetInput["difficulty"],
    entries: dataset.entries.map((e) => ({
      question: e.question,
      expectedAnswer: e.expectedAnswer,
      expectedCitations: e.expectedCitations,
      context: e.context ?? undefined,
      tags: e.tags,
      category: e.category ?? undefined,
      metadata: (e.metadata as Record<string, unknown>) ?? undefined,
    })),
  };
}

export async function createVersion(
  datasetId: string
): Promise<GoldenDatasetInfo> {
  const source = await prisma.goldenDataset.findUnique({
    where: { id: datasetId },
    include: { entries: true },
  });

  if (!source) {
    throw new Error("Dataset not found");
  }

  const latestVersion = await prisma.goldenDataset.findFirst({
    where: { parentId: datasetId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? source.version) + 1;

  const newDataset = await prisma.goldenDataset.create({
    data: {
      name: source.name,
      description: source.description,
      tags: source.tags,
      difficulty: source.difficulty,
      organizationId: source.organizationId,
      ownerId: source.ownerId,
      parentId: datasetId,
      version: nextVersion,
      entries: {
        create: source.entries.map((e) => ({
          question: e.question,
          expectedAnswer: e.expectedAnswer,
          expectedCitations: e.expectedCitations,
          context: e.context,
          tags: e.tags,
          category: e.category,
          metadata: e.metadata ?? undefined,
        })),
      },
    },
  });

  const entryCount = await prisma.goldenDatasetEntry.count({
    where: { datasetId: newDataset.id },
  });

  logger.info("Created new dataset version", {
    sourceDatasetId: datasetId,
    newDatasetId: newDataset.id,
    version: nextVersion,
  });

  return toDatasetInfo(newDataset, entryCount);
}

export async function validateDataset(
  datasetId: string
): Promise<{
  valid: boolean;
  errors: Array<{ entryId: string; issues: string[] }>;
}> {
  const entries = await prisma.goldenDatasetEntry.findMany({
    where: { datasetId },
  });

  const errors: Array<{ entryId: string; issues: string[] }> = [];

  for (const entry of entries) {
    const issues: string[] = [];

    if (!entry.question || entry.question.trim().length === 0) {
      issues.push("question is empty");
    }
    if (!entry.expectedAnswer || entry.expectedAnswer.trim().length === 0) {
      issues.push("expectedAnswer is empty");
    }

    if (issues.length > 0) {
      errors.push({ entryId: entry.id, issues });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function getDatasetStats(
  datasetId: string
): Promise<DatasetStats> {
  const entries = await prisma.goldenDatasetEntry.findMany({
    where: { datasetId },
    select: {
      category: true,
    },
  });

  const dataset = await prisma.goldenDataset.findUnique({
    where: { id: datasetId },
    select: { difficulty: true },
  });

  const byCategory: Record<string, number> = {};
  for (const entry of entries) {
    const cat = entry.category ?? "uncategorized";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  const byDifficulty: Record<string, number> = {};
  if (dataset) {
    byDifficulty[dataset.difficulty] = entries.length;
  }

  return {
    totalEntries: entries.length,
    byDifficulty,
    byCategory,
  };
}
