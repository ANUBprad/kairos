import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { PlannerPage } from "./planner-client";

export const metadata = {
  title: "Experiment Planner | Kairos",
};

export default async function PlannerPageRoute() {
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
    config: (r.configSnapshot as Record<string, unknown>) || {},
    metrics: (r.aggregatedMetrics as Record<string, number>) || {},
    createdAt: r.createdAt.toISOString(),
    costMs: r.completedAt
      ? r.completedAt.getTime() - r.startedAt.getTime()
      : 1000,
    dataset: {
      id: r.dataset.id,
      name: r.dataset.name,
      questionCount: r.dataset._count.questions,
    },
    questionCount: r.results.length,
  }));

  return <PlannerPage runs={runs} />;
}
