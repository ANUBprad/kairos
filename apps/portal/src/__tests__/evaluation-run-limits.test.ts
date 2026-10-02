import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_CAMPAIGN_EXPERIMENTS,
  MAX_RUN_QUESTIONS,
  assertCampaignExperimentCount,
  assertRunQuestionCount,
} from "@/lib/evaluation/limits";

// Every loop below spends one provider generation per iteration, and the loop
// bounds came from the dataset (or, for a campaign, from client-supplied
// arrays). Unbounded, a single request fans out into an unbounded number of
// paid calls, so these assertions pin both the ceilings and their wiring.
describe("evaluation run size ceilings", () => {
  it("keeps the per-run question ceiling small enough to bound spend", () => {
    assert.ok(MAX_RUN_QUESTIONS > 0 && MAX_RUN_QUESTIONS <= 100);
  });

  it("keeps the campaign configuration ceiling small enough to bound spend", () => {
    assert.ok(MAX_CAMPAIGN_EXPERIMENTS > 0 && MAX_CAMPAIGN_EXPERIMENTS <= 24);
  });

  it("allows a run at the ceiling and refuses one past it", () => {
    assert.doesNotThrow(() => assertRunQuestionCount(MAX_RUN_QUESTIONS));
    assert.throws(
      () => assertRunQuestionCount(MAX_RUN_QUESTIONS + 1),
      (err: unknown) =>
        err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 413,
    );
  });

  it("allows a campaign at the ceiling and refuses one past it", () => {
    assert.doesNotThrow(() => assertCampaignExperimentCount(MAX_CAMPAIGN_EXPERIMENTS));
    assert.throws(
      () => assertCampaignExperimentCount(MAX_CAMPAIGN_EXPERIMENTS + 1),
      (err: unknown) =>
        err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 413,
    );
  });

  it("allows an ordinary small run", () => {
    assert.doesNotThrow(() => assertRunQuestionCount(5));
    assert.doesNotThrow(() => assertCampaignExperimentCount(5));
  });
});

describe("evaluation run size wiring", () => {
  const benchmarkSource = readFileSync(
    new URL("../lib/evaluation/benchmark.ts", import.meta.url),
    "utf8",
  );
  const campaignSource = readFileSync(
    new URL("../lib/evaluation/campaign.ts", import.meta.url),
    "utf8",
  );
  const experimentSource = readFileSync(
    new URL("../lib/experiment-engine.ts", import.meta.url),
    "utf8",
  );

  it("bounds both benchmark loops over dataset questions", () => {
    assert.equal(benchmarkSource.match(/assertRunQuestionCount\(target\.questions\.length\)/g)?.length, 2);
  });

  it("bounds the campaign by configurations and by questions", () => {
    assert.match(campaignSource, /assertRunQuestionCount\(target\.questions\.length\)/);
    assert.match(campaignSource, /const totalExperiments = experiments\.length;\s*assertCampaignExperimentCount\(totalExperiments\)/);
  });

  it("bounds the streamed experiment dataset loop", () => {
    assert.match(experimentSource, /assertRunQuestionCount\(questions\.length\)/);
  });
});