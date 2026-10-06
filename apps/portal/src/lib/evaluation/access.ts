import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getMembership } from "@/lib/rbac";

// Dataset and run authorization resolve tenancy from trusted persistence:
// a dataset's knowledge base anchors it to a project/org whose members may
// access it. Foreign, forged, or unauthorized ids all fail as "not found" so
// the existence of another tenant's resources cannot be probed.
// Datasets without any tenant anchor (standalone benchmark material) have no
// scope and remain accessible to any authenticated caller.
export async function assertDatasetAccess(datasetId: string, userId: string) {
  const dataset = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    select: { id: true, knowledgeBaseId: true, organizationId: true },
  });
  if (!dataset) throw new Error("Dataset not found");
  if (
    dataset.knowledgeBaseId &&
    !(await canAccessKnowledgeBase(userId, dataset.knowledgeBaseId))
  ) {
    throw new Error("Dataset not found");
  }
  if (dataset.organizationId && !(await getMembership(userId, dataset.organizationId))) {
    throw new Error("Dataset not found");
  }
  return dataset;
}

// Every run references a persisted dataset, so run access is the dataset's
// tenancy through the shared boundary above.
export async function assertRunAccess(runId: string, userId: string) {
  const run = await prisma.benchmarkRun.findUnique({
    where: { id: runId },
    select: { id: true, datasetId: true },
  });
  if (!run) throw new Error("Run not found");
  await assertDatasetAccess(run.datasetId, userId);
  return run;
}

// Page-level list scoping matching assertDatasetAccess: a project sees datasets
// anchored to its knowledge bases, datasets anchored directly to its
// organization, and standalone material with no tenant anchor at all; runs
// follow their dataset's scope.
export function benchmarkDatasetScopedToProject(
  projectId: string,
): Prisma.BenchmarkDatasetWhereInput {
  return {
    OR: [
      { knowledgeBaseId: null, organizationId: null },
      { knowledgeBase: { projectId } },
      { organization: { projects: { some: { id: projectId } } } },
    ],
  };
}

export function benchmarkRunScopedToProject(
  projectId: string,
): Prisma.BenchmarkRunWhereInput {
  return {
    status: "completed",
    dataset: {
      OR: [
        { knowledgeBaseId: null, organizationId: null },
        { knowledgeBase: { projectId } },
        { organization: { projects: { some: { id: projectId } } } },
      ],
    },
  };
}

export async function filterAccessibleRunIds(runIds: string[], userId: string) {
  const allowed: string[] = [];
  await Promise.all(
    runIds.map(async (id) => {
      try {
        await assertRunAccess(id, userId);
        allowed.push(id);
      } catch {
        // Foreign, fabricated, and deleted runs are omitted so a leaderboard
        // request cannot probe another tenant's run existence.
      }
    }),
  );
  return allowed;
}
