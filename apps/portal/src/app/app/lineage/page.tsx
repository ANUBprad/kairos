import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { LineagePage } from "./lineage-client";

export const metadata = {
  title: "Experiment Lineage | Kairos",
};

export default async function LineagePageRoute() {
  await requireSession();

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
}
