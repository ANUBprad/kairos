import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRetryAfter, ProviderRequestError } from "@/lib/ai/errors";
import {
  computeBackoffMs,
  isTransientEmbeddingError,
  validateEmbeddingResponse,
} from "@/lib/ai/embeddings/service";

function captureError(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected the call to throw");
}

describe("embedding retry policy", () => {
  it("retries rate limits and server faults", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      assert.equal(
        isTransientEmbeddingError(new ProviderRequestError("boom", status)),
        true,
        `status ${status} should be transient`,
      );
    }
  });

  it("treats timeouts and network errors without a status as transient", () => {
    assert.equal(isTransientEmbeddingError(new Error("fetch failed")), true);
    assert.equal(
      isTransientEmbeddingError(new Error("Embedding request timed out after 300ms")),
      true,
    );
  });

  it("does not retry permanent client errors", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(
        isTransientEmbeddingError(new ProviderRequestError("no", status)),
        false,
        `status ${status} should be permanent`,
      );
    }
  });

  it("honours an explicit retryable flag over the status heuristic", () => {
    assert.equal(isTransientEmbeddingError({ retryable: false, status: 500 }), false);
    assert.equal(isTransientEmbeddingError({ retryable: true, status: 400 }), true);
  });

  it("classifies malformed and non-finite vectors as permanent", () => {
    const countMismatch = captureError(() => validateEmbeddingResponse([[1, 2, 3]], 2));
    assert.equal(isTransientEmbeddingError(countMismatch), false);

    const nonFinite = captureError(() => validateEmbeddingResponse([[1, Number.NaN]], 1));
    assert.equal(isTransientEmbeddingError(nonFinite), false);
  });
});

describe("embedding backoff", () => {
  it("grows with the attempt number and stays within the cap", () => {
    for (let i = 0; i < 50; i++) {
      assert.ok(computeBackoffMs(0) >= 0 && computeBackoffMs(0) <= 1_000);
      assert.ok(computeBackoffMs(1) >= 0 && computeBackoffMs(1) <= 2_000);
      assert.ok(computeBackoffMs(20) >= 0 && computeBackoffMs(20) <= 30_000);
    }
  });

  it("never waits less than the server's Retry-After", () => {
    for (let i = 0; i < 50; i++) {
      const delay = computeBackoffMs(0, 5_000);
      assert.ok(delay >= 5_000 && delay <= 30_000, `got ${delay}`);
    }
  });

  it("caps an absurd Retry-After instead of stalling indefinitely", () => {
    assert.equal(computeBackoffMs(3, 10_000_000), 30_000);
  });

  it("applies jitter (delays are not a single fixed value)", () => {
    const samples = new Set(Array.from({ length: 40 }, () => computeBackoffMs(6)));
    assert.ok(samples.size > 1, "expected jittered delays to vary");
  });
});

describe("parseRetryAfter", () => {
  it("reads delta-seconds", () => {
    assert.equal(parseRetryAfter("5"), 5_000);
    assert.equal(parseRetryAfter("0"), 0);
  });

  it("reads HTTP-dates", () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    assert.equal(parseRetryAfter(past), 0);
    const future = new Date(Date.now() + 120_000).toUTCString();
    const value = parseRetryAfter(future);
    assert.ok(value !== undefined && value > 0 && value <= 120_000);
  });

  it("returns undefined for absent or unparseable values", () => {
    assert.equal(parseRetryAfter(undefined), undefined);
    assert.equal(parseRetryAfter(null), undefined);
    assert.equal(parseRetryAfter(""), undefined);
    assert.equal(parseRetryAfter("not-a-date"), undefined);
  });
});
