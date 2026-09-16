import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REGRESSION_METRICS,
  type MetricComparisonOutcome,
  type OverallVerdict,
  type RegressionComparisonResult,
  type RunSummary,
} from "@/lib/evaluation/regression";
import { serializeRegressionComparison } from "@/lib/evaluation/regression-tracking";

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: "aaaaaaaa-0000-0000-0000-000000000000",
    name: "baseline",
    status: "completed",
    datasetId: "dataset-v1",
    datasetName: "Dataset v1",
    createdAt: "2026-09-17T00:00:00.000Z",
    observationCount: 8,
    ...overrides,
  };
}

function metric(partial: Partial<MetricComparisonOutcome>): MetricComparisonOutcome {
  return {
    key: "recallAtK",
    label: "Recall@K",
    higherIsBetter: true,
    pairedCount: 8,
    baselineMean: 0.42,
    candidateMean: 0.71,
    delta: 0.29,
    pValue: 0.001,
    testUsed: "paired t-test",
    effectSizeMagnitude: "large",
    ciLower: 0.21,
    ciUpper: 0.37,
    interpretation: "candidate is meaningfully better",
    verdict: "improvement",
    ...partial,
  };
}

const ALIGNMENT = { shared: 8, baselineOnly: 0, candidateOnly: 0 };
const EMTPY_OVERALL: OverallVerdict = { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 0 };

function okResult(
  metrics: MetricComparisonOutcome[] = REGRESSION_METRICS.map((def) => metric({ key: def.key, label: def.label, higherIsBetter: def.higherIsBetter })),
  overall: OverallVerdict = {
    verdict: "improvement",
    regressed: 0,
    improved: metrics.filter((m) => m.verdict === "improvement").length,
    unchanged: 0,
    insufficient: 0,
  },
): RegressionComparisonResult {
  return {
    ok: true,
    baseline: summary(),
    candidate: summary({ runId: "bbbbbbbb-0000-0000-0000-000000000000", name: "candidate" }),
    alignment: ALIGNMENT,
    metrics,
    overall,
  };
}

describe("machine-readable regression tracking serialization", () => {
  it("serializes a compatible comparison deterministically with no non-finite values", () => {
    const machine = serializeRegressionComparison(okResult());
    assert.equal(machine.ok, true);
    assert.equal(machine.state, "compatible");
    assert.equal(machine.error, null);
    assert.equal(machine.metrics.length, REGRESSION_METRICS.length);
    assert.equal(machine.baseline.datasetId, "dataset-v1");
    assert.equal(machine.overall.verdict, "improvement");

    const json = JSON.stringify(machine);
    assert.doesNotMatch(json, /NaN|Infinity|undefined/);

    // Pure function: the same input always yields the byte-identical output.
    assert.equal(JSON.stringify(serializeRegressionComparison(okResult())), json);
    assert.deepEqual(serializeRegressionComparison(okResult()), machine);
  });

  it("keeps a stable, well-known top-level field order", () => {
    const machine = serializeRegressionComparison(okResult());
    assert.deepEqual(Object.keys(machine), ["ok", "state", "error", "baseline", "candidate", "alignment", "overall", "metrics"]);
    const metricKeys = Object.keys(machine.metrics[0]);
    assert.deepEqual(metricKeys, [
      "key", "label", "higherIsBetter", "pairedCount", "baselineMean", "candidateMean", "delta",
      "pValue", "testUsed", "effectSizeMagnitude", "ciLower", "ciUpper", "interpretation", "verdict",
    ]);
  });

  it("keeps per-metric order aligned with the engine metric definitions", () => {
    const machine = serializeRegressionComparison(okResult());
    assert.deepEqual(machine.metrics.map((m) => m.key), REGRESSION_METRICS.map((m) => m.key));
  });

  it("maps non-finite statistics to explicit nulls at the boundary", () => {
    const metrics = REGRESSION_METRICS.map((def, i) =>
      metric({
        key: def.key,
        label: def.label,
        higherIsBetter: def.higherIsBetter,
        baselineMean: i === 0 ? Number.NaN : undefined,
        candidateMean: Number.POSITIVE_INFINITY,
        delta: i === 1 ? Number.NEGATIVE_INFINITY : undefined,
        ciLower: undefined,
        ciUpper: undefined,
      }),
    );
    const machine = serializeRegressionComparison(okResult(metrics));
    const first = machine.metrics[0];
    assert.equal(first.baselineMean, null);
    assert.equal(first.candidateMean, null);
    assert.equal(machine.metrics[1].delta, null);
    assert.equal(first.ciLower, null);
    assert.equal(first.ciUpper, null);
    assert.doesNotMatch(JSON.stringify(machine), /NaN|Infinity/);
  });

  it("marks run_not_completed comparisons incompatible with reason, status, and run", () => {
    const result: RegressionComparisonResult = {
      ok: false,
      error: { reason: "run_not_completed", status: "running", run: "candidate" },
      baseline: summary(),
      candidate: summary({ runId: "bbbbbbbb-0000-0000-0000-000000000000", name: "candidate", status: "running" }),
      alignment: ALIGNMENT,
      metrics: [],
      overall: EMTPY_OVERALL,
    };
    const machine = serializeRegressionComparison(result);
    assert.equal(machine.ok, false);
    assert.equal(machine.state, "incompatible");
    assert.deepEqual(machine.error, { reason: "run_not_completed", status: "running", run: "candidate" });
    assert.equal(machine.metrics.length, 0);
  });

  it("marks same_run and different_datasets comparisons incompatible with the reason only", () => {
    for (const reason of ["same_run", "different_datasets"] as const) {
      const machine = serializeRegressionComparison({
        ok: false,
        error: { reason },
        baseline: summary(),
        candidate: summary({ runId: "bbbbbbbb-0000-0000-0000-000000000000", name: "candidate" }),
        alignment: ALIGNMENT,
        metrics: [],
        overall: EMTPY_OVERALL,
      });
      assert.equal(machine.state, "incompatible");
      assert.deepEqual(machine.error, { reason });
    }
  });

  it("marks a compatible but underpowered comparison as insufficient, not incompatible", () => {
    const underpowered = REGRESSION_METRICS.map((def) =>
      metric({ key: def.key, label: def.label, higherIsBetter: def.higherIsBetter, pairedCount: 1, baselineMean: null, candidateMean: null, delta: null, pValue: null, testUsed: null, effectSizeMagnitude: null, ciLower: null, ciUpper: null, interpretation: null, verdict: "insufficient" }),
    );
    const machine = serializeRegressionComparison(okResult(underpowered, { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 11 }));
    assert.equal(machine.ok, true);
    assert.equal(machine.state, "insufficient");
    assert.equal(machine.error, null);
    assert.equal(machine.overall.verdict, "insufficient");
  });
});