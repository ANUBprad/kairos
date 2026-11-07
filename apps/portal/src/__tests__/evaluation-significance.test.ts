import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareMetrics } from "@/lib/evaluation/significance";

describe("Wilcoxon signed-rank small samples", () => {
  it("uses the exact two-sided distribution for fewer than eight pairs", () => {
    const result = compareMetrics([1, 2, 3, 4], [2, 3, 4, 5], "recall", "baseline", "candidate");
    assert.equal(result.significance.testUsed, "Wilcoxon signed-rank");
    assert.equal(result.significance.pValue, 0.125);
    assert.equal(result.significance.significant, false);
  });
});
