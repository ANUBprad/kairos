import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const writes: Record<string, unknown>[] = [];
const client = {
  member: { findUnique: async () => ({ role: "OWNER" }) },
  organization: { update: async (args: { data: Record<string, unknown> }) => {
    writes.push(args.data);
    return { id: "org", _count: { members: 1, projects: 1 } };
  } },
  auditLog: { create: async () => ({}) },
  alertRule: {
    create: async (args: { data: Record<string, unknown> }) => { writes.push(args.data); return {}; },
    update: async (args: { data: Record<string, unknown> }) => { writes.push(args.data); return {}; },
  },
  telemetryConfig: { upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
    writes.push(args.create, args.update); return {};
  } },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

describe("server action mutation field allowlists", () => {
  it("does not forward client-supplied Prisma relations or tenant IDs", async () => {
    const { updateOrganization } = await import("@/lib/organizations");
    const { createAlertRule, updateAlertRule } = await import("@/lib/observability/alerting");
    const { updateTelemetryConfig } = await import("@/lib/observability/storage");
    const injected = {
      organizationId: "foreign", id: "foreign", projects: { connect: { id: "foreign-project" } },
      organization: { connect: { id: "foreign" } }, events: { connect: { id: "foreign-event" } },
    };
    await updateOrganization("org", "user", { ...injected, name: "Renamed" });
    await createAlertRule("org", { ...injected, name: "Rule", metric: "request_count", operator: ">", threshold: 1 });
    await updateAlertRule("rule", { ...injected, name: "Updated" }, "org");
    await updateTelemetryConfig("org", { ...injected, retentionDays: 30 });
    assert.equal(writes.length, 5);
    for (const data of writes) {
      for (const field of ["id", "projects", "organization", "events"]) assert.equal(field in data, false, field);
      assert.notEqual(data.organizationId, "foreign");
    }
    assert.equal(writes[0].name, "Renamed");
    assert.equal(writes[2].name, "Updated");
    assert.equal(writes[4].retentionDays, 30);
  });
});
