import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";

const AdvancedRetrievalDashboard = dynamic(() => import("./advanced-retrieval-client").then((m) => m.AdvancedRetrievalDashboard), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Advanced Retrieval | Kairos",
};

export default async function AdvancedRetrievalPage() {
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const { project } = await ensureDefaultOrg();

    const [kbs, benchmarkRuns, experimentRuns] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where: { projectId: project.id },
        select: { id: true, name: true, retrievalConfig: true },
        orderBy: { name: "asc" },
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
      prisma.experimentRun.findMany({
        where: { knowledgeBase: { projectId: project.id } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          totalLatency: true,
          chunkCount: true,
          embeddingModel: true,
          retrievalMode: true,
          configSnapshot: true,
          createdAt: true,
        },
      }),
    ]);

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h1 className="text-lg font-semibold text-text-primary">Advanced Retrieval</h1>
          <p className="mt-1 text-sm text-text-secondary">
            <strong className="text-text-primary">Purpose:</strong> Compare advanced retrieval strategies and their impact on retrieval quality.
          </p>
          <p className="mt-1 text-sm text-text-tertiary">
            <strong className="text-text-secondary">Why it matters:</strong> Hybrid search, query expansion, multi-query, and reranking each address different failure modes.
            Understanding when to use each strategy is key to building effective RAG systems.
          </p>
          <p className="mt-1 text-sm text-text-tertiary">
            <strong className="text-text-secondary">What you can learn:</strong> How Reciprocal Rank Fusion combines results.
            Why multi-query retrieval improves recall for complex questions. How cross-encoder reranking reorders results by deeper relevance.
          </p>
        </div>
        <AdvancedRetrievalDashboard
          kbs={kbs}
          benchmarkRuns={benchmarkRuns}
          experimentRuns={experimentRuns}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading advanced retrieval data</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
