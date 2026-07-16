import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";

const EvaluationDashboard = dynamic(() => import("./evaluation-client").then((m) => m.EvaluationDashboard), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Evaluation",
};

export default async function EvaluationPage() {
  try {
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
        select: { id: true, name: true, description: true, createdAt: true, _count: { select: { questions: true, runs: true } } },
      }),
      prisma.benchmarkRun.findMany({
        where: { status: "completed" },
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
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h1 className="text-lg font-semibold text-text-primary">Evaluation</h1>
          <p className="mt-1 text-sm text-text-secondary">
            <strong className="text-text-primary">Purpose:</strong> Measure retrieval quality with statistical rigor using 12+ IR metrics.
          </p>
          <p className="mt-1 text-sm text-text-tertiary">
            <strong className="text-text-secondary">Why it matters:</strong> Single metrics are misleading. Statistical rigor requires confidence intervals,
            distribution analysis, and proper comparison methodology. Without this, you cannot know if improvements are real or noise.
          </p>
          <p className="mt-1 text-sm text-text-tertiary">
            <strong className="text-text-secondary">What you can learn:</strong> What each metric actually measures. Why Recall@K matters more than accuracy for retrieval.
            How to interpret nDCG scores. How to compare configurations with p-values and effect sizes.
          </p>
        </div>
        <EvaluationDashboard
          runs={runs}
          datasets={datasets}
          benchmarkRuns={benchmarks}
        />
      </div>
    );
  } catch (error) {
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
