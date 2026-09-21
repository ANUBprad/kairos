// P1-2: reading audit logs must require the view_audit_logs permission, not
// mere membership. Exercised at the real server-action boundary: the demo-mode
// session resolves to a real DB user whose Member row is flipped between
// OWNER/ADMIN (allowed) and MEMBER/VIEWER (denied) so the gate itself is what
// is under test — not the session plumbing.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { listAuditLogs, getAuditLogStats, exportAuditLogs } from "@/lib/actions/audit";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

if (process.env.NODE_ENV !== "production") {
  process.env.KAIROS_DEMO_MODE = "true";
}

describe("audit-log reads require view_audit_logs against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const orgOwner = randomUUID();
  const foreignOwner = randomUUID();
  const logWriter = randomUUID();

  let client: PrismaClient;
  let demoId: string;
  let foreignMemberId: string;

  async function setDemoRole(role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"): Promise<void> {
    await client.member.updateMany({
      where: { organizationId: orgId, userId: demoId },
      data: { role },
    });
  }

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    demoId = await ensureDemoUser();

    await client.user.createMany({
      data: [
        { id: orgOwner, email: `audit-owner-${randomUUID()}@test.local`, name: "Audit Owner" },
        { id: foreignOwner, email: `audit-fowner-${randomUUID()}@test.local`, name: "Foreign Owner" },
        { id: logWriter, email: `audit-writer-${randomUUID()}@test.local`, name: "Log Writer" },
      ],
    });

    await client.organization.create({
      data: {
        id: orgId,
        name: "Audit Org",
        slug: `audit-org-${randomUUID()}`,
        ownerId: orgOwner,
        members: {
          create: [
            { userId: orgOwner, role: "OWNER" },
            { userId: demoId, role: "OWNER" },
          ],
        },
        auditLogs: {
          create: [
            { action: "member.added", resource: "member", userId: logWriter },
            { action: "kb.created", resource: "knowledge_base", userId: logWriter },
          ],
        },
      },
    });

    await client.organization.create({
      data: {
        id: foreignOrgId,
        name: "Audit Foreign Org",
        slug: `audit-f-org-${randomUUID()}`,
        ownerId: foreignOwner,
        members: {
          create: [{ userId: foreignOwner, role: "OWNER" }],
        },
        auditLogs: {
          create: [{ action: "secret.action", resource: "secret", userId: foreignOwner }],
        },
      },
    });

    const foreignMember = await client.member.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: foreignOrgId, userId: foreignOwner } },
      select: { id: true },
    });
    foreignMemberId = foreignMember.id;
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
      await client.user.deleteMany({ where: { id: { in: [orgOwner, foreignOwner, logWriter] } } });
    } finally {
      await client.$disconnect();
    }
  });

  function requireEnvironment(t: { skip: (message?: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return false;
    }
    if (!isDemoModeEnabled()) {
      t.skip("requires KAIROS_DEMO_MODE=true for the session");
      return false;
    }
    return true;
  }

  it("lets an OWNER read, summarize and export audit logs (with writer email)", async (t) => {
    if (!requireEnvironment(t)) return;
    await setDemoRole("OWNER");

    const list = await listAuditLogs(orgId);
    assert.equal(list.success, true);
    assert.equal(list.total, 2);
    assert.ok(list.logs?.every((l) => l.user.email), "authorized reads carry the writer email");

    const stats = await getAuditLogStats(orgId);
    assert.equal(stats.success, true);
    assert.equal(stats.stats.total, 2);

    const exp = await exportAuditLogs(orgId);
    assert.equal(exp.success, true);
    assert.equal((exp.data as unknown[]).length, 2);
  });

  it("denies a MEMBER before any log data can leak", async (t) => {
    if (!requireEnvironment(t)) return;
    await setDemoRole("MEMBER");

    const list = await listAuditLogs(orgId);
    assert.equal(list.success, false);
    assert.equal(list.logs, undefined, "no logs may reach a MEMBER");
    assert.equal(list.total, undefined, "no count may reach a MEMBER");
    assert.match(list.error ?? "", /Access denied/);

    const stats = await getAuditLogStats(orgId);
    assert.equal(stats.success, false);
    assert.equal(stats.stats, undefined);

    const exp = await exportAuditLogs(orgId);
    assert.equal(exp.success, false);
    assert.equal(exp.data, undefined);
  });

  it("denies a VIEWER", async (t) => {
    if (!requireEnvironment(t)) return;
    await setDemoRole("VIEWER");

    const list = await listAuditLogs(orgId);
    assert.equal(list.success, false);
    assert.equal(list.logs, undefined, "no logs may reach a VIEWER");
    assert.match(list.error ?? "", /Access denied/);
  });

  it("still lets an ADMIN read", async (t) => {
    if (!requireEnvironment(t)) return;
    await setDemoRole("ADMIN");

    const list = await listAuditLogs(orgId);
    assert.equal(list.success, true);
    assert.equal(list.total, 2);
  });

  it("denies reads of a foreign organization the caller is not a member of", async (t) => {
    if (!requireEnvironment(t)) return;
    await setDemoRole("OWNER");

    const list = await listAuditLogs(foreignOrgId);
    assert.equal(list.success, false);
    assert.match(list.error ?? "", /Organization not found/);

    const exp = await exportAuditLogs(foreignOrgId);
    assert.equal(exp.success, false);
    assert.equal(exp.data, undefined);
  });
});