import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REGRESSION_METRICS,
  checkCompatibility,
  extractMetricValue,
  questionAlignment,
  pairMetricSamples,
  evaluateMetricComparison,
  summarizeVerdicts,
  buildRegressionComparison,
  type ComparisonRun,
  type MetricComparisonOutcome,
  type MetricObservation,
} from "@/lib/evaluation/regression";

const RETRIEVAL_DEFAULTS: Record<string, number> = {
  recallAtK: 0.5,
  precisionAtK: 0.4,
  hitRate: 0.6,
  meanReciprocalRank: 0.3,
  ndcg: 0.45,
};

const GENERATION_DEFAULTS: Record<string, number> = {
  faithfulness: 0.7,
  contextPrecision: 0.6,
  contextRecall: 0.65,
  answerRelevancy: 0.5,
};

function obs(
  id: string,
  over: Partial<MetricObservation> = {},
): MetricObservation {
  return {
    questionId: id,
    retrievalMetrics: { ...RETRIEVAL_DEFAULTS },
    generationMetrics: { ...GENERATION_DEFAULTS },
    latencySearchMs: 200,
    totalLatencyMs: 400,
    ...over,
  };
}

function run(id: string, over: Partial<ComparisonRun> = {}): ComparisonRun {
  return {
    id,
    name: `run-${id}`,
    status: "completed",
    datasetId: "ds-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dataset: { id: "ds-1", name: "Dataset 1" },
    results: [],
    ...over,
  };
}

// Decisive, deterministic paired series: 8 shared questions, candidate clearly
// higher on every one. Differences are non-constant so the paired t-test runs
// and returns a tiny p-value; bootstrap CI is random and never asserted.
const BASELINE_SERIES = [0.1, 0.2, 0.25, 0.3, 0.15, 0.35, 0.2, 0.25];
const CANDIDATE_HIGHER = [0.6, 0.5, 0.7, 0.55, 0.8, 0.65, 0.7, 0.6];

describe("regression comparison compatibility", () => {
  it("rejects comparing a run against itself", () => {
    const a = run("r1");
    assert.deepEqual(checkCompatibility(a, run("r1")), { reason: "same_run" });
  });

  it("rejects runs on different datasets", () => {
    const a = run("r1");
    const b = run("r2", { datasetId: "ds-other", dataset: { id: "ds-other", name: "Other" } });
    assert.deepEqual(checkCompatibility(a, b), { reason: "different_datasets" });
  });

  it("refuses incomplete baseline and candidate runs with their status", () => {
    const baseline = run("r1", { status: "running" });
    assert.deepEqual(checkCompatibility(baseline, run("r2")), { reason: "run_not_completed", status: "running", run: "baseline" });
    const candidate = run("r2", { status: "error" });
    assert.deepEqual(checkCompatibility(run("r1"), candidate), { reason: "run_not_completed", status: "error", run: "candidate" });
  });

  it("accepts two completed runs on the same dataset", () => {
    assert.equal(checkCompatibility(run("r1"), run("r2")), null);
  });
});

describe("question alignment", () => {
  it("counts shared, baseline-only, and candidate-only questions", () => {
    const baseline = [obs("q1"), obs("q2"), obs("q3"), obs("q4")];
    const candidate = [obs("q3"), obs("q4"), obs("q5"), obs("q6")];
    assert.deepEqual(questionAlignment(baseline, candidate), {
      shared: 2,
      baselineOnly: 2,
      candidateOnly: 2,
    });
  });

  it("treats duplicate question rows as a single observation", () => {
    const baseline = [obs("q1"), obs("q1")];
    const candidate = [obs("q1")];
    assert.deepEqual(questionAlignment(baseline, candidate), {
      shared: 1,
      baselineOnly: 0,
      candidateOnly: 0,
    });
  });
});

describe("paired metric sampling", () => {
  it("pairs candidate values by question id in baseline order", () => {
    const baseline = [
      obs("q1", { latencySearchMs: 100 }),
      obs("q2", { latencySearchMs: 200 }),
      obs("q3", { latencySearchMs: 300 }),
    ];
    const candidate = [
      obs("q3", { latencySearchMs: 33 }),
      obs("q1", { latencySearchMs: 11 }),
      obs("q2", { latencySearchMs: 22 }),
    ];
    const def = REGRESSION_METRICS.find((m) => m.key === "latencySearchMs")!;
    assert.deepEqual(pairMetricSamples(baseline, candidate, def).pairs, [
      [100, 11],
      [200, 22],
      [300, 33],
    ]);
  });

  it("drops questions absent from the candidate run", () => {
    const baseline = [obs("q1"), obs("q2")];
    const candidate = [obs("q1")];
    const def = REGRESSION_METRICS.find((m) => m.key === "recallAtK")!;
    assert.deepEqual(pairMetricSamples(baseline, candidate, def).pairs, [[0.5, 0.5]]);
  });

  it("never fabricates a zero when a side is missing its metric — the pair is dropped", () => {
    const baseline = [obs("q1", { retrievalMetrics: null }), obs("q2")];
    const candidate = [obs("q1"), obs("q2")];
    const def = REGRESSION_METRICS.find((m) => m.key === "recallAtK")!;
    assert.deepEqual(pairMetricSamples(baseline, candidate, def).pairs, [[0.5, 0.5]]);
  });
});

describe("metric value extraction", () => {
  it("reads quality metrics from the correct per-case metrics bag", () => {
    const recallDef = REGRESSION_METRICS.find((m) => m.key === "recallAtK")!;
    const faithfulnessDef = REGRESSION_METRICS.find((m) => m.key === "faithfulness")!;
    assert.equal(extractMetricValue(obs("q1"), recallDef), 0.5);
    assert.equal(extractMetricValue(obs("q1"), faithfulnessDef), 0.7);
  });

  it("reads latency from the result latency fields", () => {
    const searchDef = REGRESSION_METRICS.find((m) => m.key === "latencySearchMs")!;
    const totalDef = REGRESSION_METRICS.find((m) => m.key === "totalLatencyMs")!;
    const sample = obs("q1", { latencySearchMs: 123.4, totalLatencyMs: 567.8 });
    assert.equal(extractMetricValue(sample, searchDef), 123.4);
    assert.equal(extractMetricValue(sample, totalDef), 567.8);
  });

  it("treats missing, null, and non-finite values as no observation", () => {
    const recallDef = REGRESSION_METRICS.find((m) => m.key === "recallAtK")!;
    const latencyDef = REGRESSION_METRICS.find((m) => m.key === "totalLatencyMs")!;
    assert.equal(extractMetricValue(obs("q1", { retrievalMetrics: null }), recallDef), null);
    assert.equal(extractMetricValue(obs("q1", { totalLatencyMs: null }), latencyDef), null);
    assert.equal(
      extractMetricValue(
        obs("q1", { retrievalMetrics: { ...RETRIEVAL_DEFAULTS, recallAtK: Number.NaN } }),
        recallDef,
      ),
      null,
    );
  });
});

describe("statistical verdict derivation", () => {
  const recallDef = REGRESSION_METRICS.find((m) => m.key === "recallAtK")!;
  const latencyDef = REGRESSION_METRICS.find((m) => m.key === "totalLatencyMs")!;

  it("calls a significant improvement an improvement for higher-is-better metrics", () => {
    const outcome = evaluateMetricComparison(BASELINE_SERIES, CANDIDATE_HIGHER, recallDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "improvement");
    assert.ok((outcome.pValue ?? 1) < 0.05, `expected p < 0.05, got ${outcome.pValue}`);
    assert.equal(outcome.pairedCount, 8);
    assert.ok(outcome.baselineMean! < outcome.candidateMean!);
  });

  it("calls a significant drop a regression for higher-is-better metrics", () => {
    const outcome = evaluateMetricComparison(CANDIDATE_HIGHER, BASELINE_SERIES, recallDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "regression");
    assert.ok((outcome.pValue ?? 1) < 0.05);
  });

  it("keeps directionality from the metric definition — higher candidate latency is a regression", () => {
    // Same decisive raw numbers, but latency is lower-is-better: higher candidate values regress.
    const outcome = evaluateMetricComparison(BASELINE_SERIES, CANDIDATE_HIGHER, latencyDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "regression");
    assert.ok((outcome.pValue ?? 1) < 0.05);
  });

  it("and lower candidate latency is an improvement even though the raw mean drops", () => {
    const outcome = evaluateMetricComparison(CANDIDATE_HIGHER, BASELINE_SERIES, latencyDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "improvement");
  });

  it("is not significant when the observed shift is within noise", () => {
    const candidateNoise = BASELINE_SERIES.map((v, i) => v + [0.01, -0.02, 0.01, 0.02, -0.01, 0.01, -0.02, 0.01][i]);
    const outcome = evaluateMetricComparison(BASELINE_SERIES, candidateNoise, recallDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "no_significant_change");
    assert.ok((outcome.pValue ?? 0) >= 0.05);
  });

  it("never calls significance with fewer than two paired observations", () => {
    const outcome = evaluateMetricComparison([0.4], [0.9], recallDef, "Baseline", "Candidate");
    assert.equal(outcome.verdict, "insufficient");
    assert.equal(outcome.pValue, null);
    assert.equal(outcome.pairedCount, 1);
  });
});

describe("overall verdict summary", () => {
  function outcome(verdict: MetricComparisonOutcome["verdict"]): MetricComparisonOutcome {
    return {
      key: "recallAtK",
      label: "Recall@K",
      higherIsBetter: true,
      pairedCount: 8,
      baselineMean: 0.5,
      candidateMean: 0.6,
      delta: 0.1,
      pValue: 0.01,
      testUsed: "Paired t-test",
      effectSizeMagnitude: "large",
      ciLower: 0.01,
      ciUpper: 0.19,
      interpretation: "",
      verdict,
    };
  }

  it("stays insufficient when no metric produced a verdict", () => {
    assert.equal(summarizeVerdicts([outcome("insufficient"), outcome("insufficient")]).verdict, "insufficient");
  });

  it("flags a regression when a regression is the only signal", () => {
    assert.equal(summarizeVerdicts([outcome("regression"), outcome("no_significant_change")]).verdict, "regression");
  });

  it("flags an improvement when an improvement is the only signal", () => {
    assert.equal(summarizeVerdicts([outcome("improvement"), outcome("no_significant_change")]).verdict, "improvement");
  });

  it("reports mixed signals rather than picking a majority winner", () => {
    assert.equal(summarizeVerdicts([outcome("regression"), outcome("improvement")]).verdict, "mixed");
  });

  it("reports no significant change when no signal reached significance", () => {
    assert.equal(summarizeVerdicts([outcome("no_significant_change"), outcome("no_significant_change")]).verdict, "no_significant_change");
  });
});

describe("buildRegressionComparison", () => {
  it("assembles per-metric statistics and an overall verdict from persisted run shapes", () => {
    const baselineResults = BASELINE_SERIES.map((v, i) =>
      obs(`q${i}`, {
        retrievalMetrics: { ...RETRIEVAL_DEFAULTS, recallAtK: v, precisionAtK: v, hitRate: v, meanReciprocalRank: v, ndcg: v },
        generationMetrics: { ...GENERATION_DEFAULTS, faithfulness: 0.5 },
        latencySearchMs: 500,
        totalLatencyMs: 700,
      }),
    );
    const candidateResults = CANDIDATE_HIGHER.map((v, i) =>
      obs(`q${i}`, {
        retrievalMetrics: { ...RETRIEVAL_DEFAULTS, recallAtK: v, precisionAtK: v, hitRate: v, meanReciprocalRank: v, ndcg: v },
        generationMetrics: { ...GENERATION_DEFAULTS, faithfulness: v },
        latencySearchMs: 300,
        totalLatencyMs: [450, 460, 440, 470, 455, 435, 480, 445][i],
      }),
    );

    const comparison = buildRegressionComparison(
      run("r-baseline", { results: baselineResults }),
      run("r-candidate", { results: candidateResults }),
    );

    assert.equal(comparison.ok, true);
    assert.equal(comparison.alignment.shared, 8);
    assert.equal(comparison.alignment.baselineOnly, 0);
    assert.equal(comparison.alignment.candidateOnly, 0);
    assert.equal(comparison.metrics.length, REGRESSION_METRICS.length);
    assert.equal(comparison.overall.verdict, "improvement");
    assert.equal(comparison.overall.regressed, 0);
    assert.equal(comparison.overall.improved, 7);

    const recall = comparison.metrics.find((m) => m.key === "recallAtK")!;
    assert.equal(recall.verdict, "improvement");
    assert.equal(recall.pairedCount, 8);
    assert.ok((recall.pValue ?? 1) < 0.05);

    const latency = comparison.metrics.find((m) => m.key === "totalLatencyMs")!;
    assert.equal(latency.verdict, "improvement");
    assert.equal(latency.candidateMean, 454.375);
  });

  it("keeps partial overlap honest: only shared questions are compared and the rest reported", () => {
    const baselineResults = Array.from({ length: 8 }, (_, i) => obs(`q${i}`));
    const candidateResults = Array.from({ length: 4 }, (_, i) => obs(`q${i}`));

    const comparison = buildRegressionComparison(
      run("r-baseline", { results: baselineResults }),
      run("r-candidate", { results: candidateResults }),
    );

    assert.equal(comparison.ok, true);
    assert.equal(comparison.alignment.shared, 4);
    assert.equal(comparison.alignment.baselineOnly, 4);
    assert.equal(comparison.alignment.candidateOnly, 0);
    assert.equal(comparison.metrics.find((m) => m.key === "recallAtK")!.pairedCount, 4);
  });

  it("returns a structured incompatibility instead of a verdict when runs cannot be compared", () => {
    const a = run("r-baseline");
    const b = run("r-candidate", { datasetId: "ds-other", dataset: { id: "ds-other", name: "Other" } });
    const comparison = buildRegressionComparison(a, b);
    assert.equal(comparison.ok, false);
    assert.deepEqual(comparison.error, { reason: "different_datasets" });
    assert.deepEqual(comparison.metrics, []);
  });
});