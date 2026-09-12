import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CHAT_SOURCES,
  isValidEntityId,
  parseSourceIds,
  filterScopedSourceIds,
  formatSourceScopeLabel,
  sourceScopeKey,
} from "@/lib/ai/chat/source-scope";

const CUID_A = "brkyexy2gcn9it6fb99f0wj0";
const CUID_B = "brkyexy2gcn9it6fb99f0wj1";
const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("isValidEntityId", () => {
  it("accepts cuid ids", () => {
    assert.equal(isValidEntityId(CUID_A), true);
  });
  it("accepts uuid ids", () => {
    assert.equal(isValidEntityId(UUID), true);
  });
  it("rejects empty string", () => {
    assert.equal(isValidEntityId(""), false);
  });
  it("rejects ids with spaces or punctuation", () => {
    assert.equal(isValidEntityId("brky xyz"), false);
    assert.equal(isValidEntityId("brky;drop"), false);
  });
  it("rejects overlong ids", () => {
    assert.equal(isValidEntityId("a".repeat(129)), false);
  });
});

describe("parseSourceIds", () => {
  it("returns null when the value is not an array", () => {
    assert.equal(parseSourceIds(undefined), null);
    assert.equal(parseSourceIds("brkyexy"), null);
    assert.equal(parseSourceIds({}), null);
  });
  it("accepts an empty array as an empty scope", () => {
    assert.deepEqual(parseSourceIds([]), []);
  });
  it("keeps only valid ids and trims", () => {
    assert.deepEqual(
      parseSourceIds([`  ${CUID_A}  `, "%%%invalid", 42, null]),
      [CUID_A],
    );
  });
  it("deduplicates identical ids", () => {
    assert.deepEqual(parseSourceIds([CUID_A, CUID_A, CUID_B]), [CUID_A, CUID_B]);
  });
  it("caps the number of sources", () => {
    const many = Array.from({ length: MAX_CHAT_SOURCES + 10 }, (_, i) => `id${i}`.replace("id", "brky"));
    const result = parseSourceIds(many);
    assert.equal(result?.length ?? 0, MAX_CHAT_SOURCES);
  });
});

describe("filterScopedSourceIds", () => {
  it("keeps only ids that exist in the owned set", () => {
    assert.deepEqual(filterScopedSourceIds([CUID_A, CUID_B], [CUID_A]), [CUID_A]);
  });
  it("returns undefined when no requested id is owned", () => {
    assert.equal(filterScopedSourceIds([CUID_B], [CUID_A]), undefined);
  });
  it("returns undefined for an empty requested set", () => {
    assert.equal(filterScopedSourceIds([], []), undefined);
  });
});

describe("formatSourceScopeLabel", () => {
  it("labels all-sources scope", () => {
    assert.equal(formatSourceScopeLabel(0), "All sources");
  });
  it("labels selected scope", () => {
    assert.equal(formatSourceScopeLabel(3), "Selected sources (3)");
  });
});

describe("sourceScopeKey", () => {
  it("is stable regardless of order", () => {
    assert.equal(sourceScopeKey([CUID_B, CUID_A]), sourceScopeKey([CUID_A, CUID_B]));
  });
  it("uses \"all\" for empty or null scope", () => {
    assert.equal(sourceScopeKey(null), "all");
    assert.equal(sourceScopeKey([]), "all");
  });
});