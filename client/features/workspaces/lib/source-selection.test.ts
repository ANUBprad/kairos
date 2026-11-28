import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  includeNewSourceIds,
  parsePersistedSelection,
  pruneSelectedSourceIds,
  selectedSourcesStorageKey,
} from "./source-selection.js";

describe("selected sources storage key", () => {
  it("is workspace-scoped and stable", () => {
    assert.equal(
      selectedSourcesStorageKey("ws_1"),
      "kairos_selected_sources_ws_1",
    );
  });
});

describe("parsePersistedSelection", () => {
  it("returns null when nothing is stored", () => {
    assert.equal(parsePersistedSelection(null), null);
  });

  it("returns null for malformed or non-array values", () => {
    assert.equal(parsePersistedSelection("not json"), null);
    assert.equal(parsePersistedSelection("{}"), null);
  });

  it("drops non-string IDs", () => {
    assert.deepEqual(parsePersistedSelection('["a",1,null,"b"]'), ["a", "b"]);
  });
});

describe("pruneSelectedSourceIds", () => {
  it("fixes 4/2 active by dropping stale IDs", () => {
    assert.deepEqual(
      pruneSelectedSourceIds(["a", "b", "gone", "also-gone"], ["a", "b"]),
      ["a", "b"],
    );
  });

  it("removes duplicates and preserves order", () => {
    assert.deepEqual(pruneSelectedSourceIds(["b", "a", "b"], ["a", "b", "c"]), [
      "b",
      "a",
    ]);
  });

  it("never returns more IDs than available sources", () => {
    const result = pruneSelectedSourceIds(["a", "a", "a"], ["a"]);
    assert.ok(result.length <= 1);
  });
});

describe("includeNewSourceIds", () => {
  it("selects new sources but keeps deselected ones off", () => {
    assert.deepEqual(
      includeNewSourceIds(["a"], ["a", "b", "c"], ["a", "b"]),
      ["a", "c"],
    );
  });

  it("prunes deleted sources at the same time", () => {
    assert.deepEqual(
      includeNewSourceIds(["a", "gone"], ["a", "b"], ["a", "gone", "b"]),
      ["a"],
    );
  });
});
