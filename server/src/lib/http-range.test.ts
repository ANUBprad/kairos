import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InvalidByteRangeError,
  parseByteRange,
} from "./http-range.js";

describe("byte range parsing", () => {
  it("parses open-ended and bounded ranges", () => {
    assert.deepEqual(parseByteRange("bytes=10-20", 100), { start: 10, end: 20 });
    assert.deepEqual(parseByteRange("bytes=10-", 100), { start: 10, end: 99 });
    assert.deepEqual(parseByteRange("bytes=-50", 100), { start: 50, end: 99 });
    assert.equal(parseByteRange(undefined, 100), null);
  });

  it("clamps an oversized end to the resource length", () => {
    assert.deepEqual(parseByteRange("bytes=90-999", 100), { start: 90, end: 99 });
  });

  it("rejects malformed, reversed, negative, and NaN ranges", () => {
    for (const header of [
      "bytes=abc-5",
      "bytes=5-abc",
      "bytes=20-10",
      "bytes=-0",
      "bytes=NaN-",
      "bytes=100-",
      "items=0-1",
    ]) {
      assert.throws(
        () => parseByteRange(header, 100),
        InvalidByteRangeError,
        header,
      );
    }
  });
});
