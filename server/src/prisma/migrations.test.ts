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
const reliabilityMigration = readFileSync(
  new URL(
    "../../prisma/migrations/20261123150000_reliability_outbox_and_artifact_leases/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const round3Migration = readFileSync(
  new URL(
    "../../prisma/migrations/20261123160000_round3_concurrency_guards/migration.sql",
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
    // New users start at zero; the signup hook grants 50 credits atomically
    // with the ledger row. Historical balances are never rewritten.
    assert.match(schema, /credits\s+Int\s+@default\(0\)/);
    assert.match(round3Migration, /ALTER COLUMN "credits" SET DEFAULT 0/);
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
    assert.doesNotMatch(reliabilityMigration, /DROP TABLE/i);
    assert.doesNotMatch(round3Migration, /DROP TABLE/i);
  });

  it("declares idempotent chat request keys in schema and migration", () => {
    assert.match(schema, /requestKey\s+String\?\s+@unique/);
    assert.match(round3Migration, /ADD COLUMN IF NOT EXISTS "requestKey" TEXT/);
    assert.match(round3Migration, /CREATE UNIQUE INDEX IF NOT EXISTS "message_requestKey_key"/);
  });

  it("declares the durable outbox in schema and the forward-only migration", () => {
    assert.match(schema, /model DurableJob/);
    assert.match(schema, /key\s+String\s+@unique/);
    assert.match(schema, /@@index\(\[status, availableAt\]\)/);
    assert.match(schema, /enum DurableJobStatus/);
    assert.match(reliabilityMigration, /CREATE TYPE "DurableJobStatus"/);
    assert.match(reliabilityMigration, /CREATE TABLE IF NOT EXISTS "durable_job"/);
    assert.match(reliabilityMigration, /CREATE UNIQUE INDEX IF NOT EXISTS "durable_job_key_key"/);
  });

  it("declares artifact leases in schema and the forward-only migration", () => {
    assert.match(schema, /leaseToken\s+String\?/);
    assert.match(schema, /leaseExpiresAt\s+DateTime\?/);
    assert.match(schema, /@@index\(\[status, leaseExpiresAt\]\)/);
    assert.match(reliabilityMigration, /ADD COLUMN IF NOT EXISTS "leaseToken"/);
    assert.match(reliabilityMigration, /ADD COLUMN IF NOT EXISTS "leaseExpiresAt"/);
  });

  it("does not rewrite historical application data in the reliability migration", () => {
    assert.doesNotMatch(reliabilityMigration, /\bUPDATE\s+/i);
    assert.doesNotMatch(reliabilityMigration, /\bDELETE\s+/i);
    assert.doesNotMatch(reliabilityMigration, /\bDROP\s+COLUMN/i);
  });

  it("does not rewrite historical application data in the round 3 migration", () => {
    // Only DDL: no UPDATE/DELETE of existing users, payments or credit rows.
    assert.doesNotMatch(round3Migration, /\bUPDATE\s+/i);
    assert.doesNotMatch(round3Migration, /\bDELETE\s+/i);
    assert.doesNotMatch(round3Migration, /\bDROP\s+COLUMN/i);
    assert.match(round3Migration, /no historical rows are rewritten/i);
  });
});
