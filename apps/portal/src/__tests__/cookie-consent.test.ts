import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

function stubLocalStorage(value: string | null) {
  const store = value === null ? {} : { kairos_cookie_consent: value };
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => (key in store ? store[key as keyof typeof store] : null),
    setItem: () => {},
    removeItem: () => {},
  };
}

describe("Cookie consent / analytics gating", () => {
  beforeEach(() => {
    stubLocalStorage(null);
  });

  it("fresh visitor with no stored choice does not consent (PostHog must not init)", async () => {
    const { getConsent } = await import("@/lib/telemetry/analytics");
    assert.strictEqual(getConsent(), false);
  });

  it("rejecting analytics does not consent", async () => {
    stubLocalStorage(JSON.stringify({ essential: true, analytics: false, timestamp: Date.now() }));
    const { getConsent } = await import("@/lib/telemetry/analytics");
    assert.strictEqual(getConsent(), false);
  });

  it("accepting analytics consents", async () => {
    stubLocalStorage(JSON.stringify({ essential: true, analytics: true, timestamp: Date.now() }));
    const { getConsent } = await import("@/lib/telemetry/analytics");
    assert.strictEqual(getConsent(), true);
  });

  it("malformed stored consent does not consent", async () => {
    stubLocalStorage("not-json{{{");
    const { getConsent } = await import("@/lib/telemetry/analytics");
    assert.strictEqual(getConsent(), false);
  });

  it("stored consent without an analytics flag does not consent", async () => {
    stubLocalStorage(JSON.stringify({ essential: true }));
    const { getConsent } = await import("@/lib/telemetry/analytics");
    assert.strictEqual(getConsent(), false);
  });
});

