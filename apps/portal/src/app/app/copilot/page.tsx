import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { CopilotPage } from "./copilot-client";

export const metadata = {
  title: "AI Research Copilot | Kairos",
};

export default async function CopilotPageRoute() {
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
}
