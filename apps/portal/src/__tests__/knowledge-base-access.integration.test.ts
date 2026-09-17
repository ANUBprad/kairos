import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getMembershipForResource, isRoleSufficient } from "@/lib/rbac";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("knowledge base member authorization against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const ownerUserId = randomUUID();
  const adminUserId = randomUUID();
  const memberUserId = randomUUID();
  const viewerUserId = randomUUID();
  const foreignUserId = randomUUID();
  const outsiderUserId = randomUUID();

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("lets KB members access the KB, keeps foreign users and foreign orgs out, and rejects missing KBs", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(ownerUserId, adminUserId, memberUserId, viewerUserId, foreignUserId, outsiderUserId);
      orgIds.push(orgId, foreignOrgId);
      await client.user.createMany({
        data: [
          { id: ownerUserId, email: `kb-owner-${randomUUID()}@test.local`, name: "Owner" },
          { id: adminUserId, email: `kb-admin-${randomUUID()}@test.local`, name: "Admin" },
          { id: memberUserId, email: `kb-member-${randomUUID()}@test.local`, name: "Member" },
          { id: viewerUserId, email: `kb-viewer-${randomUUID()}@test.local`, name: "Viewer" },
          { id: foreignUserId, email: `kb-foreign-${randomUUID()}@test.local`, name: "Foreign" },
          { id: outsiderUserId, email: `kb-out-${randomUUID()}@test.local`, name: "Outsider" },
        ],
      });

      await client.organization.create({
        data: {
          id: orgId,
          name: "KB Owner Org",
          slug: `kb-owner-${randomUUID()}`,
          ownerId: ownerUserId,
          members: {
            create: [
              { userId: ownerUserId, role: "OWNER" },
              { userId: adminUserId, role: "ADMIN" },
              { userId: memberUserId, role: "MEMBER" },
              { userId: viewerUserId, role: "VIEWER" },
            ],
          },
        },
      });
      await client.organization.create({
        data: {
          id: foreignOrgId,
          name: "Foreign Org",
          slug: `kb-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const project = await client.project.create({
        data: { name: "KB Project", slug: `kb-proj-${randomUUID()}`, organizationId: orgId },
        select: { id: true },
      });
      const foreignProject = await client.project.create({
        data: { name: "Foreign Project", slug: `kb-proj-f-${randomUUID()}`, organizationId: foreignOrgId },
        select: { id: true },
      });
      const kb = await client.knowledgeBase.create({
        data: { name: "KB", projectId: project.id, retrievalConfig: {} },
        select: { id: true },
      });
      await client.knowledgeBase.create({
        data: { name: "Foreign KB", projectId: foreignProject.id, retrievalConfig: {} },
        select: { id: true },
      });

      // A + E — every member role (OWNER, ADMIN, MEMBER, VIEWER) has access.
      for (const userId of [ownerUserId, adminUserId, memberUserId, viewerUserId]) {
        assert.equal(await canAccessKnowledgeBase(userId, kb.id), true, `member ${userId}`);
      }

      // B — an authenticated user who is not a member of the owning org cannot access it.
      assert.equal(await canAccessKnowledgeBase(outsiderUserId, kb.id), false);

      // C — a user whose membership is in another organization cannot access it.
      assert.equal(await canAccessKnowledgeBase(foreignUserId, kb.id), false);

      // D — a nonexistent KB id stays rejected even for a real member.
      assert.equal(await canAccessKnowledgeBase(memberUserId, "no-such-kb-id"), false);

      // F — the supplied user identity drives the decision: the same kbId is
      // denied for an outsider and allowed for a member.
      assert.equal(await canAccessKnowledgeBase(outsiderUserId, kb.id), false);
      assert.equal(await canAccessKnowledgeBase(memberUserId, kb.id), true);
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces KB mutation permissions per org role on a real database", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      const rbOrgId = randomUUID();
      const rbOwnerUserId = randomUUID();
      const rbAdminUserId = randomUUID();
      const rbMemberUserId = randomUUID();
      const rbViewerUserId = randomUUID();
      const rbOutsiderUserId = randomUUID();
      const rbForeignUserId = randomUUID();
      const rbForeignOrgId = randomUUID();

      orgIds.push(rbOrgId, rbForeignOrgId);
      userIds.push(rbOwnerUserId, rbAdminUserId, rbMemberUserId, rbViewerUserId, rbForeignUserId, rbOutsiderUserId);
      await client.user.createMany({
        data: [
          { id: rbOwnerUserId, email: `kb-r-owner-${randomUUID()}@test.local`, name: "Owner" },
          { id: rbAdminUserId, email: `kb-r-admin-${randomUUID()}@test.local`, name: "Admin" },
          { id: rbMemberUserId, email: `kb-r-member-${randomUUID()}@test.local`, name: "Member" },
          { id: rbViewerUserId, email: `kb-r-viewer-${randomUUID()}@test.local`, name: "Viewer" },
          { id: rbForeignUserId, email: `kb-r-foreign-${randomUUID()}@test.local`, name: "Foreign" },
          { id: rbOutsiderUserId, email: `kb-r-out-${randomUUID()}@test.local`, name: "Outsider" },
        ],
      });

      await client.organization.create({
        data: {
          id: rbOrgId,
          name: "KB Role Org",
          slug: `kb-role-${randomUUID()}`,
          ownerId: rbOwnerUserId,
          members: {
            create: [
              { userId: rbOwnerUserId, role: "OWNER" },
              { userId: rbAdminUserId, role: "ADMIN" },
              { userId: rbMemberUserId, role: "MEMBER" },
              { userId: rbViewerUserId, role: "VIEWER" },
            ],
          },
        },
      });
      await client.organization.create({
        data: {
          id: rbForeignOrgId,
          name: "Foreign Org",
          slug: `kb-role-f-${randomUUID()}`,
          ownerId: rbForeignUserId,
          members: { create: [{ userId: rbForeignUserId, role: "OWNER" }] },
        },
      });

      const project = await client.project.create({
        data: { name: "KB Role Project", slug: `kb-role-proj-${randomUUID()}`, organizationId: rbOrgId },
        select: { id: true },
      });
      const kb = await client.knowledgeBase.create({
        data: { name: "KB Role", projectId: project.id, retrievalConfig: {} },
        select: { id: true },
      });

      // OWNER/ADMIN may mutate; MEMBER, VIEWER, and outsiders may not.
      const admin = await getMembershipForResource(rbOwnerUserId, "knowledge_base", kb.id);
      assert.ok(admin);
      assert.equal(isRoleSufficient(admin.role, "ADMIN"), true, `${rbOwnerUserId} owner-admin`);
      const mem = await getMembershipForResource(rbMemberUserId, "knowledge_base", kb.id);
      assert.ok(mem);
      for (const userId of [rbAdminUserId, rbMemberUserId, rbViewerUserId, rbOutsiderUserId, rbForeignUserId]) {
        const membership = await getMembershipForResource(userId, "knowledge_base", kb.id);
        const allowed = membership ? isRoleSufficient(membership.role, "ADMIN") : false;
        assert.equal(allowed, userId === rbAdminUserId, `${userId} admin role check`);
      }
    } finally {
      await client.$disconnect();
    }
  });
});