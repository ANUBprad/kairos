// Provider-health honesty: an observability surface must not invent a green
// provider status. A provider with no recorded requests carries no health
// signal, so the summary omits it rather than reporting a fabricated 100%
// uptime, and the UI never hardcodes a 100% success rate. The live page also
// must not call stored aggregates "real-time".
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getProviderHealthSummary } from "@/lib/observability/provider-health";
import { ensureDemoUser } from "@/lib/server/demo-user";

const SRC = join(import.meta.dirname, "..");
const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

describe("provider health honesty", () => {
  it("does not label stored aggregates as real-time", () => {
    const page = readFileSync(join(SRC, "app/app/observability/live/page.tsx"), "utf8");
    assert.ok(
      !page.includes("Real-time"),
      "live metrics page must not claim real-time when it aggregates stored traces",
    );
  });

  it("does not hardcode a 100% success rate for providers with no requests", () => {
    const page = readFileSync(
      join(SRC, "app/app/observability/providers/page.tsx"),
      "utf8",
    );
    assert.ok(
      !page.includes(": '100'"),
      "provider page must not fabricate a 100% success rate",
    );
  });

  describe("getProviderHealthSummary", () => {
    const createdOrgIds: string[] = [];

    after(async () => {
      if (!testDbUrl) return;
      for (const id of createdOrgIds) {
        await prisma.organization.delete({ where: { id } }).catch(() => undefined);
      }
    });

    it("omits a provider that recorded no requests instead of reporting 100% uptime", async (t) => {
      if (!testDbUrl) {
        t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
        return;
      }
      const demoUser = await ensureDemoUser();
      const orgId = randomUUID();
      await prisma.organization.create({
        data: {
          id: orgId,
          name: "Provider Health Honesty Org",
          slug: `ph-honesty-${randomUUID()}`,
          ownerId: demoUser,
          members: { create: [{ userId: demoUser, role: "OWNER" }] },
        },
      });
      createdOrgIds.push(orgId);

      await prisma.providerHealth.createMany({
        data: [
          {
            provider: "gemini",
            model: "gemini-embedding-001",
            date: new Date(),
            organizationId: orgId,
            totalRequests: 10,
            successCount: 9,
            errorCount: 1,
          },
          {
            provider: "openai",
            model: "text-embedding-3-small",
            date: new Date(),
            organizationId: orgId,
            totalRequests: 0,
          },
        ],
      });

      const summary = await getProviderHealthSummary(orgId, 7);
      assert.deepEqual(
        Object.keys(summary.byProvider),
        ["gemini"],
        "a provider with no requests must not be surfaced with a fabricated uptime",
      );
      assert.equal(summary.byProvider.gemini?.uptime, 90);
    });
  });
});
