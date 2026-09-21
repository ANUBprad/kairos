// P1-1: an inviter must never be able to grant a role higher than their own.
// REQUIREMENT_DESCRIPTION: Reusing the existing role hierarchy (isRoleSufficient),
// ADMIN cannot invite OWNER, but OWNER (and ADMIN for equal/lower roles) can.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { inviteMember } from "@/lib/organizations";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("organization invitation role hierarchy against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const owner = randomUUID();
  const admin = randomUUID();
  const member = randomUUID();
  const viewer = randomUUID();
  const outsider = randomUUID();
  const foreignOwner = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: owner, email: `inv-owner-${randomUUID()}@test.local`, name: "Owner" },
        { id: admin, email: `inv-admin-${randomUUID()}@test.local`, name: "Admin" },
        { id: member, email: `inv-member-${randomUUID()}@test.local`, name: "Member" },
        { id: viewer, email: `inv-viewer-${randomUUID()}@test.local`, name: "Viewer" },
        { id: outsider, email: `inv-out-${randomUUID()}@test.local`, name: "Outsider" },
        { id: foreignOwner, email: `inv-fowner-${randomUUID()}@test.local`, name: "Foreign Owner" },
      ],
    });

    await client.organization.create({
      data: {
        id: orgId,
        name: "Inv Org A",
        slug: `inv-org-a-${randomUUID()}`,
        ownerId: owner,
        members: {
          create: [
            { userId: owner, role: "OWNER" },
            { userId: admin, role: "ADMIN" },
            { userId: member, role: "MEMBER" },
            { userId: viewer, role: "VIEWER" },
          ],
        },
      },
    });

    await client.organization.create({
      data: {
        id: foreignOrgId,
        name: "Inv Org B",
        slug: `inv-org-b-${randomUUID()}`,
        ownerId: foreignOwner,
        members: {
          create: [{ userId: foreignOwner, role: "OWNER" }],
        },
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
      await client.user.deleteMany({
        where: { id: { in: [owner, admin, member, viewer, outsider, foreignOwner] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  function invite(byUserId: string, role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER") {
    return inviteMember(orgId, byUserId, {
      email: `someone-new-${randomUUID()}@test.local`,
      role,
    });
  }

  it("rejects an ADMIN invitation that grants OWNER", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => invite(admin, "OWNER"), /Cannot grant a role higher than your own role/);
  });

  it("lets the OWNER invite an OWNER", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const { invitationId } = await invite(owner, "OWNER");
    const row = await client.invitation.findUnique({ where: { id: invitationId }, select: { role: true, status: true } });
    assert.equal(row?.role, "OWNER");
    assert.equal(row?.status, "PENDING");
    await client.invitation.deleteMany({ where: { id: invitationId } });
  });

  it("lets an ADMIN invite an equal or lower role", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const eq = await invite(admin, "ADMIN");
    const lo = await invite(admin, "MEMBER");
    assert.ok(eq.invitationId);
    assert.ok(lo.invitationId);
    await client.invitation.deleteMany({ where: { id: { in: [eq.invitationId, lo.invitationId] } } });
  });

  it("rejects invitations from a plain MEMBER", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => invite(member, "MEMBER"), /Only owners and admins can invite members/);
  });

  it("rejects invitations from a VIEWER", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => invite(viewer, "MEMBER"), /Only owners and admins can invite members/);
  });

  it("rejects invitations from a non-member", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => invite(outsider, "MEMBER"), /Only owners and admins can invite members/);
  });

  it("rejects invitations from a member of a foreign organization", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => invite(foreignOwner, "MEMBER"), /Only owners and admins can invite members/);
  });
});