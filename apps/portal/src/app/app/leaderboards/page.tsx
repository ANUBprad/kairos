import { prisma } from "@/lib/prisma";
import { computeOverallScore } from "@/lib/evaluation/leaderboard";
import { LeaderboardsClient } from "./leaderboards-client";
import type { LeaderboardRowEntry } from "@/components/evaluation/leaderboards";

export const metadata = {
  title: "Leaderboards",
};

export default async function LeaderboardsPage() {
  let entries: LeaderboardRowEntry[] = [];

  try {
    const { ensureDefaultOrg } = await import("@/lib/server/organization");
    const result = await ensureDefaultOrg();
    if (result) {
      const runs = await prisma.benchmarkRun.findMany({
        where: {
          status: "completed",
          dataset: { knowledgeBase: { projectId: result.project.id } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          aggregatedMetrics: true,
          dataset: {
            select: { knowledgeBase: { select: { name: true } } },
          },
        },
      });

      const scored = runs
        .map((run) => {
          const m = (run.aggregatedMetrics as Record<string, number> | null) ?? {};
          const overallScore = computeOverallScore(
            m.avgRecallAtK ?? 0,
            m.avgPrecisionAtK ?? 0,
            m.avgHitRate ?? 0,
            m.avgMRR ?? 0,
            m.avgNDCG ?? 0,
            m.avgLatencyMs ?? 9999,
            m.avgFaithfulness,
          );
          return {
            name: run.name || "Unnamed run",
            workspaceName: run.dataset?.knowledgeBase?.name ?? null,
            overallScore,
            recallAtK: m.avgRecallAtK ?? 0,
            precisionAtK: m.avgPrecisionAtK ?? 0,
            hitRate: m.avgHitRate ?? 0,
            mrr: m.avgMRR ?? 0,
            ndcg: m.avgNDCG ?? 0,
            faithfulness: m.avgFaithfulness ?? null,
            latencyMs: m.avgLatencyMs ?? 0,
          };
        })
        .sort((a, b) => b.overallScore - a.overallScore)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      entries = scored;
    }
  } catch {
    entries = [];
  }

  return <LeaderboardsClient entries={entries} />;
}