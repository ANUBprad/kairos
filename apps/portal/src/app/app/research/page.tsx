import { prisma } from "@/lib/prisma";
import { compareMetrics } from "@/lib/evaluation/significance";
import { analyzeResearchIntelligence, type IntelligenceRun } from "@/lib/evaluation/research-intelligence";
import { generateResearchPaper } from "@/lib/research-scientist";
import dynamic from "next/dynamic";

const ResearchDashboard = dynamic(
  () => import("./research-client").then((mod) => mod.ResearchDashboard),
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
  title: "Research Dashboard",
};

export default async function ResearchPage() {
  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  try {
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
        results: {
          select: {
            retrievalMetrics: true,
            generationMetrics: true,
            latencySearchMs: true,
          },
        },
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

  const scientificAnalysis = (() => {
    if (benchmarkRuns.length < 2) {
      return {
        significantImprovements: [],
        equivalentConfigurations: [],
        confidenceIntervals: [],
        summary: { totalComparisons: 0, significantCount: 0 },
      };
    }

    const significantImprovements: Array<{
      metric: string;
      from: string;
      to: string;
      improvement: number;
      pValue: number;
      effectSize: string;
      ci: [number, number];
    }> = [];

    const equivalentConfigurations: Array<{
      metric: string;
      configs: string[];
    }> = [];

    const confidenceIntervals: Array<{
      config: string;
      metric: string;
      mean: number;
      ciLower: number;
      ciUpper: number;
    }> = [];

    const metricKeys = ["recallAtK", "precisionAtK", "mrr", "ndcg", "hitRate"];
    let totalComparisons = 0;
    let significantCount = 0;

    for (let i = 0; i < Math.min(benchmarkRuns.length, 5); i++) {
      const run = benchmarkRuns[i];
      const perQuery: Record<string, number[]> = {};
      for (const result of run.results) {
        const rm = result.retrievalMetrics as Record<string, number> | null;
        if (rm) {
          for (const [key, val] of Object.entries(rm)) {
            if (typeof val === "number") {
              if (!perQuery[key]) perQuery[key] = [];
              perQuery[key].push(val);
            }
          }
        }
      }

      for (const key of metricKeys) {
        const values = perQuery[key] ?? [];
        if (values.length >= 2) {
          const mean = values.reduce((s, v) => s + v, 0) / values.length;
          const n = values.length;
          const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
          const se = stdDev / Math.sqrt(n);
          const ciLower = mean - 1.96 * se;
          const ciUpper = mean + 1.96 * se;

          confidenceIntervals.push({
            config: run.name || "Unnamed",
            metric: key,
            mean: Math.round(mean * 10000) / 10000,
            ciLower: Math.round(ciLower * 10000) / 10000,
            ciUpper: Math.round(ciUpper * 10000) / 10000,
          });
        }
      }
    }

    for (let i = 0; i < Math.min(benchmarkRuns.length - 1, 4); i++) {
      for (let j = i + 1; j < Math.min(benchmarkRuns.length, 5); j++) {
        const runA = benchmarkRuns[i];
        const runB = benchmarkRuns[j];

        const perQueryA: Record<string, number[]> = {};
        const perQueryB: Record<string, number[]> = {};

        for (const result of runA.results) {
          const rm = result.retrievalMetrics as Record<string, number> | null;
          if (rm) {
            for (const [key, val] of Object.entries(rm)) {
              if (typeof val === "number") {
                if (!perQueryA[key]) perQueryA[key] = [];
                perQueryA[key].push(val);
              }
            }
          }
        }

        for (const result of runB.results) {
          const rm = result.retrievalMetrics as Record<string, number> | null;
          if (rm) {
            for (const [key, val] of Object.entries(rm)) {
              if (typeof val === "number") {
                if (!perQueryB[key]) perQueryB[key] = [];
                perQueryB[key].push(val);
              }
            }
          }
        }

        for (const key of metricKeys) {
          const aValues = perQueryA[key] ?? [];
          const bValues = perQueryB[key] ?? [];
          if (aValues.length >= 2 && bValues.length >= 2) {
            try {
              const result = compareMetrics(aValues, bValues, key, runA.name || "A", runB.name || "B");
              totalComparisons++;
              if (result.significance.significant) {
                significantCount++;
                significantImprovements.push({
                  metric: key,
                  from: runB.name || "Unnamed",
                  to: runA.name || "Unnamed",
                  improvement: result.meanDifference,
                  pValue: result.significance.pValue,
                  effectSize: result.effectSize.magnitude,
                  ci: [result.bootstrapCI.ciLower, result.bootstrapCI.ciUpper],
                });
              }
            } catch {
              // skip
            }
          }
        }
      }
    }

    const configGroups = new Map<string, Set<string>>();
    for (const ci of confidenceIntervals) {
      const key = ci.metric;
      if (!configGroups.has(key)) configGroups.set(key, new Set());
      configGroups.get(key)!.add(ci.config);
    }

    for (const [metric, configs] of configGroups) {
      if (configs.size >= 2) {
        equivalentConfigurations.push({
          metric,
          configs: Array.from(configs),
        });
      }
    }

    return {
      significantImprovements: significantImprovements.slice(0, 10),
      equivalentConfigurations: equivalentConfigurations.slice(0, 10),
      confidenceIntervals: confidenceIntervals.slice(0, 20),
      summary: { totalComparisons, significantCount },
    };
  })();

  const intelligenceResult = analyzeResearchIntelligence(
    benchmarkRuns.map((r) => ({
      id: r.id,
      name: r.name,
      aggregatedMetrics: r.aggregatedMetrics as Record<string, number> | null,
      createdAt: r.createdAt,
      datasetName: r.dataset.name,
      questionCount: r.dataset._count.questions,
      results: r.results.map((res) => ({
        retrievalMetrics: res.retrievalMetrics as Record<string, number> | null,
        generationMetrics: res.generationMetrics as Record<string, number> | null,
        latencySearchMs: res.latencySearchMs,
      })),
    })) as IntelligenceRun[],
  );

  const researchScientistResult = generateResearchPaper({
    runs: benchmarkRuns.map((r) => ({
      id: r.id,
      name: r.name,
      aggregatedMetrics: r.aggregatedMetrics as Record<string, number> | null,
      createdAt: r.createdAt,
      datasetName: r.dataset.name,
      questionCount: r.dataset._count.questions,
      config: {} as Record<string, unknown>,
      results: r.results.map((res) => ({
        retrievalMetrics: res.retrievalMetrics as Record<string, number> | null,
        generationMetrics: res.generationMetrics as Record<string, number> | null,
        latencySearchMs: res.latencySearchMs,
      })),
    })),
    datasetName: benchmarkRuns[0]?.dataset.name ?? "Unknown",
    totalQuestions: benchmarkRuns[0]?.dataset._count.questions ?? 0,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold text-text-primary">Research Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          <strong className="text-text-primary">Purpose:</strong> Central hub for RAG research with automated intelligence and statistical analysis.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">Why it matters:</strong> Manual analysis of benchmark data is time-consuming and error-prone.
          The research intelligence engine automatically discovers patterns, detects trends, infers root causes, and suggests experiments.
        </p>
        <p className="mt-1 text-sm text-text-tertiary">
          <strong className="text-text-secondary">What you can learn:</strong> Which metrics are correlated. Whether performance is improving or declining over time.
          What configuration changes would have the most impact. Which experiments to run next.
        </p>
      </div>
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
      scientificAnalysis={scientificAnalysis}
      intelligenceResult={intelligenceResult}
      researchScientistResult={researchScientistResult}
    />
    </div>
  );
  } catch {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h1 className="text-lg font-semibold text-text-primary">Research Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Unable to load research data. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
