import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Regression guard for production session resolution.
//
// auth-utils.getServerSession() is the single server-side session entry point.
// In production it MUST resolve the real Better Auth session and must never
// fabricate the demo user. These tests pin the demo gate that makes the demo
// fallback unreachable in production.
//
// A live Better Auth session cannot be exercised here (needs the Next.js
// request scope + a running DB + signed cookies), so the boundary logic of
// the demo fallback is checked deterministically against the module itself.

import { isDemoModeEnabled, getDemoSession } from "@/lib/server/demo-user";

// ponytail: NODE_ENV is read-only in TS types; cast once here for test env mutation.
const env = process.env as Record<string, string | undefined>;
const DEMO_EMAIL = "demo@kairos.dev";

function withEnv(next: string, demo: string | undefined, fn: () => void | Promise<void>) {
  const savedNode = env.NODE_ENV;
  const savedDemo = env.KAIROS_DEMO_MODE;
  try {
    env.NODE_ENV = next;
    env.KAIROS_DEMO_MODE = demo;
    return Promise.resolve(fn());
  } finally {
    if (savedNode !== undefined) env.NODE_ENV = savedNode;
    else delete env.NODE_ENV;
    if (savedDemo !== undefined) env.KAIROS_DEMO_MODE = savedDemo;
    else delete env.KAIROS_DEMO_MODE;
  }
}

describe("Auth session — demo gate", () => {
  it("demo mode is never enabled in production even with KAIROS_DEMO_MODE=true", () => {
    withEnv("production", "true", () => {
      assert.equal(isDemoModeEnabled(), false);
    });
  });

  it("production never fabricates the demo user session", async () => {
    await withEnv("production", "true", async () => {
      const session = await getDemoSession();
      assert.equal(session, null);
    });
  });

  it("production returns null even if demo is requested via env", async () => {
    await withEnv("production", "true", async () => {
      assert.equal(isDemoModeEnabled(), false);
    });
  });

  it("demo session exists only when demo mode is explicitly enabled", async () => {
    await withEnv("development", "true", async () => {
      assert.equal(isDemoModeEnabled(), true);
      const session = await getDemoSession();
      assert.notEqual(session, null);
      assert.equal(session?.user.email, DEMO_EMAIL);
      assert.equal(session?.user.role, "ADMIN");
    });
  });

  it("demo session is absent without KAIROS_DEMO_MODE=true in non-production", async () => {
    await withEnv("development", undefined, async () => {
      assert.equal(isDemoModeEnabled(), false);
      const session = await getDemoSession();
      assert.equal(session, null);
    });
  });
});
