import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REGRESSION_METRICS } from "@/lib/evaluation/regression";
import type { MachineRegressionMetric, MachineRegressionResult } from "@/lib/evaluation/regression-tracking";
import {
  evaluateQualityGate,
  validateQualityGatePolicy,
  parseQualityGatePolicyJson,
  type QualityGatePolicy,
} from "@/lib/evaluation/quality-gate";

function makeMachine(
  overrides: Partial<MachineRegressionResult> = {},
  metricOverrides: Record<string, Partial<MachineRegressionMetric>> = {},
): MachineRegressionResult {
  const metrics: MachineRegressionMetric[] = REGRESSION_METRICS.map((def) => {
    const latency = !def.higherIsBetter;
    return {
      key: def.key,
      label: def.label,
      higherIsBetter: def.higherIsBetter,
      pairedCount: 8,
      baselineMean: latency ? 400 : 0.4,
      candidateMean: latency ? 380 : 0.6,
      delta: latency ? -20 : 0.2,
      pValue: 0.005,
      testUsed: "paired-t-test",
      effectSizeMagnitude: "large",
      ciLower: latency ? -28 : 0.1,
      ciUpper: latency ? -12 : 0.3,
      interpretation: "candidate improved",
      verdict: "improvement",
      ...(metricOverrides[def.key] ?? {}),
    };
  });
  return {
    ok: true,
    state: "compatible",
    error: null,
    baseline: {
      runId: "baseline-run",
      name: "Baseline",
      status: "completed",
      datasetId: "dataset-1",
      datasetName: "Dataset",
      createdAt: "2026-01-01T00:00:00.000Z",
      observationCount: 8,
    },
    candidate: {
      runId: "candidate-run",
      name: "Candidate",
      status: "completed",
      datasetId: "dataset-1",
      datasetName: "Dataset",
      createdAt: "2026-01-02T00:00:00.000Z",
      observationCount: 8,
    },
    alignment: { shared: 8, baselineOnly: 0, candidateOnly: 0 },
    overall: { verdict: "improvement", regressed: 0, improved: 11, unchanged: 0, insufficient: 0 },
    metrics,
    ...overrides,
  };
}

function policy(overrides: Partial<QualityGatePolicy> = {}): QualityGatePolicy {
  return {
    version: 1,
    name: "test-policy",
    onInsufficient: "block",
    onIncompatible: "block",
    metrics: [],
    ...overrides,
  };
}

function recallRegression(delta: number, candidateMean: number): Partial<MachineRegressionMetric> {
  return {
    baselineMean: candidateMean - delta,
    candidateMean,
    delta,
    verdict: "regression",
  };
}

describe("evaluation quality gate", () => {
  it("PASS: every criterion satisfied on a compatible comparison", () => {
    const result = evaluateQualityGate(
      makeMachine(),
      policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }, { metric: "ndcg", min: 0.4 }] }),
    );
    assert.equal(result.outcome, "PASS");
    assert.equal(result.blocked, false);
    assert.equal(result.reason, null);
    assert.deepEqual(result.errors, []);
    assert.equal(result.criteria.length, 2);
    assert.ok(result.criteria.every((c) => c.state === "pass" && c.reason === null));
  });

  it("FAIL: regression beyond tolerance", () => {
    const result = evaluateQualityGate(
      makeMachine({}, { recallAtK: recallRegression(-0.2, 0.3) }),
      policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] }),
    );
    assert.equal(result.outcome, "FAIL");
    assert.equal(result.blocked, true);
    assert.match(result.reason!, /recallAtK/);
    const criterion = result.criteria.find((c) => c.metric === "recallAtK")!;
    assert.equal(criterion.state, "fail");
    assert.match(criterion.reason!, /regression beyond tolerance/);
  });

  it("FAIL: candidate mean below minimum", () => {
    const result = evaluateQualityGate(
      makeMachine({}, { recallAtK: { candidateMean: 0.66, verdict: "no_significant_change" } }),
      policy({ metrics: [{ metric: "recallAtK", min: 0.99 }] }),
    );
    assert.equal(result.outcome, "FAIL");
    assert.equal(result.blocked, true);
    assert.match(result.criteria[0].reason!, /candidate mean below minimum/);
  });

  it("directionality: a higher-is-better improvement never fails the tolerance axis", () => {
    const result = evaluateQualityGate(
      makeMachine({}, { recallAtK: { delta: 0.4, verdict: "improvement" } }),
      policy({ metrics: [{ metric: "recallAtK", tolerance: 0.01 }] }),
    );
    assert.equal(result.outcome, "PASS");
  });

  it("directionality: lower-is-better metric enforces max and rejects min", () => {
    const passing = evaluateQualityGate(
      makeMachine(),
      policy({ metrics: [{ metric: "latencySearchMs", max: 500 }] }),
    );
    assert.equal(passing.outcome, "PASS");
    assert.equal(
      validateQualityGatePolicy(policy({ metrics: [{ metric: "latencySearchMs", min: 100 }] })).some(
        (e) => e === "latencySearchMs.min is only meaningful for higher-is-better metrics",
      ),
      true,
    );
  });

  it("INVALID_POLICY: non-finite, negative, and malformed values are rejected with machine-readable errors", () => {
    const cases: Array<Record<string, unknown>> = [
      { metric: "recallAtK", tolerance: Number.NaN },
      { metric: "recallAtK", tolerance: Number.POSITIVE_INFINITY },
      { metric: "recallAtK", min: -0.1 },
      { metric: "recallAtK", max: Number.NEGATIVE_INFINITY },
      { metric: "recallAtK", tolerance: -1 },
    ];
    for (const bad of cases) {
      const errors = validateQualityGatePolicy(policy({ metrics: [bad as never] }));
      assert.ok(errors.length > 0, JSON.stringify(bad));
      assert.ok(errors.every((e) => typeof e === "string" && e.length > 0));
    }
    assert.ok(validateQualityGatePolicy(policy({ metrics: [{ metric: "notAMetric", tolerance: 0.05 }] })).some((e) => /unknown metric key/.test(e)));
    assert.ok(validateQualityGatePolicy({ ...policy(), version: 2 }).some((e) => /version/.test(e)));
    assert.ok(validateQualityGatePolicy({ ...policy(), onInsufficient: "maybe" }).some((e) => /onInsufficient/.test(e)));
    assert.ok(validateQualityGatePolicy({ ...policy(), metrics: [{ metric: "recallAtK", max: 0.5, min: 0.4 }] }).some((e) => /cannot both be set/.test(e)));
    assert.ok(
      validateQualityGatePolicy({
        ...policy(),
        metrics: [{ metric: "recallAtK", tolerance: 0.05, direction: "up" } as unknown as QualityGatePolicy["metrics"][number]],
      }).some((e) => /unknown criterion field/.test(e)),
    );

    const parse = parseQualityGatePolicyJson("{not json");
    assert.equal(parse.policy, null);
    assert.ok(parse.errors.length > 0);
    const parsed = parseQualityGatePolicyJson(
      JSON.stringify(policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] })),
    );
    assert.ok(parsed.policy);
    assert.deepEqual(parsed.errors, []);
  });

  it("INSUFFICIENT_DATA: comparison with insufficient paired data is explicit, never a silent pass", () => {
    const blocked = evaluateQualityGate(
      makeMachine({
        state: "insufficient",
        overall: { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 11 },
      }),
      policy(),
    );
    assert.equal(blocked.outcome, "INSUFFICIENT_DATA");
    assert.equal(blocked.blocked, true);
    assert.match(blocked.reason!, /insufficient paired data/);

    const allowed = evaluateQualityGate(
      makeMachine({
        state: "insufficient",
        overall: { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 11 },
      }),
      policy({ onInsufficient: "allow" }),
    );
    assert.equal(allowed.outcome, "INSUFFICIENT_DATA");
    assert.equal(allowed.blocked, false);
  });

  it("INSUFFICIENT_DATA: a policy metric without paired data is not_evaluated and blocks by default", () => {
    const result = evaluateQualityGate(
      makeMachine({}, { recallAtK: { pairedCount: 0, baselineMean: null, candidateMean: null, delta: null, verdict: "insufficient" } }),
      policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] }),
    );
    assert.equal(result.outcome, "INSUFFICIENT_DATA");
    assert.equal(result.blocked, true);
    assert.equal(result.criteria[0].state, "not_evaluated");
    assert.match(result.criteria[0].reason!, /insufficient paired data/);
  });

  it("INCOMPATIBLE: incompatible comparisons are distinct and never silently pass", () => {
    const incompatible = makeMachine({
      ok: false,
      state: "incompatible",
      error: { reason: "same_run" },
    });
    const blocked = evaluateQualityGate(incompatible, policy());
    assert.equal(blocked.outcome, "INCOMPATIBLE");
    assert.equal(blocked.blocked, true);
    assert.match(blocked.reason!, /same_run/);

    const allowed = evaluateQualityGate(incompatible, policy({ onIncompatible: "allow" }));
    assert.equal(allowed.outcome, "INCOMPATIBLE");
    assert.equal(allowed.blocked, false);
  });

  it("one failing metric among many yields a clear, attributed failure", () => {
    const result = evaluateQualityGate(
      makeMachine({}, { recallAtK: recallRegression(-0.2, 0.3) }),
      policy({
        metrics: [
          { metric: "recallAtK", tolerance: 0.05 },
          { metric: "ndcg", min: 0.2 },
          { metric: "answerRelevancy", min: 0.5 },
        ],
      }),
    );
    assert.equal(result.outcome, "FAIL");
    assert.equal(result.criteria.length, 3);
    assert.match(result.reason!, /recallAtK/);
    assert.equal(result.criteria.filter((c) => c.state === "pass").length, 2);
    assert.equal(result.criteria.filter((c) => c.state === "fail").length, 1);
  });

  it("multiple failures are deterministic and stable", () => {
    const machine = makeMachine(
      {},
      {
        recallAtK: recallRegression(-0.2, 0.3),
        faithfulness: { candidateMean: 0.6, verdict: "no_significant_change" },
      },
    );
    const gatePolicy = policy({
      metrics: [
        { metric: "recallAtK", tolerance: 0.05 },
        { metric: "faithfulness", min: 0.9 },
      ],
    });
    const first = evaluateQualityGate(machine, gatePolicy);
    const second = evaluateQualityGate(machine, gatePolicy);
    assert.equal(first.outcome, "FAIL");
    assert.equal(second.outcome, "FAIL");
    assert.ok(/recallAtK/.test(first.reason!) && /faithfulness/.test(first.reason!));
    assert.deepEqual(first, second);
  });

  it("empty policy: compatible comparison passes; insufficient comparison still reports explicitly", () => {
    const pass = evaluateQualityGate(makeMachine(), policy());
    assert.equal(pass.outcome, "PASS");
    assert.equal(pass.blocked, false);
    assert.deepEqual(pass.criteria, []);

    const insufficient = evaluateQualityGate(
      makeMachine({
        state: "insufficient",
        overall: { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 11 },
      }),
      policy(),
    );
    assert.equal(insufficient.outcome, "INSUFFICIENT_DATA");
    assert.equal(insufficient.blocked, true);
  });

  it("deterministic: identical inputs produce identical results", () => {
    const machine = makeMachine({}, { recallAtK: recallRegression(-0.2, 0.3) });
    const gatePolicy = policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] });
    assert.deepEqual(evaluateQualityGate(machine, gatePolicy), evaluateQualityGate(machine, gatePolicy));
  });

  it("persisted snapshot: a JSON round-trip (as stored in the result column) evaluates identically", () => {
    const machine = makeMachine({}, { ndcg: recallRegression(-0.2, 0.3) });
    const gatePolicy = policy({ metrics: [{ metric: "ndcg", tolerance: 0.05 }] });
    const persisted = JSON.parse(JSON.stringify(machine)) as MachineRegressionResult;
    assert.deepEqual(evaluateQualityGate(persisted, gatePolicy), evaluateQualityGate(machine, gatePolicy));
  });

  it("output preserves the full comparison snapshot and never mutates the input", () => {
    const machine = makeMachine({}, { recallAtK: recallRegression(-0.2, 0.3) });
    const before = JSON.parse(JSON.stringify(machine));
    const result = evaluateQualityGate(machine, policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] }));
    assert.deepEqual(result.comparison, machine);
    assert.deepEqual(machine, before);
  });

  it("Slice B values unchanged: the gate consumes persisted verdict and delta, never re-derives significance", () => {
    // verdict = regression but the deficit is inside tolerance: pass, using the
    // engine's own verdict and the persisted delta only.
    const withinTolerance = evaluateQualityGate(
      makeMachine({}, { recallAtK: { ...recallRegression(-0.01, 0.39) } }),
      policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] }),
    );
    assert.equal(withinTolerance.outcome, "PASS");

    // verdict = no_significant_change with a large raw delta: the tolerance
    // axis defers to the engine and stays green; an absolute floor still
    // enforces the candidate mean (and would catch the collapse).
    const machine = makeMachine(
      {},
      { recallAtK: { candidateMean: 0.6, delta: -0.4, verdict: "no_significant_change" } },
    );
    assert.equal(
      evaluateQualityGate(machine, policy({ metrics: [{ metric: "recallAtK", tolerance: 0.05 }] })).outcome,
      "PASS",
    );
    assert.equal(
      evaluateQualityGate(machine, policy({ metrics: [{ metric: "recallAtK", min: 0.7 }] })).outcome,
      "FAIL",
    );
  });
});