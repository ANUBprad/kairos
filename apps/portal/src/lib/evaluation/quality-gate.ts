// Deterministic quality gate over a persisted regression comparison.
//
// The gate is a pure function of (comparison snapshot, explicit policy): it only
// reads the MachineRegressionResult that trackRegressionComparison persisted and
// the policy handed to it. It never re-runs the Slice B engine, never resamples
// anything, and never touches the database, so the same snapshot plus the same
// policy always yields the same outcome.
//
// Conventions. This reuses the two threshold conventions that already exist in
// the repo instead of inventing new ones:
//   - `tolerance` is an absolute delta the candidate may regress before the gate
//     fails, the same absolute-tolerance convention as check_regression() in
//     intelligence/evaluation/regression.py. The significance decision is
//     deferred to the engine's per-metric verdict: a metric the engine did not
//     call "regression" never fails the tolerance axis, and a metric it called
//     "regression" fails only when the deficit exceeds the tolerance.
//   - `min` / `max` are absolute floors and ceilings on the candidate mean, the
//     same gte / lte condition semantics as QualityGateCondition in
//     apps/portal/src/lib/quality-gates.ts, with directionality taken from the
//     persisted REGRESSION_METRICS definitions rather than restated per metric:
//     `min` is only valid on higher-is-better metrics, `max` only on
//     lower-is-better ones.
//
// Policy is explicit configuration (CI env or the documented default), never a
// database row: the DB-backed QualityGate CRUD is migration-orphaned and
// unwired from this comparison path (see EVALUATION_REGRESSION_PRODUCTIZATION_
// AUDIT P1-6 / P2-6), and a per-run DB policy would break the preferred
// "explicit config, zero schema change" shape.
//
// Outcomes are never silently merged: INSUFFICIENT_DATA (engine could not
// compare, or a policy metric lacks paired data) and INCOMPATIBLE (same run,
// unfinished run, or different datasets) are distinct, reported outcomes that
// FAIL CI unless the policy explicitly allows them through.
import { REGRESSION_METRICS } from "./regression";
import type { MachineRegressionResult } from "./regression-tracking";

export type QualityGateBlockBehavior = "block" | "allow";

/** One metric criterion: directionality comes from the metric definition. */
export interface QualityGateMetricCriterion {
  metric: string;
  /** Absolute delta the engine-reported regression may not exceed. */
  tolerance?: number;
  /** Floor on the candidate mean (higher-is-better metrics only). */
  min?: number;
  /** Ceiling on the candidate mean (lower-is-better metrics only). */
  max?: number;
}

export interface QualityGatePolicy {
  version: 1;
  name: string;
  onInsufficient: QualityGateBlockBehavior;
  onIncompatible: QualityGateBlockBehavior;
  metrics: QualityGateMetricCriterion[];
}

export type QualityGateOutcome = "PASS" | "FAIL" | "INSUFFICIENT_DATA" | "INCOMPATIBLE" | "INVALID_POLICY";

export type QualityGateCriterionState = "pass" | "fail" | "not_evaluated";

export interface QualityGateCriterionValues {
  pairedCount: number;
  baselineMean: number | null;
  candidateMean: number | null;
  delta: number | null;
  verdict: string;
}

export interface QualityGateCriterionResult {
  metric: string;
  policy: { tolerance: number | undefined; min: number | undefined; max: number | undefined };
  state: QualityGateCriterionState;
  reason: string | null;
  values: QualityGateCriterionValues | null;
}

export interface QualityGateResult {
  outcome: QualityGateOutcome;
  blocked: boolean;
  reason: string | null;
  errors: string[];
  criteria: QualityGateCriterionResult[];
  /** The full persisted comparison snapshot, preserved verbatim. */
  comparison: MachineRegressionResult;
}

// Explicit minimal policy: it enforces the comparison-state semantics only and
// claims no metric thresholds, so the CI default never hides an unverifiable or
// incompatible comparison behind a made-up number. Operators tighten it by
// supplying a policy through KAIROS_QUALITY_GATE_POLICY.
export const DEFAULT_QUALITY_GATE_POLICY: QualityGatePolicy = {
  version: 1,
  name: "default-state-only",
  onInsufficient: "block",
  onIncompatible: "block",
  metrics: [],
};

const METRIC_DEFS = new Map(REGRESSION_METRICS.map((def) => [def.key, def]));

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function validateQualityGatePolicy(policy: unknown): string[] {
  const errors: string[] = [];
  if (typeof policy !== "object" || policy === null || Array.isArray(policy)) {
    return ["policy must be an object"];
  }
  const p = policy as Record<string, unknown>;
  if (p.version !== 1) errors.push("policy version must be 1");
  if (typeof p.name !== "string" || p.name.trim() === "") errors.push("policy name must be a non-empty string");
  for (const field of ["onInsufficient", "onIncompatible"] as const) {
    if (p[field] !== "block" && p[field] !== "allow") errors.push(`${field} must be "block" or "allow"`);
  }
  if (!Array.isArray(p.metrics)) {
    errors.push("policy metrics must be an array (may be empty)");
    return errors;
  }
  for (const raw of p.metrics) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push("each metric criterion must be an object");
      continue;
    }
    const criterion = raw as Record<string, unknown>;
    const key = criterion.metric;
    if (typeof key !== "string" || !METRIC_DEFS.has(key)) {
      errors.push(`unknown metric key ${JSON.stringify(key)}`);
      continue;
    }
    const def = METRIC_DEFS.get(key)!;
    if (criterion.tolerance !== undefined) {
      if (!isFiniteNonNegative(criterion.tolerance)) errors.push(`${key}.tolerance must be a finite number >= 0`);
    }
    if (criterion.min !== undefined) {
      if (!isFiniteNonNegative(criterion.min)) {
        errors.push(`${key}.min must be a finite number >= 0`);
      } else if (!def.higherIsBetter) {
        errors.push(`${key}.min is only meaningful for higher-is-better metrics`);
      }
    }
    if (criterion.max !== undefined) {
      if (!isFiniteNonNegative(criterion.max)) {
        errors.push(`${key}.max must be a finite number >= 0`);
      } else if (def.higherIsBetter) {
        errors.push(`${key}.max is only meaningful for lower-is-better metrics`);
      }
    }
    if (criterion.min !== undefined && criterion.max !== undefined) errors.push(`${key}.min and ${key}.max cannot both be set`);
    for (const field of Object.keys(criterion)) {
      if (field !== "metric" && field !== "tolerance" && field !== "min" && field !== "max") {
        errors.push(`${key}: unknown criterion field ${field}`);
      }
    }
  }
  return errors;
}

export function parseQualityGatePolicyJson(json: string): { policy: QualityGatePolicy | null; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { policy: null, errors: [error instanceof Error ? error.message : "invalid JSON"] };
  }
  const errors = validateQualityGatePolicy(raw);
  if (errors.length > 0) return { policy: null, errors };
  return { policy: raw as unknown as QualityGatePolicy, errors: [] };
}

function criterionPolicy(criterion: QualityGateMetricCriterion): QualityGateCriterionResult["policy"] {
  return { tolerance: criterion.tolerance, min: criterion.min, max: criterion.max };
}

function evaluateCriterion(
  criterion: QualityGateMetricCriterion,
  metric: MachineRegressionResult["metrics"][number],
): QualityGateCriterionResult {
  const values: QualityGateCriterionValues = {
    pairedCount: metric.pairedCount,
    baselineMean: metric.baselineMean,
    candidateMean: metric.candidateMean,
    delta: metric.delta,
    verdict: metric.verdict,
  };
  const notEvaluated = (reason: string): QualityGateCriterionResult => ({
    metric: criterion.metric,
    policy: criterionPolicy(criterion),
    state: "not_evaluated",
    reason,
    values,
  });

  if (metric.verdict === "insufficient" || metric.candidateMean === null) {
    return notEvaluated(metric.verdict === "insufficient" ? "insufficient paired data" : "candidate mean unavailable");
  }

  if (criterion.tolerance !== undefined) {
    if (metric.delta === null) return notEvaluated("delta unavailable");
    // deficit is positive exactly when the candidate moved in the wrong
    // direction: a drop for higher-is-better, a rise for lower-is-better.
    const deficit = metric.higherIsBetter ? -metric.delta : metric.delta;
    if (metric.verdict === "regression" && deficit > criterion.tolerance) {
      return {
        metric: criterion.metric,
        policy: criterionPolicy(criterion),
        state: "fail",
        reason: `regression beyond tolerance (deficit ${deficit} > ${criterion.tolerance})`,
        values,
      };
    }
  }

  if (criterion.min !== undefined && metric.candidateMean < criterion.min) {
    return {
      metric: criterion.metric,
      policy: criterionPolicy(criterion),
      state: "fail",
      reason: `candidate mean below minimum (${metric.candidateMean} < ${criterion.min})`,
      values,
    };
  }
  if (criterion.max !== undefined && metric.candidateMean > criterion.max) {
    return {
      metric: criterion.metric,
      policy: criterionPolicy(criterion),
      state: "fail",
      reason: `candidate mean above maximum (${metric.candidateMean} > ${criterion.max})`,
      values,
    };
  }

  return { metric: criterion.metric, policy: criterionPolicy(criterion), state: "pass", reason: null, values };
}

export function evaluateQualityGate(comparison: MachineRegressionResult, policy: QualityGatePolicy): QualityGateResult {
  const errors = validateQualityGatePolicy(policy);
  if (errors.length > 0) {
    return {
      outcome: "INVALID_POLICY",
      blocked: true,
      reason: "invalid quality gate policy",
      errors,
      criteria: [],
      comparison,
    };
  }

  if (!comparison.ok) {
    return {
      outcome: "INCOMPATIBLE",
      blocked: policy.onIncompatible === "block",
      reason: comparison.error ? `incompatible comparison: ${comparison.error.reason}` : "incompatible comparison",
      errors: [],
      criteria: [],
      comparison,
    };
  }

  const byKey = new Map(comparison.metrics.map((m) => [m.key, m]));
  const criteria: QualityGateCriterionResult[] = policy.metrics.map((criterion) => {
    const metric = byKey.get(criterion.metric);
    if (!metric) {
      return {
        metric: criterion.metric,
        policy: criterionPolicy(criterion),
        state: "not_evaluated",
        reason: "metric missing from comparison snapshot",
        values: null,
      };
    }
    return evaluateCriterion(criterion, metric);
  });

  const failed = criteria.filter((c) => c.state === "fail");
  if (failed.length > 0) {
    const metrics = failed.map((c) => c.metric).join(", ");
    return {
      outcome: "FAIL",
      blocked: true,
      reason: `quality gate failed for metric(s): ${metrics}`,
      errors: [],
      criteria,
      comparison,
    };
  }

  const notEvaluated = criteria.filter((c) => c.state === "not_evaluated");
  if (comparison.state === "insufficient" || notEvaluated.length > 0) {
    const notEvaluatedReason =
      comparison.state === "insufficient"
        ? "comparison has insufficient paired data"
        : `${notEvaluated.length} ${notEvaluated.length === 1 ? "criterion" : "criteria"} not evaluated due to insufficient data`;
    return {
      outcome: "INSUFFICIENT_DATA",
      blocked: policy.onInsufficient === "block",
      reason: notEvaluatedReason,
      errors: [],
      criteria,
      comparison,
    };
  }

  return { outcome: "PASS", blocked: false, reason: null, errors: [], criteria, comparison };
}