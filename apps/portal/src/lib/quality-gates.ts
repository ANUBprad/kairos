/**
 * Quality Gates Library
 *
 * Provides CRUD operations, evaluation, and result tracking for quality gates
 * used to enforce metric thresholds across evaluation runs.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

export interface QualityGateCondition {
  metric: string;
  operator: ComparisonOperator;
  value: number;
}

export interface QualityGateInfo {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  organizationId: string;
  conditions: QualityGateCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityGateResultInfo {
  id: string;
  passed: boolean;
  results: Record<string, ConditionResult>;
  score: number | null;
  gateId: string;
  evaluationRunId: string | null;
  createdAt: Date;
}

export interface ConditionResult {
  metric: string;
  operator: ComparisonOperator;
  threshold: number;
  actual: number;
  passed: boolean;
}

export interface GateCheckResult {
  gateId: string;
  gateName: string;
  passed: boolean;
  results: ConditionResult[];
  score: number;
}

// ============================================================================
// Helpers
// ============================================================================

function evaluateCondition(
  condition: QualityGateCondition,
  metrics: Record<string, number>,
): ConditionResult {
  const actual = metrics[condition.metric];

  if (actual === undefined) {
    return {
      metric: condition.metric,
      operator: condition.operator,
      threshold: condition.value,
      actual: NaN,
      passed: false,
    };
  }

  let passed: boolean;
  switch (condition.operator) {
    case "gt":
      passed = actual > condition.value;
      break;
    case "gte":
      passed = actual >= condition.value;
      break;
    case "lt":
      passed = actual < condition.value;
      break;
    case "lte":
      passed = actual <= condition.value;
      break;
    case "eq":
      passed = actual === condition.value;
      break;
    case "neq":
      passed = actual !== condition.value;
      break;
    default:
      passed = false;
  }

  return {
    metric: condition.metric,
    operator: condition.operator,
    threshold: condition.value,
    actual,
    passed,
  };
}

function parseConditions(raw: unknown): QualityGateCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw as QualityGateCondition[];
}

function toGateInfo(gate: {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  organizationId: string;
  conditions: unknown;
  createdAt: Date;
  updatedAt: Date;
}): QualityGateInfo {
  return {
    id: gate.id,
    name: gate.name,
    description: gate.description,
    enabled: gate.enabled,
    organizationId: gate.organizationId,
    conditions: parseConditions(gate.conditions),
    createdAt: gate.createdAt,
    updatedAt: gate.updatedAt,
  };
}

// ============================================================================
// Gate CRUD
// ============================================================================

export async function createGate(
  organizationId: string,
  input: {
    name: string;
    description?: string;
    conditions: QualityGateCondition[];
  },
): Promise<QualityGateInfo> {
  logger.info("Creating quality gate", {
    organizationId,
    name: input.name,
    conditionCount: input.conditions.length,
  });

  const gate = await prisma.qualityGate.create({
    data: {
      name: input.name,
      description: input.description,
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
      organizationId,
    },
  });

  return toGateInfo(gate);
}

export async function getGate(
  gateId: string,
): Promise<QualityGateInfo | null> {
  const gate = await prisma.qualityGate.findUnique({
    where: { id: gateId },
  });

  if (!gate) return null;
  return toGateInfo(gate);
}

export async function listGates(
  organizationId: string,
): Promise<QualityGateInfo[]> {
  const gates = await prisma.qualityGate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return gates.map(toGateInfo);
}

export async function updateGate(
  gateId: string,
  input: {
    name?: string;
    description?: string;
    conditions?: QualityGateCondition[];
  },
): Promise<QualityGateInfo> {
  const gate = await prisma.qualityGate.update({
    where: { id: gateId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.conditions !== undefined && { conditions: input.conditions as unknown as Prisma.InputJsonValue }),
    },
  });

  return toGateInfo(gate);
}

export async function deleteGate(gateId: string): Promise<boolean> {
  try {
    await prisma.qualityGate.delete({ where: { id: gateId } });
    return true;
  } catch {
    return false;
  }
}

export async function toggleGate(
  gateId: string,
  enabled: boolean,
): Promise<QualityGateInfo> {
  const gate = await prisma.qualityGate.update({
    where: { id: gateId },
    data: { enabled },
  });

  return toGateInfo(gate);
}

// ============================================================================
// Gate Evaluation
// ============================================================================

export function checkGate(
  gateId: string,
  metrics: Record<string, number>,
  gate?: QualityGateInfo,
): GateCheckResult {
  const conditions = gate ? gate.conditions : [];

  const results = conditions.map((c) => evaluateCondition(c, metrics));
  const passed = results.length > 0 && results.every((r) => r.passed);
  const score =
    results.length > 0
      ? results.filter((r) => r.passed).length / results.length
      : 0;

  return {
    gateId,
    gateName: gate?.name ?? gateId,
    passed,
    results,
    score,
  };
}

export async function checkAllGates(
  organizationId: string,
  metrics: Record<string, number>,
): Promise<GateCheckResult[]> {
  const gates = await prisma.qualityGate.findMany({
    where: { organizationId, enabled: true },
  });

  return gates.map((g) => {
    const info = toGateInfo(g);
    return checkGate(info.id, metrics, info);
  });
}

// ============================================================================
// Result Recording & History
// ============================================================================

export async function recordResult(
  gateId: string,
  passed: boolean,
  results: Record<string, ConditionResult>,
  score?: number,
  evaluationRunId?: string,
): Promise<QualityGateResultInfo> {
  const result = await prisma.qualityGateResult.create({
    data: {
      gateId,
      passed,
      results: results as unknown as Prisma.InputJsonValue,
      score: score ?? null,
      evaluationRunId: evaluationRunId ?? null,
    },
  });

  return {
    id: result.id,
    passed: result.passed,
    results: result.results as unknown as Record<string, ConditionResult>,
    score: result.score,
    gateId: result.gateId,
    evaluationRunId: result.evaluationRunId,
    createdAt: result.createdAt,
  };
}

export async function getGateResults(
  gateId: string,
  options?: { limit?: number; offset?: number },
): Promise<QualityGateResultInfo[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const results = await prisma.qualityGateResult.findMany({
    where: { gateId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return results.map((r) => ({
    id: r.id,
    passed: r.passed,
    results: r.results as unknown as Record<string, ConditionResult>,
    score: r.score,
    gateId: r.gateId,
    evaluationRunId: r.evaluationRunId,
    createdAt: r.createdAt,
  }));
}

// ============================================================================
// Aggregate Stats
// ============================================================================

export interface GateStats {
  totalGates: number;
  enabledGates: number;
  totalResults: number;
  passedResults: number;
  failedResults: number;
  passRate: number;
}

export async function getGateStats(
  organizationId: string,
): Promise<GateStats> {
  const [totalGates, enabledGates, totalResults, passedResults] =
    await Promise.all([
      prisma.qualityGate.count({
        where: { organizationId },
      }),
      prisma.qualityGate.count({
        where: { organizationId, enabled: true },
      }),
      prisma.qualityGateResult.count({
        where: { gate: { organizationId } },
      }),
      prisma.qualityGateResult.count({
        where: { gate: { organizationId }, passed: true },
      }),
    ]);

  return {
    totalGates,
    enabledGates,
    totalResults,
    passedResults,
    failedResults: totalResults - passedResults,
    passRate: totalResults > 0 ? passedResults / totalResults : 0,
  };
}
