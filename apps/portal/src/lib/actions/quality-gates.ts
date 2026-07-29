"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import {
  createGate,
  getGate,
  listGates,
  updateGate,
  deleteGate,
  toggleGate,
  checkGate,
  checkAllGates,
  recordResult,
  getGateResults,
  getGateStats,
  type QualityGateCondition,
  type ConditionResult,
} from "@/lib/quality-gates";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

const DEMO_ORG = "demo-org";

// ============================================================================
// Quality Gates Actions
// ============================================================================

export async function createQualityGate(input: {
  name: string;
  description?: string;
  conditions: QualityGateCondition[];
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gate = await createGate(DEMO_ORG, input);
    revalidatePath("/app/quality-gates");
    return { success: true, ...gate };
  } catch (error) {
    logger.error("Failed to create quality gate", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create quality gate",
    };
  }
}

export async function getQualityGate(gateId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gate = await getGate(gateId);
    if (!gate) {
      return { success: false, error: "Quality gate not found" };
    }
    return { success: true, ...gate };
  } catch (error) {
    logger.error("Failed to get quality gate", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get quality gate",
    };
  }
}

export async function listQualityGates() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gates = await listGates(DEMO_ORG);
    return { success: true, gates };
  } catch (error) {
    logger.error("Failed to list quality gates", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list quality gates",
    };
  }
}

export async function updateQualityGate(
  gateId: string,
  input: {
    name?: string;
    description?: string;
    conditions?: QualityGateCondition[];
  },
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gate = await updateGate(gateId, input);
    revalidatePath("/app/quality-gates");
    return { success: true, ...gate };
  } catch (error) {
    logger.error("Failed to update quality gate", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update quality gate",
    };
  }
}

export async function deleteQualityGate(gateId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const deleted = await deleteGate(gateId);
    revalidatePath("/app/quality-gates");
    return { success: deleted };
  } catch (error) {
    logger.error("Failed to delete quality gate", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete quality gate",
    };
  }
}

export async function toggleQualityGate(gateId: string, enabled: boolean) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gate = await toggleGate(gateId, enabled);
    revalidatePath("/app/quality-gates");
    return { success: true, ...gate };
  } catch (error) {
    logger.error("Failed to toggle quality gate", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
      enabled,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle quality gate",
    };
  }
}

export async function checkQualityGate(
  gateId: string,
  metrics: Record<string, number>,
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const gate = await getGate(gateId);
    if (!gate) {
      return { success: false, error: "Quality gate not found" };
    }

    const result = checkGate(gateId, metrics, gate);
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to check quality gate", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check quality gate",
    };
  }
}

export async function checkAllQualityGates(
  metrics: Record<string, number>,
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const results = await checkAllGates(DEMO_ORG, metrics);
    return { success: true, results };
  } catch (error) {
    logger.error("Failed to check all quality gates", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check all quality gates",
    };
  }
}

export async function recordQualityGateResult(
  gateId: string,
  passed: boolean,
  results: Record<string, ConditionResult>,
  score?: number,
  evaluationRunId?: string,
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const result = await recordResult(gateId, passed, results, score, evaluationRunId);
    revalidatePath("/app/quality-gates");
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to record quality gate result", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record quality gate result",
    };
  }
}

export async function getQualityGateResults(
  gateId: string,
  options?: { limit?: number; offset?: number },
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const results = await getGateResults(gateId, options);
    return { success: true, results };
  } catch (error) {
    logger.error("Failed to get quality gate results", {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get quality gate results",
    };
  }
}

export async function getQualityGateStats() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const stats = await getGateStats(DEMO_ORG);
    return { success: true, ...stats };
  } catch (error) {
    logger.error("Failed to get quality gate stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get quality gate stats",
    };
  }
}
