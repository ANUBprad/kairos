import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateGenerationMetrics,
  calculateAverageGenerationMetrics,
} from "@/lib/evaluation/metrics/generation";

const CONTEXT = ["The capital of France is Paris. Paris lies on the Seine river."];

function faithfulnessFor(answer: string): number {
  return calculateGenerationMetrics({
    question: "What is the capital of France?",
    generatedAnswer: answer,
    retrievedContexts: CONTEXT,
  }).faithfulness;
}

describe("generation faithfulness contract", () => {
  it("scores a supported answer as faithful", () => {
    assert.equal(faithfulnessFor("The capital of France is Paris."), 1);
  });

  it("scores an unsupported answer as unfaithful", () => {
    assert.equal(faithfulnessFor("The sky is green with purple clouds."), 0);
  });

  it("partial support scores between the extremes", () => {
    assert.equal(faithfulnessFor("The capital of France is Paris. The sky is green."), 0.5);
  });

  it("empty generation cannot produce a perfect faithfulness score", () => {
    assert.equal(faithfulnessFor(""), 0);
  });

  it("whitespace-only generation cannot produce a perfect faithfulness score", () => {
    assert.equal(faithfulnessFor("   \n\t  "), 0);
  });

  it("an answer with no rateable claim set is not scored as faithful", () => {
    assert.equal(faithfulnessFor("Yes."), 0);
  });

  it("empty generation does not fabricate aggregate faithfulness", () => {
    const faithful = calculateGenerationMetrics({
      question: "What is the capital of France?",
      generatedAnswer: "The capital of France is Paris.",
      retrievedContexts: CONTEXT,
    });
    const empty = calculateGenerationMetrics({
      question: "What is the capital of France?",
      generatedAnswer: "",
      retrievedContexts: CONTEXT,
    });
    const avg = calculateAverageGenerationMetrics([faithful, empty]);
    assert.equal(avg.faithfulness, 0.5, "(1 + 0) / 2, not the fabricated 1");
  });

  it("a normal successful evaluation is unchanged", () => {
    const metrics = calculateGenerationMetrics({
      question: "What is the capital of France?",
      generatedAnswer: "The capital of France is Paris.",
      retrievedContexts: CONTEXT,
    });
    assert.deepEqual(metrics, {
      faithfulness: 1,
      contextPrecision: 1,
      contextRecall: 0.5,
      answerRelevancy: 0.5,
    });
  });
});