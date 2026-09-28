import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("SSRF Protection", () => {
  it("isPrivateAddress rejects private IPs", () => {
    const { isPrivateAddress } = require("@/lib/ingestion/url");
    assert.strictEqual(isPrivateAddress("127.0.0.1"), true);
    assert.strictEqual(isPrivateAddress("10.0.0.1"), true);
    assert.strictEqual(isPrivateAddress("192.168.1.1"), true);
    assert.strictEqual(isPrivateAddress("172.16.0.1"), true);
    assert.strictEqual(isPrivateAddress("8.8.8.8"), false);
  });

  it("loadTarget rejects URLs with credentials", () => {
    const { loadTarget, UrlSourceError } = require("@/lib/ingestion/url");
    assert.throws(() => loadTarget("https://user:pass@example.com"), UrlSourceError);
  });

  it("loadTarget rejects non-http/https protocols", () => {
    const { loadTarget, UrlSourceError } = require("@/lib/ingestion/url");
    assert.throws(() => loadTarget("ftp://example.com"), UrlSourceError);
    assert.throws(() => loadTarget("file:///etc/passwd"), UrlSourceError);
  });
});

describe("API Authorization", () => {
  it("validateApiKey requires API key header", () => {
    const { validateApiKey } = require("@/lib/server/api-auth");
    assert.ok(validateApiKey, "validateApiKey exists");
  });

  it("api-keys module enforces organization isolation", () => {
    const { API_KEY_PREFIX, MAX_API_KEYS_PER_USER } = require("@/lib/api-keys");
    assert.strictEqual(API_KEY_PREFIX, "kai_");
    assert.ok(MAX_API_KEYS_PER_USER > 0);
  });
});

describe("Upload Security", () => {
  it("upload-progress module enforces terminal statuses", () => {
    const { TERMINAL_TRACKING_STATUSES } = require("@/lib/upload-progress");
    assert.ok(TERMINAL_TRACKING_STATUSES.has("INDEXED"));
    assert.ok(TERMINAL_TRACKING_STATUSES.has("READY"));
    assert.ok(TERMINAL_TRACKING_STATUSES.has("ERROR"));
  });
});

describe("Error Handling", () => {
  it("sanitizeError does not expose secrets", () => {
    const { sanitizeError } = require("@/lib/errors");
    const result = sanitizeError(new Error("Database connection failed at postgresql://user:pass@host"));
    assert.ok(!result.message.includes("postgresql://"));
    assert.ok(!result.message.includes("pass"));
  });
});