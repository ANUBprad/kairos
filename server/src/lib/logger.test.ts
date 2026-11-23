import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactForLog } from "./logger.js";

describe("log redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const output = redactForLog({
      apiKey: "sk-secret",
      nested: { password: "hunter2" },
      safe: "visible",
    }) as Record<string, unknown>;

    assert.equal(output.apiKey, "[REDACTED]");
    assert.equal((output.nested as Record<string, unknown>).password, "[REDACTED]");
    assert.equal(output.safe, "visible");
  });

  it("masks bearer tokens and bounds long strings", () => {
    const output = redactForLog({
      message: "Authorization: Bearer abc.def-123",
      long: "x".repeat(5000),
    }) as Record<string, unknown>;

    assert.doesNotMatch(output.message as string, /abc\.def-123/);
    assert.match(output.message as string, /\[REDACTED\]/);
    assert.match(output.long as string, /\[truncated\]/);
  });

  it("omits error stacks", () => {
    const output = redactForLog(new Error("failed")) as Record<string, unknown>;
    assert.equal(output.stack, "[stack omitted]");
    assert.equal(output.message, "failed");
  });
});
