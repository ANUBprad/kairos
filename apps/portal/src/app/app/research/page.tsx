import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { ResearchDashboard } from "./research-client";

export const metadata = {
  title: "Research Dashboard | Kairos",
};

export default async function ResearchPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  const [
    knowledgeBases,
    totalDocuments,
    totalChunks,
    totalEmbeddings,
    experiments,
    experimentRuns,
    benchmarkRuns,
    datasets,
  ] = await Promise.all([
    prisma.knowledgeBase.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, retrievalConfig: true, _count: { select: { documents: true } } },
    }),
    prisma.document.count({ where: { knowledgeBase: { projectId: project.id } } }),
    prisma.documentChunk.count({ where: { document: { knowledgeBase: { projectId: project.id } } } }),
    prisma.documentEmbedding.count({ where: { chunk: { document: { knowledgeBase: { projectId: project.id } } } } }),
    prisma.experiment.count({ where: { knowledgeBase: { projectId: project.id } } }),
    prisma.experimentRun.count({ where: { knowledgeBase: { projectId: project.id } } }),
    prisma.benchmarkRun.findMany({
      where: { status: "completed", dataset: { knowledgeBase: { projectId: project.id } } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        aggregatedMetrics: true,
        createdAt: true,
        dataset: { select: { name: true, _count: { select: { questions: true } } } },
      },
    }),
    prisma.benchmarkDataset.findMany({
      where: { knowledgeBase: { projectId: project.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, _count: { select: { questions: true, runs: true } } },
    }),
  ]);

  const latestEval = benchmarkRuns[0] ?? null;
  const currentKb = (knowledgeBases as Array<{ id: string; name: string; retrievalConfig: unknown; _count: { documents: number } }>)[0] ?? null;

  const latestReport = latestEval && latestEval.aggregatedMetrics
    ? { name: latestEval.name, date: latestEval.createdAt, metrics: latestEval.aggregatedMetrics as Record<string, number> }
    : null;

  const aggregatedMetricsList = benchmarkRuns
    .map((r) => r.aggregatedMetrics as Record<string, number> | null)
    .filter((m): m is Record<string, number> => m !== null);

  const avgRecall = aggregatedMetricsList.length > 0
    ? aggregatedMetricsList.reduce((s, m) => s + (m.avgRecallAtK ?? 0), 0) / aggregatedMetricsList.length
    : 0;

  const currentConfig = currentKb
    ? (currentKb.retrievalConfig as Record<string, unknown> | null)
    : null;

  return (
    <ResearchDashboard
      currentKbName={currentKb?.name ?? null}
      currentKbDocs={currentKb?._count.documents ?? 0}
      retrievalStrategy={String(currentConfig?.retrievalMode ?? currentConfig?.retrievalStrategy ?? "vector")}
      embeddingModel={String(currentConfig?.embeddingModel ?? "—")}
      chunkingStrategy={String(currentConfig?.chunkStrategy ?? "—")}
      knowledgeBases={knowledgeBases.length}
      totalDocuments={totalDocuments}
      totalChunks={totalChunks}
      totalEmbeddings={totalEmbeddings}
      totalExperiments={experiments}
      totalExperimentRuns={experimentRuns}
      datasets={datasets}
      benchmarkRuns={benchmarkRuns.map((r) => ({
        id: r.id,
        name: r.name,
        aggregatedMetrics: r.aggregatedMetrics as Record<string, number> | null,
        createdAt: r.createdAt,
        datasetName: r.dataset.name,
        questionCount: r.dataset._count.questions,
      }))}
      avgRecall={avgRecall}
      latestEval={latestEval ? {
        name: latestEval.name,
        date: latestEval.createdAt,
        metrics: latestEval.aggregatedMetrics as Record<string, number> | null,
      } : null}
      latestReport={latestReport}
    />
  );
}
