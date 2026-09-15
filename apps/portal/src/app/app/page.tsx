import { prisma } from "@/lib/prisma";
import { listKnowledgeBases } from "@/lib/actions/knowledge-base";
import { getServerSession } from "@/lib/server/auth-utils";
import { getStudyCountsForProject, type StudyCounts } from "@/lib/study";
import { DashboardClient } from "@/components/app/dashboard/dashboard-client";

export default async function AppPage() {
  let project: { id: string } | null = null;

  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) project = result.project;
  } catch {
    // Seed data not yet initialized — render empty dashboard
  }

  let knowledgeBases: Awaited<ReturnType<typeof listKnowledgeBases>> = [];
  let docCount = 0;
  let chunkCount = 0;
  let experimentCount = 0;
  let latestBenchmark: {
    name: string | null;
    createdAt: Date;
    aggregatedMetrics: import("@prisma/client").Prisma.JsonValue | null;
  } | null = null;
  let studies: StudyCounts = { quizzesTaken: 0, cardsKnown: 0 };

  try {
    const session = project ? await getServerSession() : null;
    if (project && session?.user?.id) {
      [knowledgeBases, docCount, chunkCount, experimentCount, latestBenchmark, studies] =
        await Promise.all([
          listKnowledgeBases(),
          prisma.document.count({
            where: { knowledgeBase: { projectId: project.id } },
          }),
          prisma.documentChunk.count({
            where: { document: { knowledgeBase: { projectId: project.id } } },
          }),
          prisma.experimentRun.count({
            where: { knowledgeBase: { projectId: project.id } },
          }),
          prisma.benchmarkRun.findFirst({
            where: { status: "completed", dataset: { knowledgeBase: { projectId: project.id } } },
            orderBy: { createdAt: "desc" },
            select: { name: true, createdAt: true, aggregatedMetrics: true },
          }),
          getStudyCountsForProject(session.user.id, project.id),
        ]);
    }
  } catch {
    // Dashboard will render with empty/default data
  }

  return (
    <DashboardClient
      data={{
        knowledgeBases: knowledgeBases.map((kb) => ({
          id: kb.id,
          name: kb.name,
          _count: kb._count,
        })),
        docCount,
        chunkCount,
        experimentCount,
        latestBenchmark: latestBenchmark
          ? {
              name: latestBenchmark.name,
              createdAt: latestBenchmark.createdAt,
              aggregatedMetrics: latestBenchmark.aggregatedMetrics as Record<string, number> | null,
            }
          : null,
        quizzesTaken: studies.quizzesTaken,
        cardsKnown: studies.cardsKnown,
      }}
    />
  );
}
