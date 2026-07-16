import dynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";

const LineagePage = dynamic(() => import("./lineage-client").then((m) => m.LineagePage), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Experiment Lineage",
};

export default async function LineagePageRoute() {
  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const { project } = await ensureDefaultOrg();

    const benchmarkRuns = await prisma.benchmarkRun.findMany({
      where: { status: "completed", dataset: { knowledgeBase: { projectId: project.id } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        configSnapshot: true,
        aggregatedMetrics: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        dataset: {
          select: {
            id: true,
            name: true,
            source: true,
            _count: { select: { questions: true } },
          },
        },
        results: {
          select: {
            retrievalMetrics: true,
            generationMetrics: true,
            latencySearchMs: true,
          },
        },
      },
    });

    const runs = benchmarkRuns.map((r) => ({
      id: r.id,
      name: r.name || `Run ${r.id.slice(0, 8)}`,
      config: (r.configSnapshot as Record<string, unknown>) || {},
      metrics: (r.aggregatedMetrics as Record<string, number>) || {},
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() || null,
      dataset: {
        id: r.dataset.id,
        name: r.dataset.name,
        source: r.dataset.source || "unknown",
        questionCount: r.dataset._count.questions,
      },
      questionCount: r.results.length,
    }));

    return <LineagePage runs={runs} />;
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading lineage data</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
