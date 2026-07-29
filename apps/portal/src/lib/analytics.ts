import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QualityTrend {
  date: string;
  avgScore: number;
  passRate: number;
  totalRuns: number;
}

export interface LatencyTrend {
  date: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalRuns: number;
}

export interface CostTrend {
  date: string;
  totalCost: number;
  avgCostPerRun: number;
  totalTokens: number;
  totalRuns: number;
}

export interface PromptImprovement {
  promptId: string;
  promptTitle: string;
  versions: {
    version: number;
    score: number | null;
    publishedAt: Date | null;
    createdAt: Date;
  }[];
  latestScore: number | null;
  previousScore: number | null;
  delta: number | null;
}

export interface RegressionEntry {
  id: string;
  entity: string;
  type: string;
  currentScore: number;
  previousScore: number;
  regressionDelta: number;
  detectedAt: Date;
}

export interface LeaderboardMovement {
  entity: string;
  type: string;
  snapshots: {
    date: string;
    rank: number | null;
    score: number;
  }[];
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null;
}

export interface AnalyticsSummary {
  totalExperiments: number;
  totalBenchmarkRuns: number;
  totalEvaluations: number;
  overallPassRate: number;
  avgScore: number;
  totalPromptVersions: number;
  activeReviewCount: number;
  totalLeaderboardEntries: number;
  recentActivity: {
    date: string;
    experiments: number;
    benchmarkRuns: number;
    reviews: number;
  }[];
}

export interface EvaluationStats {
  totalEvaluations: number;
  passRate: number;
  avgScore: number;
  totalBenchmarkRuns: number;
  completedRuns: number;
  failedRuns: number;
}

export interface ResourceUsage {
  tokenUsage: {
    model: string;
    totalTokens: number;
    totalCost: number;
    runCount: number;
  }[];
  totalTokensAllModels: number;
  totalCostAllModels: number;
  totalApiCalls: number;
}

export interface TopPerformer {
  entity: string;
  score: number;
  rank: number | null;
  metrics: Record<string, unknown>;
}

// ─── Options ────────────────────────────────────────────────────────────────

export interface TrendOptions {
  startDate?: Date;
  endDate?: Date;
  entity?: string;
  type?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildDateFilter(startDate?: Date, endDate?: Date) {
  const filter: Record<string, unknown> = {};
  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.gte = startDate;
    if (endDate) range.lte = endDate;
    filter.createdAt = range;
  }
  return filter;
}

// ─── Functions ──────────────────────────────────────────────────────────────

export async function getQualityTrends(
  organizationId: string,
  options: TrendOptions = {},
): Promise<QualityTrend[]> {
  try {
    const dateFilter = buildDateFilter(options.startDate, options.endDate);

    const qualityResults = await prisma.qualityGateResult.findMany({
      where: {
        gate: { organizationId },
        ...dateFilter,
      },
      select: {
        score: true,
        passed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const byDate = new Map<
      string,
      { scores: number[]; passed: number; total: number }
    >();

    for (const result of qualityResults) {
      const date = result.createdAt.toISOString().split("T")[0];
      if (!date) continue;
      const entry = byDate.get(date) ?? { scores: [], passed: 0, total: 0 };
      entry.total += 1;
      if (result.passed) entry.passed += 1;
      if (result.score != null) entry.scores.push(result.score);
      byDate.set(date, entry);
    }

    return Array.from(byDate.entries()).map(([date, data]) => ({
      date,
      avgScore:
        data.scores.length > 0
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : 0,
      passRate: data.total > 0 ? data.passed / data.total : 0,
      totalRuns: data.total,
    }));
  } catch (error) {
    logger.error("Failed to get quality trends", {
      organizationId,
      error: String(error),
    });
    return [];
  }
}

export async function getLatencyTrends(
  organizationId: string,
  options: TrendOptions = {},
): Promise<LatencyTrend[]> {
  try {
    const dateFilter = buildDateFilter(options.startDate, options.endDate);

    const runs = await prisma.experimentRun.findMany({
      where: {
        knowledgeBase: {
          project: { organizationId },
        },
        totalLatency: { not: null },
        ...dateFilter,
      },
      select: {
        totalLatency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const byDate = new Map<string, number[]>();

    for (const run of runs) {
      const date = run.createdAt.toISOString().split("T")[0];
      if (!date || run.totalLatency == null) continue;
      const arr = byDate.get(date) ?? [];
      arr.push(run.totalLatency);
      byDate.set(date, arr);
    }

    return Array.from(byDate.entries()).map(([date, latencies]) => {
      const sorted = [...latencies].sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      const p95 = sorted[Math.max(0, p95Index)];
      return {
        date,
        avgLatencyMs: avg,
        p95LatencyMs: p95 ?? avg,
        totalRuns: sorted.length,
      };
    });
  } catch (error) {
    logger.error("Failed to get latency trends", {
      organizationId,
      error: String(error),
    });
    return [];
  }
}

export async function getCostTrends(
  organizationId: string,
  options: TrendOptions = {},
): Promise<CostTrend[]> {
  try {
    const dateFilter = buildDateFilter(options.startDate, options.endDate);

    const runs = await prisma.experimentRun.findMany({
      where: {
        knowledgeBase: {
          project: { organizationId },
        },
        cost: { not: null },
        ...dateFilter,
      },
      select: {
        cost: true,
        tokensUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const byDate = new Map<
      string,
      { costs: number[]; tokens: number[] }
    >();

    for (const run of runs) {
      const date = run.createdAt.toISOString().split("T")[0];
      if (!date) continue;
      const entry = byDate.get(date) ?? { costs: [], tokens: [] };
      if (run.cost != null) entry.costs.push(run.cost);
      if (run.tokensUsed != null) entry.tokens.push(run.tokensUsed);
      byDate.set(date, entry);
    }

    return Array.from(byDate.entries()).map(([date, data]) => {
      const totalCost = data.costs.reduce((a, b) => a + b, 0);
      return {
        date,
        totalCost,
        avgCostPerRun:
          data.costs.length > 0 ? totalCost / data.costs.length : 0,
        totalTokens: data.tokens.reduce((a, b) => a + b, 0),
        totalRuns: data.costs.length,
      };
    });
  } catch (error) {
    logger.error("Failed to get cost trends", {
      organizationId,
      error: String(error),
    });
    return [];
  }
}

export async function getPromptImprovements(
  organizationId: string,
): Promise<PromptImprovement[]> {
  try {
    const prompts = await prisma.prompt.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        versions: {
          select: {
            version: true,
            metadata: true,
            status: true,
            publishedAt: true,
            createdAt: true,
          },
          orderBy: { version: "asc" },
        },
      },
    });

    return prompts.map((prompt) => {
      const sortedVersions = prompt.versions;
      const publishedVersions = sortedVersions.filter(
        (v) => v.status === "PUBLISHED",
      );

      const scores = publishedVersions.map((v) => {
        const meta = v.metadata as Record<string, unknown> | null;
        return typeof meta?.score === "number" ? meta.score : null;
      });

      const validScores = scores.filter((s): s is number => s != null);

      return {
        promptId: prompt.id,
        promptTitle: prompt.title,
        versions: sortedVersions.map((v) => ({
          version: v.version,
          score:
            typeof (v.metadata as Record<string, unknown> | null)?.score ===
            "number"
              ? ((v.metadata as Record<string, unknown>).score as number)
              : null,
          publishedAt: v.publishedAt,
          createdAt: v.createdAt,
        })),
        latestScore: validScores.length > 0 ? validScores[validScores.length - 1] : null,
        previousScore: validScores.length > 1 ? validScores[validScores.length - 2] : null,
        delta:
          validScores.length > 1
            ? validScores[validScores.length - 1] - validScores[validScores.length - 2]
            : null,
      };
    });
  } catch (error) {
    logger.error("Failed to get prompt improvements", {
      organizationId,
      error: String(error),
    });
    return [];
  }
}

export async function getRegressionHistory(
  organizationId: string,
): Promise<RegressionEntry[]> {
  try {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    const byEntity = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = `${entry.entity}:${entry.type}`;
      const arr = byEntity.get(key) ?? [];
      arr.push(entry);
      byEntity.set(key, arr);
    }

    const regressions: RegressionEntry[] = [];

    for (const entityEntries of Array.from(byEntity.values())) {
      if (entityEntries.length < 2) continue;

      const sorted = entityEntries.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const current = sorted[0];
      const previous = sorted[1];

      if (!current || !previous) continue;

      const delta = current.score - previous.score;
      if (delta < 0) {
        regressions.push({
          id: current.id,
          entity: current.entity,
          type: current.type,
          currentScore: current.score,
          previousScore: previous.score,
          regressionDelta: delta,
          detectedAt: current.createdAt,
        });
      }
    }

    return regressions.sort(
      (a, b) => a.regressionDelta - b.regressionDelta,
    );
  } catch (error) {
    logger.error("Failed to get regression history", {
      organizationId,
      error: String(error),
    });
    return [];
  }
}

export async function getLeaderboardMovement(
  organizationId: string,
  type: string,
): Promise<LeaderboardMovement[]> {
  try {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { organizationId, type },
      orderBy: { createdAt: "asc" },
    });

    const byEntity = new Map<string, typeof entries>();
    for (const entry of entries) {
      const arr = byEntity.get(entry.entity) ?? [];
      arr.push(entry);
      byEntity.set(entry.entity, arr);
    }

    return Array.from(byEntity.entries()).map(([entity, snapshots]) => {
      const current = snapshots[snapshots.length - 1];
      const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

      return {
        entity,
        type,
        snapshots: snapshots.map((s) => ({
          date: s.createdAt.toISOString().split("T")[0]!,
          rank: s.rank,
          score: s.score,
        })),
        currentRank: current?.rank ?? null,
        previousRank: previous?.rank ?? null,
        rankChange:
          current?.rank != null && previous?.rank != null
            ? previous.rank - current.rank
            : null,
      };
    });
  } catch (error) {
    logger.error("Failed to get leaderboard movement", {
      organizationId,
      type,
      error: String(error),
    });
    return [];
  }
}

export async function getAnalyticsSummary(
  organizationId: string,
): Promise<AnalyticsSummary> {
  try {
    const [
      totalExperiments,
      totalBenchmarkRuns,
      qualityResults,
      promptVersions,
      activeReviews,
      leaderboardEntries,
      recentExperiments,
      recentBenchmarkRuns,
      recentReviews,
    ] = await Promise.all([
      prisma.experiment.count({
        where: { knowledgeBase: { project: { organizationId } } },
      }),
      prisma.benchmarkRun.count({
        where: {
          dataset: {
            knowledgeBase: { project: { organizationId } },
          },
        },
      }),
      prisma.qualityGateResult.findMany({
        where: { gate: { organizationId } },
        select: { score: true, passed: true },
      }),
      prisma.promptVersion.count({
        where: { prompt: { organizationId } },
      }),
      prisma.reviewQueue.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_REVIEW"] },
        },
      }),
      prisma.leaderboardEntry.count({ where: { organizationId } }),
      prisma.experiment.findMany({
        where: {
          knowledgeBase: { project: { organizationId } },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.benchmarkRun.findMany({
        where: {
          dataset: { knowledgeBase: { project: { organizationId } } },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.reviewQueue.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const totalEvaluations = qualityResults.length;
    const passedCount = qualityResults.filter((r) => r.passed).length;
    const overallPassRate =
      totalEvaluations > 0 ? passedCount / totalEvaluations : 0;
    const scores = qualityResults
      .map((r) => r.score)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    const activityByDate = new Map<
      string,
      { experiments: number; benchmarkRuns: number; reviews: number }
    >();

    for (const exp of recentExperiments) {
      const date = exp.createdAt.toISOString().split("T")[0]!;
      const entry = activityByDate.get(date) ?? {
        experiments: 0,
        benchmarkRuns: 0,
        reviews: 0,
      };
      entry.experiments += 1;
      activityByDate.set(date, entry);
    }

    for (const run of recentBenchmarkRuns) {
      const date = run.createdAt.toISOString().split("T")[0]!;
      const entry = activityByDate.get(date) ?? {
        experiments: 0,
        benchmarkRuns: 0,
        reviews: 0,
      };
      entry.benchmarkRuns += 1;
      activityByDate.set(date, entry);
    }

    for (const review of recentReviews) {
      const date = review.createdAt.toISOString().split("T")[0]!;
      const entry = activityByDate.get(date) ?? {
        experiments: 0,
        benchmarkRuns: 0,
        reviews: 0,
      };
      entry.reviews += 1;
      activityByDate.set(date, entry);
    }

    return {
      totalExperiments,
      totalBenchmarkRuns,
      totalEvaluations,
      overallPassRate,
      avgScore,
      totalPromptVersions: promptVersions,
      activeReviewCount: activeReviews,
      totalLeaderboardEntries: leaderboardEntries,
      recentActivity: Array.from(activityByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (error) {
    logger.error("Failed to get analytics summary", {
      organizationId,
      error: String(error),
    });
    return {
      totalExperiments: 0,
      totalBenchmarkRuns: 0,
      totalEvaluations: 0,
      overallPassRate: 0,
      avgScore: 0,
      totalPromptVersions: 0,
      activeReviewCount: 0,
      totalLeaderboardEntries: 0,
      recentActivity: [],
    };
  }
}

export async function getEvaluationStats(
  organizationId: string,
): Promise<EvaluationStats> {
  try {
    const [benchmarkRunStats, qualityResults] = await Promise.all([
      prisma.benchmarkRun.groupBy({
        by: ["status"],
        where: {
          dataset: { knowledgeBase: { project: { organizationId } } },
        },
        _count: { id: true },
      }),
      prisma.qualityGateResult.findMany({
        where: { gate: { organizationId } },
        select: { score: true, passed: true },
      }),
    ]);

    const completedRuns =
      benchmarkRunStats.find((g) => g.status === "completed")?._count.id ?? 0;
    const failedRuns =
      benchmarkRunStats.find((g) => g.status === "failed")?._count.id ?? 0;
    const totalBenchmarkRuns = benchmarkRunStats.reduce(
      (acc, g) => acc + g._count.id,
      0,
    );

    const totalEvaluations = qualityResults.length;
    const passedCount = qualityResults.filter((r) => r.passed).length;
    const passRate =
      totalEvaluations > 0 ? passedCount / totalEvaluations : 0;

    const scores = qualityResults
      .map((r) => r.score)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    return {
      totalEvaluations,
      passRate,
      avgScore,
      totalBenchmarkRuns,
      completedRuns,
      failedRuns,
    };
  } catch (error) {
    logger.error("Failed to get evaluation stats", {
      organizationId,
      error: String(error),
    });
    return {
      totalEvaluations: 0,
      passRate: 0,
      avgScore: 0,
      totalBenchmarkRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
    };
  }
}

export async function getResourceUsage(
  organizationId: string,
): Promise<ResourceUsage> {
  try {
    const runs = await prisma.experimentRun.findMany({
      where: {
        knowledgeBase: { project: { organizationId } },
        tokensUsed: { not: null },
      },
      select: {
        embeddingModel: true,
        tokensUsed: true,
        cost: true,
      },
    });

    const byModel = new Map<
      string,
      { totalTokens: number; totalCost: number; runCount: number }
    >();

    let totalTokensAllModels = 0;
    let totalCostAllModels = 0;

    for (const run of runs) {
      const model = run.embeddingModel ?? "unknown";
      const entry = byModel.get(model) ?? {
        totalTokens: 0,
        totalCost: 0,
        runCount: 0,
      };
      entry.runCount += 1;
      if (run.tokensUsed != null) {
        entry.totalTokens += run.tokensUsed;
        totalTokensAllModels += run.tokensUsed;
      }
      if (run.cost != null) {
        entry.totalCost += run.cost;
        totalCostAllModels += run.cost;
      }
      byModel.set(model, entry);
    }

    return {
      tokenUsage: Array.from(byModel.entries()).map(([model, data]) => ({
        model,
        totalTokens: data.totalTokens,
        totalCost: data.totalCost,
        runCount: data.runCount,
      })),
      totalTokensAllModels,
      totalCostAllModels,
      totalApiCalls: runs.length,
    };
  } catch (error) {
    logger.error("Failed to get resource usage", {
      organizationId,
      error: String(error),
    });
    return {
      tokenUsage: [],
      totalTokensAllModels: 0,
      totalCostAllModels: 0,
      totalApiCalls: 0,
    };
  }
}

export async function getTopPerformers(
  organizationId: string,
  type: string,
  limit: number = 10,
): Promise<TopPerformer[]> {
  try {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { organizationId, type },
      orderBy: { score: "desc" },
      take: limit,
    });

    return entries.map((entry) => ({
      entity: entry.entity,
      score: entry.score,
      rank: entry.rank,
      metrics: (entry.metrics as Record<string, unknown>) ?? {},
    }));
  } catch (error) {
    logger.error("Failed to get top performers", {
      organizationId,
      type,
      error: String(error),
    });
    return [];
  }
}
