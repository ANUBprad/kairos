import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";
import {
  benchmarkDatasetScopedToProject,
  benchmarkRunScopedToProject,
} from "@/lib/evaluation/access";

const EvaluationDashboard = dynamic(() => import("./evaluation-client").then((m) => m.EvaluationDashboard), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Evaluation",
};

export default async function EvaluationPage() {
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (!result) throw new Error("No organization found");
    const { project } = result;

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
        where: { AND: [{ parentVersionId: null }, benchmarkDatasetScopedToProject(project.id)] },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, description: true, version: true, createdAt: true, _count: { select: { questions: true, runs: true } } },
      }),
      prisma.benchmarkRun.findMany({
        where: benchmarkRunScopedToProject(project.id),
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          status: true,
          aggregatedMetrics: true,
          createdAt: true,
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
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading evaluation data</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
