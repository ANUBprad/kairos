import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actionsSource = readFileSync(
  new URL("../lib/actions/knowledge-base.ts", import.meta.url),
  "utf8",
);

const retrievalLabSource = readFileSync(
  new URL("../lib/actions/retrieval-lab.ts", import.meta.url),
  "utf8",
);

const evaluationSource = readFileSync(
  new URL("../lib/actions/evaluation.ts", import.meta.url),
  "utf8",
);

describe("knowledge base member authorization wiring", () => {
  it("evaluates the supplied user identity through the canonical membership helper", () => {
    assert.match(actionsSource, /canAccessKnowledgeBase\(userId, kbId\)/);
    assert.doesNotMatch(actionsSource, /_userId/);
  });

  it("keeps foreign and missing knowledge bases indistinguishable as not-found", () => {
    assert.match(actionsSource, /Knowledge base not found/);
    assert.doesNotMatch(actionsSource, /assertMemberAccess[\s\S]{0,80}findUnique/);
  });

  it("authorizes rename and delete with the caller's own session identity", () => {
    const callCount = actionsSource.match(/assertMemberAccess\(id, session\.user\.id\)/g)?.length ?? 0;
    assert.equal(callCount, 2);
  });

  for (const [name, source] of [
    ["retrieval-lab", retrievalLabSource],
    ["evaluation", evaluationSource],
  ] as const) {
    describe(`knowledge base authorization wiring: ${name}`, () => {
      it("routes KB access through the caller identity, not KB existence", () => {
        assert.match(source, /canAccessKnowledgeBase\(userId, kbId\)/);
        assert.doesNotMatch(source, /assertKbAccess\(kbId, _userId\)/);
      });

      it("keeps foreign and missing knowledge bases indistinguishable as not-found", () => {
        assert.match(source, /Knowledge base not found/);
        assert.doesNotMatch(source, /assertKbAccess[\s\S]{0,120}findUnique/);
      });
    });
  }
});