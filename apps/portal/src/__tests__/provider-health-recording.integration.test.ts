import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { recordProviderRequest, getProviderHealthSummary } from "@/lib/observability/provider-health";
import { ensureDemoUser } from "@/lib/server/demo-user";

// The observability board is only worth its columns if something actually
// records into it: `recordProviderHealth` had no caller at all, so every
// provider looked as if it had never been used.

const SRC = join(import.meta.dirname, "..");
const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

describe("provider health recording", () => {
  const createdOrgIds: string[] = [];
  // Distinct provider name so the rows cannot collide with other tests.
  const provider = `provtest_${randomUUID().slice(0, 8)}`;
  const model = "test-model";

  async function makeOrg(): Promise<string> {
    const userId = await ensureDemoUser();
    const org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: "Provider health test",
        slug: `provider-health-test-${randomUUID()}`,
        ownerId: userId,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    createdOrgIds.push(org.id);
    return org.id;
  }

  after(async () => {
    if (!testDbUrl) return;
    for (const id of createdOrgIds) {
      await prisma.organization.delete({ where: { id } }).catch(() => undefined);
    }
  });

  it("records a running average instead of a frozen first sample", async () => {
    const orgId = await makeOrg();
    await recordProviderRequest({ organizationId: orgId, provider, model, outcome: "success", latencyMs: 100 });
    await recordProviderRequest({ organizationId: orgId, provider, model, outcome: "success", latencyMs: 300 });

    const summary = await getProviderHealthSummary(orgId, 7);
    const row = summary.byProvider[provider];
    assert.ok(row, "a provider must appear once a request has been recorded");
    assert.equal(row.totalRequests, 2);
    assert.equal(row.avgLatencyMs, 200, "the average must move with new samples, not stay at the first one");
  });

  it("never mixes one organization's traffic into another's board", async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await recordProviderRequest({ organizationId: orgA, provider, model, outcome: "success", latencyMs: 10 });

    const summaryB = await getProviderHealthSummary(orgB, 7);
    assert.equal(
      summaryB.byProvider[provider],
      undefined,
      "another organization's usage must not leak into this org's health board",
    );
  });

  it("counts a failure with its bounded error code", async () => {
    const orgId = await makeOrg();
    await recordProviderRequest({
      organizationId: orgId,
      provider,
      model,
      outcome: "error",
      latencyMs: 5,
      errorCode: "provider_error",
    });

    const summary = await getProviderHealthSummary(orgId, 7);
    const row = summary.byProvider[provider];
    assert.equal(row.errorCount, 1);
    assert.equal(row.successCount, 0);
    assert.equal(row.uptime, 0);
  });

  it("is best-effort: a sample without an organization is a silent no-op", async () => {
    await assert.doesNotReject(recordProviderRequest({ provider, model, outcome: "success", latencyMs: 1 }));
  });

  it("is wired into the chat engine", () => {
    const engine = readFileSync(join(SRC, "lib/ai/chat/engine.ts"), "utf8");
    assert.ok(
      engine.includes("recordProviderRequest"),
      "the chat engine must feed provider health, or the board stays permanently empty",
    );
  });
});
