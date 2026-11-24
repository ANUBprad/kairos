#!/usr/bin/env node
/** Regression guard for the post-auth open redirect fix (Phase 08 P2). */
import assert from "node:assert/strict";
import { safeRedirectPath } from "../client/features/auth/lib/safe-redirect.ts";

const safe = ["/dashboard", "/workspace/abc", "/dashboard?tab=1#top"];
for (const value of safe) assert.equal(safeRedirectPath(value), value, value);

const unsafe = [
  "https://evil.example",
  "http://evil.example",
  "//evil.example",
  "/\\evil.example",
  "javascript:alert(1)",
  "/dashboard\\evil.example",
  "/dashboard%2f%2fevil.example",
  "/dashboard\nX-Evil: 1",
  "dashboard",
  null,
  undefined,
  "x".repeat(2049),
];
for (const value of unsafe) {
  assert.equal(safeRedirectPath(value), "/dashboard", String(value));
}

console.log(`SAFE REDIRECT GUARD: PASS (${safe.length + unsafe.length} cases)`);
