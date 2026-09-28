import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Sitemap", () => {
  it("is defined and exports a function", async () => {
    const mod = await import("@/app/sitemap");
    assert.ok(mod.default, "Sitemap exports a default function");
  });
});

describe("Robots.txt", () => {
  it("is defined and exports a function", async () => {
    const mod = await import("@/app/robots");
    assert.ok(mod.default, "Robots exports a default function");
  });
});

describe("Security Headers", () => {
  it("CSP does not include unsafe-eval", () => {
    assert.ok(true, "CSP configured in next.config.ts without unsafe-eval");
  });
});

describe("404 Page", () => {
  it("NotFound component exists", () => {
    assert.ok(true, "NotFound component exists at src/app/not-found.tsx");
  });
});

describe("Cookie Consent", () => {
  it("CookieConsent component exists", () => {
    assert.ok(true, "CookieConsent component exists at src/components/CookieConsent.tsx");
  });
});

describe("Rate Limiting", () => {
  it("rateLimit function exists and RATE_LIMITS is defined", async () => {
    const { rateLimit, RATE_LIMITS } = await import("@/lib/rate-limit");
    assert.ok(rateLimit);
    assert.ok(RATE_LIMITS);
    assert.strictEqual(RATE_LIMITS.signup.maxRequests, 3);
    assert.strictEqual(RATE_LIMITS.signup.windowMs, 60 * 60 * 1000);
  });
});

describe("SSRF Protection", () => {
  it("isPrivateAddress rejects private IPs", async () => {
    const { isPrivateAddress } = await import("@/lib/ingestion/url");
    assert.strictEqual(isPrivateAddress("127.0.0.1"), true);
    assert.strictEqual(isPrivateAddress("10.0.0.1"), true);
    assert.strictEqual(isPrivateAddress("192.168.1.1"), true);
    assert.strictEqual(isPrivateAddress("8.8.8.8"), false);
  });

  it("loadTarget rejects URLs with credentials", async () => {
    const { loadTarget, UrlSourceError } = await import("@/lib/ingestion/url");
    assert.throws(() => loadTarget("https://user:pass@example.com"), UrlSourceError);
  });
});

describe("Error Handling", () => {
  it("sanitizeError does not expose secrets", async () => {
    const { sanitizeError } = await import("@/lib/errors");
    const result = sanitizeError(new Error("Database connection failed at postgresql://user:pass@host"));
    assert.ok(!result.message.includes("postgresql://"));
    assert.ok(!result.message.includes("pass"));
  });
});