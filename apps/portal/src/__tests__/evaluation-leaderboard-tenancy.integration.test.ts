import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { filterAccessibleRunIds } from "@/lib/actions/evaluation";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("leaderboard run tenancy against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const runIds: string[] = [];
  const datasetIds: string[] = [];
  const memberUserId = randomUUID();
  const outsiderUserId = randomUUID();
  const foreignUserId = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();

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

  it("getLeaderboard/getScientificLeaderboard tenancy gate keeps leaderboard data inside the caller's tenant", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(memberUserId, outsiderUserId, foreignUserId);
      orgIds.push(orgAId, orgBId);
      await client.user.createMany({
        data: [
          { id: memberUserId, email: `lb-member-${randomUUID()}@test.local`, name: "Member" },
          { id: outsiderUserId, email: `lb-outsider-${randomUUID()}@test.local`, name: "Outsider" },
          { id: foreignUserId, email: `lb-foreign-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });

      await client.organization.create({
        data: {
          id: orgAId,
          name: "Leaderboard Owner Org",
          slug: `lb-owner-${randomUUID()}`,
          ownerId: memberUserId,
          members: { create: [{ userId: memberUserId, role: "OWNER" }] },
        },
      });
      await client.organization.create({
        data: {
          id: orgBId,
          name: "Leaderboard Foreign Org",
          slug: `lb-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const projA = await client.project.create({
        data: { name: "LB Project A", slug: `lb-proj-a-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const projA2 = await client.project.create({
        data: { name: "LB Project A2", slug: `lb-proj-a2-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const projB = await client.project.create({
        data: { name: "LB Project B", slug: `lb-proj-b-${randomUUID()}`, organizationId: orgBId },
        select: { id: true },
      });
      const kbA = await client.knowledgeBase.create({
        data: { name: "LB KB A", projectId: projA.id, retrievalConfig: {} },
        select: { id: true },
      });
      const kbA2 = await client.knowledgeBase.create({
        data: { name: "LB KB A2", projectId: projA2.id, retrievalConfig: {} },
        select: { id: true },
      });
      const kbB = await client.knowledgeBase.create({
        data: { name: "LB KB B", projectId: projB.id, retrievalConfig: {} },
        select: { id: true },
      });

      const owned = await client.benchmarkDataset.create({
        data: { name: `lb-owned-${randomUUID()}`, description: "same tenant", knowledgeBaseId: kbA.id },
        select: { id: true },
      });
      const sameOrgOtherKb = await client.benchmarkDataset.create({
        data: { name: `lb-sameorg-${randomUUID()}`, description: "same org, other KB", knowledgeBaseId: kbA2.id },
        select: { id: true },
      });
      const standalone = await client.benchmarkDataset.create({
        data: { name: `lb-standalone-${randomUUID()}`, description: "no tenant anchor", knowledgeBaseId: null },
        select: { id: true },
      });
      const foreign = await client.benchmarkDataset.create({
        data: { name: `lb-foreign-${randomUUID()}`, description: "foreign tenant", knowledgeBaseId: kbB.id },
        select: { id: true },
      });
      datasetIds.push(owned.id, sameOrgOtherKb.id, standalone.id, foreign.id);

      const ownedRun = await client.benchmarkRun.create({
        data: { name: "owned run", status: "completed", configSnapshot: {}, datasetId: owned.id },
        select: { id: true },
      });
      const sameOrgRun = await client.benchmarkRun.create({
        data: { name: "same org run", status: "completed", configSnapshot: {}, datasetId: sameOrgOtherKb.id },
        select: { id: true },
      });
      const standaloneRun = await client.benchmarkRun.create({
        data: { name: "standalone run", status: "completed", configSnapshot: {}, datasetId: standalone.id },
        select: { id: true },
      });
      const foreignOrgRun = await client.benchmarkRun.create({
        data: { name: "foreign org run", status: "completed", configSnapshot: {}, datasetId: foreign.id },
        select: { id: true },
      });
      const deletedRun = await client.benchmarkRun.create({
        data: { name: "deleted run", status: "completed", configSnapshot: {}, datasetId: owned.id },
        select: { id: true },
      });
      await client.benchmarkRun.delete({ where: { id: deletedRun.id } });
      runIds.push(ownedRun.id, sameOrgRun.id, standaloneRun.id, foreignOrgRun.id);

      const fabricatedId = randomUUID();

      // Same-tenant member keeps its own runs (including another KB/project in
      // the same org) plus the unanchored global run; foreign, fabricated, and
      // deleted runs are all omitted identically — no existence oracle.
      const memberAllowed = new Set(
        await filterAccessibleRunIds(
          [ownedRun.id, sameOrgRun.id, foreignOrgRun.id, standaloneRun.id, deletedRun.id, fabricatedId],
          memberUserId,
        ),
      );
      assert.deepEqual(
        memberAllowed,
        new Set([ownedRun.id, sameOrgRun.id, standaloneRun.id]),
        "member must see same-tenant runs only",
      );

      // A single foreign or fabricated or deleted id yields nothing.
      assert.deepEqual(
        new Set(await filterAccessibleRunIds([foreignOrgRun.id], memberUserId)),
        new Set(),
        "foreign run must not resolve for the member",
      );
      assert.deepEqual(
        new Set(await filterAccessibleRunIds([deletedRun.id], memberUserId)),
        new Set(),
        "deleted run must not resolve",
      );
      assert.deepEqual(
        new Set(await filterAccessibleRunIds([fabricatedId], memberUserId)),
        new Set(),
        "fabricated run must not resolve",
      );

      // An authenticated caller without org membership keeps only the global run.
      assert.deepEqual(
        new Set(await filterAccessibleRunIds([ownedRun.id, standaloneRun.id, foreignOrgRun.id], outsiderUserId)),
        new Set([standaloneRun.id]),
        "outsider must see the unanchored global run only",
      );

      // The foreign tenant's owner sees its own run plus the global run, never the member's.
      assert.deepEqual(
        new Set(await filterAccessibleRunIds([ownedRun.id, foreignOrgRun.id, standaloneRun.id], foreignUserId)),
        new Set([foreignOrgRun.id, standaloneRun.id]),
        "foreign owner must see its own run and the global run only",
      );

      // Empty input is a no-op.
      assert.deepEqual(await filterAccessibleRunIds([], memberUserId), []);
    } finally {
      await client.$disconnect();
    }
  });
});