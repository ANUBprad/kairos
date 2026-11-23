import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const schema = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const reconciliation = readFileSync(
  new URL(
    "../../prisma/migrations/20261123143000_security_and_schema_reconciliation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("schema and migration parity", () => {
  it("declares the credit ledger idempotency key in schema and migration", () => {
    assert.match(schema, /idempotencyKey\s+String\?\s+@unique/);
    assert.match(reconciliation, /"idempotencyKey" TEXT/);
    assert.match(reconciliation, /CREATE UNIQUE INDEX/i);
  });

  it("declares user credits and nullable plan in schema and migration", () => {
    assert.match(schema, /credits\s+Int\s+@default\(50\)/);
    assert.match(reconciliation, /ADD COLUMN IF NOT EXISTS "credits"/);
    assert.match(schema, /plan\s+PlanType\?/);
    assert.match(reconciliation, /DROP NOT NULL/);
  });

  it("declares OAuth nonce state and artifact refunds in both places", () => {
    assert.match(schema, /model OAuthStateNonce/);
    assert.match(reconciliation, /CREATE TABLE IF NOT EXISTS "oauth_state_nonce"/);
    assert.match(schema, /refundedAt\s+DateTime\?/);
    assert.match(reconciliation, /ADD COLUMN IF NOT EXISTS "refundedAt"/);
  });

  it("preserves the legacy orphan table instead of dropping it", () => {
    assert.doesNotMatch(reconciliation, /DROP TABLE/i);
  });
});
