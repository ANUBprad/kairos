import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPipelineStages } from "@/components/app/document-workspace/processing-pipeline";

function byId(stages: ReturnType<typeof buildPipelineStages>) {
  return Object.fromEntries(stages.map((stage) => [stage.id, stage.status]));
}

describe("document pipeline stage mapping", () => {
  it("marks the upload stage active for a freshly stored source", () => {
    const stages = byId(buildPipelineStages("STORED"));
    assert.equal(stages.upload, "active");
    assert.equal(stages.extract, "pending");
    assert.equal(stages.index, "pending");
  });

  it("advances one stage per real pipeline status", () => {
    assert.deepEqual(byId(buildPipelineStages("EXTRACTING")), {
      upload: "completed",
      extract: "active",
      chunk: "pending",
      embed: "pending",
      index: "pending",
    });
    assert.deepEqual(byId(buildPipelineStages("CHUNKING")), {
      upload: "completed",
      extract: "completed",
      chunk: "active",
      embed: "pending",
      index: "pending",
    });
    assert.deepEqual(byId(buildPipelineStages("EMBEDDING")), {
      upload: "completed",
      extract: "completed",
      chunk: "completed",
      embed: "active",
      index: "pending",
    });
  });

  it("shows every stage complete for terminal success", () => {
    for (const status of ["INDEXED", "READY"]) {
      assert.deepEqual(byId(buildPipelineStages(status)), {
        upload: "completed",
        extract: "completed",
        chunk: "completed",
        embed: "completed",
        index: "completed",
      });
    }
  });

  it("shows the failure on the stage that actually failed", () => {
    const chunkFailure = buildPipelineStages("ERROR", { stage: "chunk", error: "bad text" });
    const statuses = byId(chunkFailure);
    assert.equal(statuses.upload, "completed");
    assert.equal(statuses.extract, "completed");
    assert.equal(statuses.chunk, "error");
    assert.equal(statuses.embed, "pending");
    assert.equal(chunkFailure.find((s) => s.id === "chunk")?.error, "bad text");

    // "store" is the pipeline's internal name for the indexing write.
    assert.equal(byId(buildPipelineStages("ERROR", { stage: "store" })).index, "error");
    // "fetch" is the internal name for the upload/download stage.
    assert.equal(byId(buildPipelineStages("ERROR", { stage: "fetch" })).upload, "error");
  });

  it("never renders a stale success row for an unknown failure stage", () => {
    const statuses = byId(buildPipelineStages("ERROR", {}));
    assert.equal(statuses.upload, "error");
    assert.ok(!Object.values(statuses).includes("completed"));
  });
});
