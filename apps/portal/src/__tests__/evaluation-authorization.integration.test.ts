import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertDatasetAccess, assertRunAccess } from "@/lib/evaluation/access";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("dataset and run authorization against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const runIds: string[] = [];
  const datasetIds: string[] = [];
  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const memberUserId = randomUUID();
  const outsiderUserId = randomUUID();
  const foreignUserId = randomUUID();

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.benchmarkRun.deleteMany({ where: { id: { in: runIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces dataset tenancy and run tenancy through the dataset's knowledge base", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(memberUserId, outsiderUserId, foreignUserId);
      orgIds.push(orgId, foreignOrgId);
      await client.user.createMany({
        data: [
          { id: memberUserId, email: `ds-member-${randomUUID()}@test.local`, name: "Member" },
          { id: outsiderUserId, email: `ds-outsider-${randomUUID()}@test.local`, name: "Outsider" },
          { id: foreignUserId, email: `ds-foreign-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });

      await client.organization.create({
        data: {
          id: orgId,
          name: "Dataset Owner Org",
          slug: `ds-owner-${randomUUID()}`,
          ownerId: memberUserId,
          members: { create: [{ userId: memberUserId, role: "OWNER" }] },
        },
      });
      await client.organization.create({
        data: {
          id: foreignOrgId,
          name: "Foreign Org",
          slug: `ds-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const project = await client.project.create({
        data: { name: "Dataset Project", slug: `ds-proj-${randomUUID()}`, organizationId: orgId },
        select: { id: true },
      });
      const foreignProject = await client.project.create({
        data: { name: "Foreign Project", slug: `ds-proj-f-${randomUUID()}`, organizationId: foreignOrgId },
        select: { id: true },
      });
      const kb = await client.knowledgeBase.create({
        data: { name: "DS KB", projectId: project.id, retrievalConfig: {} },
        select: { id: true },
      });
      const foreignKb = await client.knowledgeBase.create({
        data: { name: "Foreign DS KB", projectId: foreignProject.id, retrievalConfig: {} },
        select: { id: true },
      });

      const owned = await client.benchmarkDataset.create({
        data: { name: `owned-${randomUUID()}`, description: "tenant dataset", knowledgeBaseId: kb.id },
        select: { id: true },
      });
      const standalone = await client.benchmarkDataset.create({
        data: { name: `standalone-${randomUUID()}`, description: "no tenant anchor", knowledgeBaseId: null },
        select: { id: true },
      });
      const foreign = await client.benchmarkDataset.create({
        data: { name: `foreign-${randomUUID()}`, description: "other tenant", knowledgeBaseId: foreignKb.id },
        select: { id: true },
      });
      datasetIds.push(owned.id, standalone.id, foreign.id);

      const ownedRun = await client.benchmarkRun.create({
        data: { name: "owned run", status: "completed", configSnapshot: {}, datasetId: owned.id },
        select: { id: true },
      });
      const foreignRun = await client.benchmarkRun.create({
        data: { name: "foreign run", status: "completed", configSnapshot: {}, datasetId: foreign.id },
        select: { id: true },
      });
      runIds.push(ownedRun.id, foreignRun.id);

      // Owner of the tenant org can access its own dataset.
      assert.deepEqual(await assertDatasetAccess(owned.id, memberUserId), {
        id: owned.id,
        knowledgeBaseId: kb.id,
      });

      // Authenticated non-members and members of other orgs are rejected with
      // the same not-found message — no existence oracle.
      for (const userId of [outsiderUserId, foreignUserId]) {
        await assert.rejects(() => assertDatasetAccess(owned.id, userId), {
          message: "Dataset not found",
        });
      }
      await assert.rejects(() => assertDatasetAccess(foreign.id, memberUserId), {
        message: "Dataset not found",
      });
      await assert.rejects(() => assertDatasetAccess(foreign.id, outsiderUserId), {
        message: "Dataset not found",
      });

      // The owner of the foreign tenant's org can access the foreign dataset.
      assert.deepEqual(await assertDatasetAccess(foreign.id, foreignUserId), {
        id: foreign.id,
        knowledgeBaseId: foreignKb.id,
      });

      // A forged dataset id stays rejected even for a member.
      await assert.rejects(() => assertDatasetAccess("no-such-dataset", memberUserId), {
        message: "Dataset not found",
      });

      // Datasets with no knowledge-base anchor keep the legacy global scope.
      assert.deepEqual(await assertDatasetAccess(standalone.id, outsiderUserId), {
        id: standalone.id,
        knowledgeBaseId: null,
      });
      assert.deepEqual(await assertDatasetAccess(standalone.id, memberUserId), {
        id: standalone.id,
        knowledgeBaseId: null,
      });

      // Run access follows the run dataset's tenancy.
      assert.deepEqual(await assertRunAccess(ownedRun.id, memberUserId), {
        id: ownedRun.id,
        datasetId: owned.id,
      });
      await assert.rejects(() => assertRunAccess(ownedRun.id, outsiderUserId), {
        message: "Dataset not found",
      });
      await assert.rejects(() => assertRunAccess(foreignRun.id, memberUserId), {
        message: "Dataset not found",
      });
      await assert.rejects(() => assertRunAccess("no-such-run", memberUserId), {
        message: "Run not found",
      });
    } finally {
      await client.$disconnect();
    }
  });
});