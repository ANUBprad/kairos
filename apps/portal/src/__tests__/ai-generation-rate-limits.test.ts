import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Artifact generation (one LLM call, plus a TTS call per podcast turn) and
// evaluation runs (one LLM call per question, per configuration) were
// authenticated but had no request ceiling, so a single client could loop them
// without bound. These assertions pin both the budget and the wiring that
// spends it.
describe("generation rate-limit budget", () => {
  it("bounds artifact generations per user per minute", () => {
    const budget = RATE_LIMITS.research;
    const key = "artifact:user-under-test";

    for (let i = 1; i <= budget.maxRequests; i++) {
      assert.equal(rateLimit(key, budget).allowed, true, `call ${i} of the budget must be allowed`);
    }
    assert.equal(rateLimit(key, budget).allowed, false, "the call past the ceiling must be refused");
  });

  it("bounds evaluation runs per user per minute", () => {
    const budget = RATE_LIMITS.evaluation;
    const key = "evaluation:user-under-test";

    for (let i = 1; i <= budget.maxRequests; i++) {
      assert.equal(rateLimit(key, budget).allowed, true, `call ${i} of the budget must be allowed`);
    }
    assert.equal(rateLimit(key, budget).allowed, false, "the call past the ceiling must be refused");
  });

  it("keeps a per-user budget small enough to bound provider spend", () => {
    assert.ok(RATE_LIMITS.research.maxRequests <= 20);
    assert.ok(RATE_LIMITS.evaluation.maxRequests <= 15);
  });
});

describe("generation rate-limit wiring", () => {
  const engineSource = readFileSync(
    new URL("../lib/artifacts/engine.ts", import.meta.url),
    "utf8",
  );
  const evaluationSource = readFileSync(
    new URL("../lib/actions/evaluation.ts", import.meta.url),
    "utf8",
  );

  it("limits generation in the shared engine so every action and regenerate is covered", () => {
    assert.match(
      engineSource,
      /rateLimit\(`artifact:\$\{userId\}`, RATE_LIMITS\.research\)/,
    );
    assert.match(engineSource, /"ARTIFACT_RATE_LIMITED"[\s\S]*?429/);
  });

  it("limits every evaluation entry point that spends provider calls", () => {
    // startBenchmark, runCampaign, compareRetrievalStrategies
    assert.equal(evaluationSource.match(/assertEvaluationRateLimit\(session\.user\.id\)/g)?.length, 3);
    assert.match(evaluationSource, /function assertEvaluationRateLimit[\s\S]*?RATE_LIMITS\.evaluation/);
  });

  it("shares the evaluation budget with the experiment stream endpoint", () => {
    const streamRouteSource = readFileSync(
      new URL("../app/api/experiments/stream/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(streamRouteSource, /rateLimit\(`evaluation:\$\{session\.user\.id\}`, RATE_LIMITS\.evaluation\)/);
    assert.match(evaluationSource, /rateLimit\(`evaluation:\$\{userId\}`, RATE_LIMITS\.evaluation\)/);
  });
});