import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type MemberRole } from "@prisma/client";
import { resolveUserWorkspace } from "@/lib/server/workspace";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("workspace context against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const multiId = randomUUID();
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();

  let client: PrismaClient;
  let aliceOrgId: string;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `ws-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `ws-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: multiId, email: `ws-multi-${randomUUID()}@test.local`, name: "Multi" },
        { id: orgOwnerA, email: `ws-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `ws-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.create({
      data: { id: orgAId, name: "Org A", slug: `ws-a-${randomUUID()}`, ownerId: orgOwnerA },
    });
    await client.organization.create({
      data: { id: orgBId, name: "Org B", slug: `ws-b-${randomUUID()}`, ownerId: orgOwnerB },
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
        { organizationId: orgAId, userId: multiId, role: "MEMBER" },
        { organizationId: orgBId, userId: multiId, role: "MEMBER" },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, multiId, orgOwnerA, orgOwnerB] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  async function memberRole(orgId: string, userId: string): Promise<MemberRole | null> {
    const member = await client.member.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  async function membershipCount(userId: string): Promise<number> {
    return client.member.count({ where: { userId } });
  }

  it("auto-provisions a personal organization for a user with none", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const resolved = await resolveUserWorkspace(aliceId, { name: "Alice", email: "a@test.local" }, null);
    assert.ok(resolved, "workspace should resolve");
    assert.equal(resolved.organizations.length, 1);
    assert.equal(resolved.selectedOrganization?.id, resolved.organizations[0].id);

    aliceOrgId = resolved.selectedOrganization!.id;
    assert.equal(await memberRole(aliceOrgId, aliceId), "OWNER");

    const project = await client.project.findFirst({ where: { organizationId: aliceOrgId } });
    assert.ok(project, "provisioned workspace should contain a default project");
  });

  it("does not duplicate the personal organization on repeat resolution", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const resolved = await resolveUserWorkspace(aliceId, { name: "Alice", email: "a@test.local" }, null);
    assert.equal(resolved?.organizations.length, 1);
    assert.equal(resolved?.selectedOrganization?.id, aliceOrgId);
    assert.equal(await membershipCount(aliceId), 1);
  });

  it("selects the persisted organization when the user belongs to it", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const resolved = await resolveUserWorkspace(multiId, { name: "Multi" }, orgBId);
    assert.equal(resolved?.selectedOrganization?.id, orgBId);
  });

  it("ignores a foreign or forged selection id", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const resolved = await resolveUserWorkspace(multiId, { name: "Multi" }, "org-does-not-exist");
    assert.ok(resolved?.selectedOrganization);
    const selectedId = resolved?.selectedOrganization?.id;
    assert.ok(selectedId === orgAId || selectedId === orgBId);
  });

  it("never leaks the previous user's organization across sessions", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    // Bob signs in on a browser that still carries Alice's workspace cookie.
    const resolved = await resolveUserWorkspace(bobId, { name: "Bob", email: "b@test.local" }, aliceOrgId);
    assert.ok(resolved?.selectedOrganization);
    assert.notEqual(resolved.selectedOrganization.id, aliceOrgId);
    assert.equal(await memberRole(resolved.selectedOrganization.id, bobId), "OWNER");
    assert.equal(resolved.organizations.length, 1);
  });
});