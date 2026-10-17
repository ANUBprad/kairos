// P1 authorization sweep: untrusted role values are rejected at the boundary,
// the sole OWNER cannot lock the organization out, member mutations are scoped
// to the caller's tenant, and a workspace owner in one organization can never
// reach another.
//
// Workspace isolation IS the anonymous-ownership contract: an anonymous visitor
// is an ordinary user whose only membership is their own auto-provisioned
// organization (see lib/server/workspace.ts provisionUserWorkspace), and no
// authorization check consults an anonymous flag. These assertions pin that a
// user who owns one workspace still cannot read or write any other.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  addMember,
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/lib/organizations";
import {
  checkPermission,
  getMembership,
  getMembershipForResource,
  isMemberRole,
} from "@/lib/rbac";
import type { MemberRole } from "@prisma/client";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("organization role and tenant authorization against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const roleOrgId = randomUUID();
  const soloOrgId = randomUUID();
  const coOwnerOrgId = randomUUID();
  const foreignOrgId = randomUUID();
  const isolatedOrgId = randomUUID();

  let client: PrismaClient;
  const userIds: string[] = [];
  let owner = "";
  let member = "";
  let outsider = "";
  let soloOwner = "";
  let coOwnerA = "";
  let coOwnerB = "";
  let foreignOwner = "";
  let isolated = "";

  function newUserId(): string {
    const id = randomUUID();
    userIds.push(id);
    return id;
  }

  async function memberIdFor(organizationId: string, userId: string): Promise<string> {
    const row = await client.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true },
    });
    assert.ok(row, "expected a member row");
    return row!.id;
  }

  async function roleOf(organizationId: string, userId: string): Promise<string | null> {
    const row = await client.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    return row?.role ?? null;
  }

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    owner = newUserId();
    member = newUserId();
    outsider = newUserId();
    soloOwner = newUserId();
    coOwnerA = newUserId();
    coOwnerB = newUserId();
    foreignOwner = newUserId();
    isolated = newUserId();

    await client.user.createMany({
      data: userIds.map((id) => ({ id, email: `role-${id}@test.local`, name: id.slice(0, 6) })),
    });

    await client.organization.create({
      data: {
        id: roleOrgId,
        name: "Role Org",
        slug: `role-${randomUUID()}`,
        ownerId: owner,
        members: {
          create: [
            { userId: owner, role: "OWNER" },
            { userId: member, role: "MEMBER" },
          ],
        },
      },
    });

    await client.organization.create({
      data: {
        id: soloOrgId,
        name: "Solo Org",
        slug: `solo-${randomUUID()}`,
        ownerId: soloOwner,
        members: { create: { userId: soloOwner, role: "OWNER" } },
      },
    });

    await client.organization.create({
      data: {
        id: coOwnerOrgId,
        name: "Co-owner Org",
        slug: `coowner-${randomUUID()}`,
        ownerId: coOwnerA,
        members: {
          create: [
            { userId: coOwnerA, role: "OWNER" },
            { userId: coOwnerB, role: "OWNER" },
          ],
        },
      },
    });

    await client.organization.create({
      data: {
        id: foreignOrgId,
        name: "Foreign Org",
        slug: `foreign-${randomUUID()}`,
        ownerId: foreignOwner,
        members: { create: { userId: foreignOwner, role: "OWNER" } },
      },
    });

    await client.organization.create({
      data: {
        id: isolatedOrgId,
        name: "Isolated Workspace",
        slug: `isolated-${randomUUID()}`,
        ownerId: isolated,
        members: { create: { userId: isolated, role: "OWNER" } },
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({
        where: {
          id: { in: [roleOrgId, soloOrgId, coOwnerOrgId, foreignOrgId, isolatedOrgId] },
        },
      });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  function requireDb(t: { skip: (message: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return false;
    }
    return true;
  }

  it("recognises only the four real roles", () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER", "VIEWER"]) {
      assert.equal(isMemberRole(role), true, role);
    }
    for (const bad of ["", "owner", "ADMIN ", "SUPERADMIN", "root", null, 42, {}]) {
      assert.equal(isMemberRole(bad), false, String(bad));
    }
  });

  it("rejects an invitation carrying a forged role and writes no invitation", async (t) => {
    if (!requireDb(t)) return;
    const email = `forged-${randomUUID()}@test.local`;
    await assert.rejects(
      () => inviteMember(roleOrgId, owner, { email, role: "SUPERADMIN" as MemberRole }),
      /Invalid role/
    );
    const row = await client.invitation.findFirst({ where: { organizationId: roleOrgId, email } });
    assert.equal(row, null, "no invitation row is created for an invalid role");
  });

  it("rejects adding a member with a forged role and creates no membership", async (t) => {
    if (!requireDb(t)) return;
    await assert.rejects(
      () => addMember(roleOrgId, outsider, "ROOT" as MemberRole, owner),
      /Invalid role/
    );
    assert.equal(await roleOf(roleOrgId, outsider), null);
  });

  it("rejects a forged role on update and leaves the stored role untouched", async (t) => {
    if (!requireDb(t)) return;
    const memberRowId = await memberIdFor(roleOrgId, member);
    await assert.rejects(
      () => updateMemberRole(roleOrgId, memberRowId, "ADMIN " as MemberRole, owner),
      /Invalid role/
    );
    assert.equal(await roleOf(roleOrgId, member), "MEMBER");
  });

  it("refuses to demote the only owner of an organization", async (t) => {
    if (!requireDb(t)) return;
    const soloRowId = await memberIdFor(soloOrgId, soloOwner);
    await assert.rejects(
      () => updateMemberRole(soloOrgId, soloRowId, "MEMBER", soloOwner),
      /last organization owner/
    );
    assert.equal(await roleOf(soloOrgId, soloOwner), "OWNER");
  });

  it("allows demoting an owner while another owner remains", async (t) => {
    if (!requireDb(t)) return;
    const targetRowId = await memberIdFor(coOwnerOrgId, coOwnerB);
    await updateMemberRole(coOwnerOrgId, targetRowId, "MEMBER", coOwnerA);
    assert.equal(await roleOf(coOwnerOrgId, coOwnerB), "MEMBER");
  });

  it("scopes member mutations to the caller's tenant", async (t) => {
    if (!requireDb(t)) return;
    const foreignRowId = await memberIdFor(foreignOrgId, foreignOwner);

    await assert.rejects(
      () => updateMemberRole(foreignOrgId, foreignRowId, "VIEWER", owner),
      /Only the organization owner can update member roles/
    );
    await assert.rejects(
      () => removeMember(foreignOrgId, foreignRowId, owner),
      /Only the organization owner can remove members/
    );
    assert.equal(await roleOf(foreignOrgId, foreignOwner), "OWNER", "foreign role unchanged");

    assert.equal(await getMembershipForResource(owner, "organization", foreignOrgId), null);
  });

  it("lets a workspace owner reach only its own organization", async (t) => {
    if (!requireDb(t)) return;
    const ownMembership = await getMembership(isolated, isolatedOrgId);
    assert.equal(ownMembership?.role, "OWNER", "the isolated user owns its own workspace");

    assert.equal(await getMembership(isolated, foreignOrgId), null);
    assert.equal(await getMembershipForResource(isolated, "organization", foreignOrgId), null);
    assert.equal(await checkPermission(isolated, "organization", foreignOrgId, "view"), false);
  });
});
