import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { EvaluationDashboard } from "./evaluation-client";

export const metadata = {
  title: "Evaluation | Kairos",
};

export default async function EvaluationPage() {
  await requireSession();

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const [runs, datasets, benchmarks] = await Promise.all([
    prisma.experimentRun.findMany({
      where: { knowledgeBase: { projectId: project.id } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        totalLatency: true,
        latencyEmbedding: true,
        latencyVectorSearch: true,
        chunkCount: true,
        embeddingModel: true,
        retrievalMode: true,
        createdAt: true,
      },
    }),
    prisma.benchmarkDataset.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: true, runs: true } } },
    }),
    prisma.benchmarkRun.findMany({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        dataset: { select: { name: true } },
        _count: { select: { results: true } },
      },
    }),
  ]);

  return (
    <EvaluationDashboard
      runs={runs}
      datasets={datasets}
      benchmarkRuns={benchmarks}
    />
  );
}
