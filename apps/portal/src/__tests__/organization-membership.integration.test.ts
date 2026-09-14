import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type MemberRole } from "@prisma/client";
import { addMember, updateMemberRole, removeMember } from "@/lib/organizations";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("organization member administration against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];

  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const owner = randomUUID();
  const admin = randomUUID();
  const member = randomUUID();
  const viewer = randomUUID();
  const outsider = randomUUID();
  const foreignOwner = randomUUID();
  const foreignMember = randomUUID();
  const target = randomUUID();
  const equalTarget = randomUUID();
  const ownerTarget = randomUUID();

  let client: PrismaClient;
  let memberRowId: string;
  let viewerRowId: string;
  let foreignMemberRowId: string;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    userIds.push(owner, admin, member, viewer, outsider, foreignOwner, foreignMember, target, equalTarget, ownerTarget);
    orgIds.push(orgId, foreignOrgId);

    await client.user.createMany({
      data: [
        { id: owner, email: `org-owner-${randomUUID()}@test.local`, name: "Owner" },
        { id: admin, email: `org-admin-${randomUUID()}@test.local`, name: "Admin" },
        { id: member, email: `org-member-${randomUUID()}@test.local`, name: "Member" },
        { id: viewer, email: `org-viewer-${randomUUID()}@test.local`, name: "Viewer" },
        { id: outsider, email: `org-out-${randomUUID()}@test.local`, name: "Outsider" },
        { id: foreignOwner, email: `org-fowner-${randomUUID()}@test.local`, name: "Foreign Owner" },
        { id: foreignMember, email: `org-fmember-${randomUUID()}@test.local`, name: "Foreign Member" },
        { id: target, email: `org-target-${randomUUID()}@test.local`, name: "Target" },
        { id: equalTarget, email: `org-eqtarget-${randomUUID()}@test.local`, name: "Equal Target" },
        { id: ownerTarget, email: `org-owntarget-${randomUUID()}@test.local`, name: "Owner Target" },
      ],
    });

    await client.organization.create({
      data: {
        id: orgId,
        name: "Org A",
        slug: `org-a-${randomUUID()}`,
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
        name: "Org B",
        slug: `org-b-${randomUUID()}`,
        ownerId: foreignOwner,
        members: {
          create: [
            { userId: foreignOwner, role: "OWNER" },
            { userId: foreignMember, role: "MEMBER" },
          ],
        },
      },
    });

    const memberRow = await client.member.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: member } },
      select: { id: true },
    });
    memberRowId = memberRow.id;

    const viewerRow = await client.member.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: viewer } },
      select: { id: true },
    });
    viewerRowId = viewerRow.id;

    const foreignMemberRow = await client.member.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: foreignOrgId, userId: foreignMember } },
      select: { id: true },
    });
    foreignMemberRowId = foreignMemberRow.id;
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function memberRole(userId: string): Promise<MemberRole | null> {
    return (await client.member.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { role: true },
    }))?.role ?? null;
  }

  it("lets an authorized organization administrator add a member", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await addMember(orgId, target, "MEMBER", admin);
    assert.equal(await memberRole(target), "MEMBER");
  });

  it("rejects a normal organization member", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, randomUUID(), "MEMBER", member), /Only owners and admins/);
  });

  it("rejects a viewer", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, randomUUID(), "MEMBER", viewer), /Only owners and admins/);
  });

  it("rejects a caller from a foreign organization", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, randomUUID(), "MEMBER", foreignOwner), /Only owners and admins/);
  });

  it("rejects a forged or invalid organization id", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(randomUUID(), randomUUID(), "MEMBER", admin), /Only owners and admins/);
  });

  it("rejects self-escalation through add and update paths", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, viewer, "ADMIN", viewer), /Only owners and admins/);
    await assert.rejects(() => addMember(orgId, outsider, "ADMIN", outsider), /Only owners and admins/);
    await assert.rejects(() => updateMemberRole(orgId, viewerRowId, "ADMIN", viewer), /Only the organization owner/);
  });

  it("rejects granting a role higher than the caller's authority", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, randomUUID(), "OWNER", admin), /Cannot grant a role higher than your own role/);
  });

  it("lets an administrator assign an equal or lower role", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await addMember(orgId, equalTarget, "ADMIN", admin);
    assert.equal(await memberRole(equalTarget), "ADMIN");
  });

  it("lets the owner assign the owner role", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await addMember(orgId, ownerTarget, "OWNER", owner);
    assert.equal(await memberRole(ownerTarget), "OWNER");
  });

  it("rejects duplicate membership", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, target, "VIEWER", admin), /already a member/);
  });

  it("rejects an invalid target user", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => addMember(orgId, "no-such-user", "MEMBER", owner));
  });

  it("prevents members of one organization from changing membership in another", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(() => updateMemberRole(orgId, foreignMemberRowId, "ADMIN", owner), /Member not found/);
    await assert.rejects(() => removeMember(orgId, foreignMemberRowId, owner), /Member not found/);
  });

  it("keeps legitimate in-organization role updates working for the owner", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await updateMemberRole(orgId, memberRowId, "ADMIN", owner);
    assert.equal(await memberRole(member), "ADMIN");
  });
});