import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createBenchmarkDatasetVersion,
  datasetContentHash,
  deleteBenchmarkDataset,
  getBenchmarkDataset,
  getBenchmarkRuns,
  listBenchmarkDatasetVersions,
  resolveRunDataset,
} from "@/lib/evaluation/benchmark";
import { assertDatasetAccess } from "@/lib/evaluation/access";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("immutable dataset versioning against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const projectIds: string[] = [];
  const knowledgeBaseIds: string[] = [];
  const datasetIds: string[] = [];

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      // Helper-created snapshot rows are never tracked by name, so clear the
      // whole family (roots + children) before touching orgs/KBs.
      const family = await client.benchmarkDataset.findMany({
        where: { OR: [{ id: { in: datasetIds } }, { parentVersionId: { in: datasetIds } }] },
        select: { id: true },
      });
      const familyIds = family.map((f) => f.id);
      await client.benchmarkRun.deleteMany({ where: { datasetId: { in: familyIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: familyIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: knowledgeBaseIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function seedTenant(client: PrismaClient, tag: string): Promise<{ userId: string; kbId: string }> {
    if (!testDbUrl) throw new Error("no test db");
    const userId = randomUUID();
    const orgId = randomUUID();
    userIds.push(userId);
    orgIds.push(orgId);
    const user = await client.user.create({
      data: { id: userId, email: `dsv-${tag}-${randomUUID()}@test.local`, name: "Member" },
      select: { id: true },
    });
    const org = await client.organization.create({
      data: {
        id: orgId,
        name: `DSV ${tag} Org`,
        slug: `dsv-${tag}-${randomUUID()}`,
        ownerId: user.id,
        members: { create: [{ userId: user.id, role: "OWNER" }] },
      },
      select: { id: true },
    });
    const project = await client.project.create({
      data: { name: `DSV ${tag} Project`, slug: `dsv-${tag}-proj-${randomUUID()}`, organizationId: org.id },
      select: { id: true },
    });
    projectIds.push(project.id);
    const kb = await client.knowledgeBase.create({
      data: { name: `DSV ${tag} KB`, projectId: project.id, retrievalConfig: {} },
      select: { id: true },
    });
    knowledgeBaseIds.push(kb.id);
    return { userId: user.id, kbId: kb.id };
  }

  async function seedRoot(client: PrismaClient, tag: string, kbId?: string) {
    const root = await client.benchmarkDataset.create({
      data: {
        name: `dsv-${tag}-${randomUUID()}`,
        knowledgeBaseId: kbId,
        questions: {
          create: [
            { question: "q1", expectedAnswer: "a1", expectedContext: "c1", referenceDocId: "doc1", metadata: { b: 2, a: 1 } },
            { question: "q2" },
          ],
        },
      },
      include: { questions: true },
    });
    datasetIds.push(root.id);
    return root;
  }

  it("snapshots content into a version row, deduplicates by hash, and lists the family", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { kbId } = await seedTenant(client, "snap");
      const root = await seedRoot(client, "snap", kbId);

      const v2 = await createBenchmarkDatasetVersion(root.id);

      assert.notEqual(v2.id, root.id);
      assert.equal(v2.parentVersionId, root.id);
      assert.equal(v2.version, 2);
      assert.equal(v2.name, `${root.name} v2`);
      assert.equal(v2.knowledgeBaseId, kbId);
      assert.equal(v2.questions.length, 2);
      assert.equal(v2.contentHash, datasetContentHash(root.questions));
      const copied = v2.questions.find((q) => q.question === "q1");
      assert.ok(copied);
      assert.equal(copied.expectedAnswer, "a1");
      assert.equal(copied.expectedContext, "c1");
      assert.equal(copied.referenceDocId, "doc1");
      assert.deepEqual(copied.metadata, { b: 2, a: 1 });
      assert.notEqual(v2.questions[0].id, root.questions[0].id);

      const again = await createBenchmarkDatasetVersion(root.id);
      assert.equal(again.id, v2.id, "unchanged content must deduplicate to the same snapshot");

      const listed = await listBenchmarkDatasetVersions(root.id);
      assert.equal(listed.rootId, root.id);
      assert.equal(listed.versions.length, 1);
      assert.equal(listed.versions[0].id, v2.id);
      assert.equal(listed.versions[0]._count.questions, 2);
    } finally {
      await client.$disconnect();
    }
  });

  it("keeps the snapshot frozen against root edits and resolves runs to it", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { kbId } = await seedTenant(client, "frozen");
      const root = await seedRoot(client, "frozen", kbId);
      const v2 = await createBenchmarkDatasetVersion(root.id);

      await client.benchmarkQuestion.create({ data: { question: "added", datasetId: root.id } });

      const stale = await client.benchmarkDataset.findUnique({ where: { id: v2.id }, include: { questions: true } });
      assert.equal(stale?.questions.length, 2, "root edits must not leak into the published snapshot");

      const target = await resolveRunDataset(root.id, { createIfMissing: false });
      assert.equal(target.id, v2.id, "a root with edits resolves to the latest published snapshot");

      const drifted = await resolveRunDataset(root.id, { createIfMissing: true });
      assert.notEqual(drifted.id, v2.id);
      assert.equal(drifted.questions.length, 3, "a persist-bound run on edited content creates a fresh snapshot");
      const v3 = await client.benchmarkDataset.findUnique({ where: { id: drifted.id } });
      assert.equal(v3?.version, 3);
      assert.equal(v3?.parentVersionId, root.id);
    } finally {
      await client.$disconnect();
    }
  });

  it("pins persisted runs to the resolved version and surfaces them under the root's run lists", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { kbId } = await seedTenant(client, "pin");
      const root = await seedRoot(client, "pin", kbId);
      const v2 = await createBenchmarkDatasetVersion(root.id);

      const runOnVersion = await client.benchmarkRun.create({
        data: { name: "v2 run", datasetId: v2.id, status: "completed", aggregatedMetrics: { avgRecallAtK: 0.5 }, configSnapshot: {} },
      });
      const runOnRoot = await client.benchmarkRun.create({
        data: { name: "root run", datasetId: root.id, status: "completed", aggregatedMetrics: {}, configSnapshot: {} },
      });

      const runs = await getBenchmarkRuns(root.id);
      assert.deepEqual(runs.map((r) => r.id).sort(), [runOnRoot.id, runOnVersion.id].sort());

      const detail = await getBenchmarkDataset(root.id);
      assert.ok(detail);
      assert.deepEqual(detail.runs.map((r) => r.id).sort(), [runOnRoot.id, runOnVersion.id].sort());
    } finally {
      await client.$disconnect();
    }
  });

  it("refuses deleting a published version and cascades the chain on root delete", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { kbId } = await seedTenant(client, "delete");
      const root = await seedRoot(client, "delete", kbId);
      const v2 = await createBenchmarkDatasetVersion(root.id);

      await assert.rejects(
        () => deleteBenchmarkDataset(v2.id),
        /immutable/,
        "a published snapshot must refuse deletion",
      );

      await deleteBenchmarkDataset(root.id);

      const survivor = await client.benchmarkDataset.findMany({ where: { id: { in: [root.id, v2.id] } } });
      assert.equal(survivor.length, 0, "root deletion must remove the whole version chain");
    } finally {
      await client.$disconnect();
    }
  });

  it("makes version rows inherit the root dataset's tenant anchor", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { userId: ownerId, kbId } = await seedTenant(client, "tenant");
      const root = await seedRoot(client, "tenant", kbId);
      const v2 = await createBenchmarkDatasetVersion(root.id);

      const foreignUserId = randomUUID();
      userIds.push(foreignUserId);
      const foreignOrgId = randomUUID();
      orgIds.push(foreignOrgId);
      await client.user.create({
        data: { id: foreignUserId, email: `dsv-foreign-${randomUUID()}@test.local`, name: "Foreign" },
      });
      await client.organization.create({
        data: {
          id: foreignOrgId,
          name: "DSV Foreign Org",
          slug: `dsv-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "MEMBER" }] },
        },
      });

      await assert.doesNotReject(() => assertDatasetAccess(v2.id, ownerId));
      await assert.rejects(() => assertDatasetAccess(root.id, foreignUserId), /Dataset not found/);
      await assert.rejects(() => assertDatasetAccess(v2.id, foreignUserId), /Dataset not found/);
    } finally {
      await client.$disconnect();
    }
  });
});