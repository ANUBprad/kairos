import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import dynamic from "next/dynamic";

const CopilotPage = dynamic(
  () => import("./copilot-client").then((mod) => mod.CopilotPage),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-surface" />
        <div className="h-4 w-96 animate-pulse rounded bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    ),
  }
);

export const metadata = {
  title: "AI Research Copilot",
};

export default async function CopilotPageRoute() {
  try {
    await requireSession();

    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const { project } = await ensureDefaultOrg();

    const benchmarkRuns = await prisma.benchmarkRun.findMany({
      where: { status: "completed", dataset: { knowledgeBase: { projectId: project.id } } },
      orderBy: { createdAt: "desc" },
      take: 50,
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
      configSnapshot: (r.configSnapshot as Record<string, unknown>) || {},
      aggregatedMetrics: (r.aggregatedMetrics as Record<string, number>) || null,
      createdAt: r.createdAt.toISOString(),
      dataset: {
        name: r.dataset.name,
        questionCount: r.dataset._count.questions,
      },
      resultsCount: r.results.length,
    }));

    return <CopilotPage runs={runs} />;
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Error loading copilot data</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Please try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }
}
