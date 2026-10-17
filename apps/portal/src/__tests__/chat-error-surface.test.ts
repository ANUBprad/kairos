// Chat error-surface contract: provider failures must reach the client as an
// actionable, non-leaky message. The raw provider body (quota ids, model names,
// account hints) is logged server-side and never echoed, and the SSE `error`
// event carries the classification so the UI can tell a rate limit from an
// outage from a bad key.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeError } from "@/lib/errors";
import { ProviderRequestError, toProviderRequestError } from "@/lib/ai/errors";

describe("sanitizeError provider mapping", () => {
  it("maps a rate limit to an actionable, non-leaky message", () => {
    const res = sanitizeError(
      new ProviderRequestError(
        "Gemini API error: 429 quota exceeded for key AIzaSECRET123",
        429,
      ),
    );
    assert.equal(res.code, "PROVIDER_RATE_LIMITED");
    assert.match(res.message, /rate-limit/i);
    assert.ok(!res.message.includes("AIzaSECRET123"), "must not echo the provider body");
    assert.ok(!res.message.includes("quota"), "must not echo provider quota details");
    assert.match(res.errorId, /^err_/);
  });

  it("maps auth failures without echoing the provider text", () => {
    for (const status of [401, 403]) {
      const res = sanitizeError(
        new ProviderRequestError(`Gemini API error: ${status} invalid key sk-xyz`, status),
      );
      assert.equal(res.code, "PROVIDER_AUTH");
      assert.ok(!res.message.includes("sk-xyz"));
    }
  });

  it("maps server faults to a retryable-sounding message", () => {
    for (const status of [500, 502, 503, 504]) {
      const res = sanitizeError(new ProviderRequestError("boom", status));
      assert.equal(res.code, "PROVIDER_UNAVAILABLE");
      assert.match(res.message, /unavailable/i);
    }
  });

  it("maps any other provider status generically without echoing the body", () => {
    const res = sanitizeError(new ProviderRequestError("bad field xyz", 400));
    assert.equal(res.code, "PROVIDER_ERROR");
    assert.ok(!res.message.includes("xyz"));
  });

  it("still classifies non-provider errors as before", () => {
    assert.equal(sanitizeError(new Error("Resource not found")).code, "NOT_FOUND");
    assert.equal(sanitizeError(new Error("boom")).code, "INTERNAL_ERROR");
  });
});

describe("toProviderRequestError", () => {
  it("normalises an SDK-style error carrying a status and Retry-After", () => {
    const sdk = Object.assign(new Error("429 Too Many Requests"), {
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === "retry-after" ? "7" : null),
      },
    });
    const normalized = toProviderRequestError(sdk);
    assert.ok(normalized instanceof ProviderRequestError);
    assert.equal(normalized.status, 429);
    assert.equal(normalized.retryAfterMs, 7000);
  });

  it("leaves an abort/timeout error untouched so its type is preserved", () => {
    const abort = new Error("The operation was aborted");
    assert.equal(toProviderRequestError(abort), abort);
  });

  it("passes an existing ProviderRequestError through unchanged", () => {
    const err = new ProviderRequestError("x", 500);
    assert.equal(toProviderRequestError(err), err);
  });
});

describe("chat SSE error contract", () => {
  const SRC = join(import.meta.dirname, "..");
  const routeSource = readFileSync(join(SRC, "app/api/ai/chat/route.ts"), "utf8");

  it("emits the classified message, code and errorId in the SSE error event", () => {
    assert.match(routeSource, /type: "error"/);
    assert.match(routeSource, /content: sanitized\.message/);
    assert.match(routeSource, /code: sanitized\.code/);
    assert.match(routeSource, /errorId: sanitized\.errorId/);
  });

  it("renders the server-classified message in the chat surface", () => {
    const ui = readFileSync(join(SRC, "components/app/chat-interface.tsx"), "utf8");
    assert.match(ui, /data\.type === "error"/);
    assert.match(ui, /\$\{data\.content\}/);
  });
});
