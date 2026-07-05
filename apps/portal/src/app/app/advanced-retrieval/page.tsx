import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-utils";
import { AdvancedRetrievalDashboard } from "./advanced-retrieval-client";

export const metadata = {
  title: "Advanced Retrieval | Kairos",
};

export default async function AdvancedRetrievalPage() {
  await requireSession();

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
      include: {
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
    <AdvancedRetrievalDashboard
      kbs={kbs}
      benchmarkRuns={benchmarkRuns}
      experimentRuns={experimentRuns}
    />
  );
}
