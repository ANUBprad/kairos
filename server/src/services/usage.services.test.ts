import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CREDIT_COSTS } from "./credit.services.js";
import { getArtifactCharge } from "./usage.services.js";

describe("action credit pricing", () => {
  it("uses the server-owned cost caps", () => {
    assert.equal(CREDIT_COSTS.SOURCE_UPLOAD, 1);
    assert.equal(CREDIT_COSTS.CHAT_MESSAGE, 1);
    assert.equal(CREDIT_COSTS.ARTIFACT_GENERATE, 3);
    assert.equal(CREDIT_COSTS.ARTIFACT_COMPUTE, 5);
    assert.equal(CREDIT_COSTS.AUDIO_DEBATE, 10);
  });

  it("charges five credits only for compute-heavy artifacts", () => {
    for (const type of ["MINDMAP", "DIAGRAM", "REPORT"]) {
      const charge = getArtifactCharge(type);
      assert.equal(charge.cost, 5, `${type} cost`);
      assert.equal(charge.type, "ARTIFACT_GENERATE");
    }
  });

  it("charges three credits for standard artifacts", () => {
    for (const type of ["SUMMARY", "FLASHCARDS", "QUIZ", "TAKEAWAYS", undefined]) {
      const charge = getArtifactCharge(type);
      assert.equal(charge.cost, 3, `${type ?? "default"} cost`);
      assert.equal(charge.type, "ARTIFACT_GENERATE");
    }
  });

  it("charges ten credits for an audio debate podcast", () => {
    const charge = getArtifactCharge("PODCAST");
    assert.equal(charge.cost, 10);
    assert.equal(charge.type, "AUDIO_DEBATE");
  });
});
