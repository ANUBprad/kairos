import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { datasetContentHash } from "@/lib/evaluation/benchmark";

describe("datasetContentHash", () => {
  it("is deterministic and independent of question order and metadata key order", () => {
    const questions = [
      { question: "a?", expectedAnswer: "x", expectedContext: "c", referenceDocId: "doc1", metadata: { b: 1, a: "x" } },
      { question: "b?", expectedAnswer: null },
    ];
    assert.equal(datasetContentHash(questions), datasetContentHash([...questions].reverse()));
    assert.equal(
      datasetContentHash(questions),
      datasetContentHash([
        { question: "a?", expectedAnswer: "x", expectedContext: "c", referenceDocId: "doc1", metadata: { a: "x", b: 1 } },
        { question: "b?", expectedAnswer: null, metadata: null },
      ]),
    );
  });

  it("changes when any evaluation-relevant field changes", () => {
    const base = [{ question: "q", expectedAnswer: "a" }];
    assert.notEqual(datasetContentHash(base), datasetContentHash([{ question: "q", expectedAnswer: "b" }]));
    assert.notEqual(datasetContentHash(base), datasetContentHash([{ question: "q2", expectedAnswer: "a" }]));
    assert.notEqual(datasetContentHash(base), datasetContentHash([{ question: "q", expectedAnswer: "a", referenceDocId: "r" }]));
    assert.notEqual(datasetContentHash(base), datasetContentHash([{ question: "q", expectedAnswer: "a", metadata: { k: 1 } }]));
  });
});