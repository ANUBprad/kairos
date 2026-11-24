import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logger, redactForLog } from "./logger.js";
import { runWithRequestId } from "./observability/request-context.js";

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

  it("redacts provider keys embedded in free-form messages", () => {
    const output = redactForLog(
      "provider failed with sk-abcdefghijklmnopqrst or rzp_test_abcdefgh1234",
    ) as string;
    assert.doesNotMatch(output, /sk-abcdefghijklmnopqrst/);
    assert.doesNotMatch(output, /rzp_test_abcdefgh1234/);
  });

  it("redacts session, OTP and card-shaped metadata keys", () => {
    const output = redactForLog({
      session_token: "visible-never",
      otp: "123456",
      cardNumber: "4111111111111111",
      safeField: "kept",
    }) as Record<string, unknown>;
    assert.equal(output.session_token, "[REDACTED]");
    assert.equal(output.otp, "[REDACTED]");
    assert.equal(output.cardNumber, "[REDACTED]");
    assert.equal(output.safeField, "kept");
  });

  it("applies redaction to the log message argument itself", () => {
    const original = console.log;
    let line = "";
    console.log = (value: unknown) => {
      line = String(value);
    };
    try {
      logger.info("token sk-abcdefghijklmnopqrst accepted");
    } finally {
      console.log = original;
    }
    assert.doesNotMatch(line, /sk-abcdefghijklmnopqrst/);
    assert.match(line, /\[REDACTED\]/);
  });

  it("adds the active request id to structured logs", () => {
    const original = console.log;
    let line = "";
    console.log = (value: unknown) => {
      line = String(value);
    };
    try {
      runWithRequestId("trace-log123456", () => {
        logger.info("correlated event");
      });
    } finally {
      console.log = original;
    }
    const payload = JSON.parse(line) as Record<string, unknown>;
    assert.equal(payload.level, "info");
    assert.equal(payload.requestId, "trace-log123456");
  });
});
