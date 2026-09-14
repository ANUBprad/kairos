import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";

// Dataset and run authorization resolve tenancy from trusted persistence:
// a dataset's knowledge base anchors it to a project/org whose members may
// access it. Foreign, forged, or unauthorized ids all fail as "not found" so
// the existence of another tenant's resources cannot be probed.
// Datasets without a knowledge-base anchor (standalone benchmark material)
// have no tenant scope and remain accessible to any authenticated caller.
export async function assertDatasetAccess(datasetId: string, userId: string) {
  const dataset = await prisma.benchmarkDataset.findUnique({
    where: { id: datasetId },
    select: { id: true, knowledgeBaseId: true },
  });
  if (!dataset) throw new Error("Dataset not found");
  if (
    dataset.knowledgeBaseId &&
    !(await canAccessKnowledgeBase(userId, dataset.knowledgeBaseId))
  ) {
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