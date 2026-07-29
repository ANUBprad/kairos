"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import {
  getQualityTrends,
  getLatencyTrends,
  getCostTrends,
  getPromptImprovements,
  getRegressionHistory,
  getLeaderboardMovement,
  getAnalyticsSummary,
  getEvaluationStats,
  getResourceUsage,
  getTopPerformers,
  type TrendOptions,
} from "@/lib/analytics";
import { logger } from "@/lib/logger";

const ORG_ID = "demo-org";

export async function getQualityTrendsAction(options: TrendOptions = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const trends = await getQualityTrends(ORG_ID, options);
    return { success: true, trends };
  } catch (error) {
    logger.error("Failed to get quality trends", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get quality trends",
      trends: [],
    };
  }
}

export async function getLatencyTrendsAction(options: TrendOptions = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const trends = await getLatencyTrends(ORG_ID, options);
    return { success: true, trends };
  } catch (error) {
    logger.error("Failed to get latency trends", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get latency trends",
      trends: [],
    };
  }
}

export async function getCostTrendsAction(options: TrendOptions = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const trends = await getCostTrends(ORG_ID, options);
    return { success: true, trends };
  } catch (error) {
    logger.error("Failed to get cost trends", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get cost trends",
      trends: [],
    };
  }
}

export async function getPromptImprovementsAction() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const improvements = await getPromptImprovements(ORG_ID);
    return { success: true, improvements };
  } catch (error) {
    logger.error("Failed to get prompt improvements", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get prompt improvements",
      improvements: [],
    };
  }
}

export async function getRegressionHistoryAction() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const regressions = await getRegressionHistory(ORG_ID);
    return { success: true, regressions };
  } catch (error) {
    logger.error("Failed to get regression history", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get regression history",
      regressions: [],
    };
  }
}

export async function getLeaderboardMovementAction(type: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const movement = await getLeaderboardMovement(ORG_ID, type);
    return { success: true, movement };
  } catch (error) {
    logger.error("Failed to get leaderboard movement", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get leaderboard movement",
      movement: [],
    };
  }
}

export async function getAnalyticsSummaryAction() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const summary = await getAnalyticsSummary(ORG_ID);
    return { success: true, summary };
  } catch (error) {
    logger.error("Failed to get analytics summary", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get analytics summary",
      summary: null,
    };
  }
}

export async function getEvaluationStatsAction() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const stats = await getEvaluationStats(ORG_ID);
    return { success: true, stats };
  } catch (error) {
    logger.error("Failed to get evaluation stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get evaluation stats",
      stats: null,
    };
  }
}

export async function getResourceUsageAction() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const usage = await getResourceUsage(ORG_ID);
    return { success: true, usage };
  } catch (error) {
    logger.error("Failed to get resource usage", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get resource usage",
      usage: null,
    };
  }
}

export async function getTopPerformersAction(type: string, limit?: number) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const performers = await getTopPerformers(ORG_ID, type, limit);
    return { success: true, performers };
  } catch (error) {
    logger.error("Failed to get top performers", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get top performers",
      performers: [],
    };
  }
}
