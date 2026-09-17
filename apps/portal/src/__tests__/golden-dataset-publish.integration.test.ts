import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createDataset, addEntry, publishDataset } from "@/lib/golden-datasets";
import { publishDatasetSnapshot, resolveRunDataset } from "@/lib/evaluation/benchmark";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("golden dataset → benchmark platform publish bridge", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const publishedRootIds: string[] = [];

  function registerPublished(id: string) {
    publishedRootIds.push(id);
  }

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.benchmarkDataset.deleteMany({
        where: { OR: [{ id: { in: publishedRootIds } }, { parentVersionId: { in: publishedRootIds } }] },
      });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("publishes an org-scoped golden dataset as an immutable benchmark snapshot", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    const orgId = randomUUID();
    const ownerUserId = randomUUID();

    try {
      await client.$connect();
      userIds.push(ownerUserId);
      orgIds.push(orgId);
      await client.user.create({
        data: { id: ownerUserId, email: `gd-owner-${randomUUID()}@test.local`, name: "Owner" },
      });
      await client.organization.create({
        data: {
          id: orgId,
          name: "Golden Org",
          slug: `golden-${randomUUID()}`,
          ownerId: ownerUserId,
          members: { create: [{ userId: ownerUserId, role: "OWNER" }] },
        },
      });

      const dataset = await createDataset(orgId, ownerUserId, {
        name: "Support QA",
        description: "Coverage of billing and support flows",
        tags: ["support", "billing"],
        difficulty: "MEDIUM",
      });
      await addEntry(dataset.id, {
        question: "How do I request a refund?",
        expectedAnswer: "Open Settings → Billing → Refund",
        context: "Refunds are processed from the billing settings page.",
        category: "billing",
        tags: ["refund"],
        expectedCitations: ["DOC-1"],
        metadata: { domain: "support" },
      }, orgId);
      await addEntry(dataset.id, {
        question: "Where do I reset my password?",
        expectedAnswer: "Use the account recovery link on the login page.",
        category: "auth",
      }, orgId);

      const published = await publishDataset(dataset.id, orgId);
      registerPublished(published.benchmarkDatasetId);
      assert.equal(published.name, "Support QA");
      assert.equal(published.version, 1);
      assert.equal(published.questionCount, 2);

      const snapshot = await client.benchmarkDataset.findUnique({
        where: { id: published.benchmarkDatasetId },
        include: { questions: { orderBy: { question: "asc" } } },
      });
      assert.ok(snapshot);
      assert.equal(snapshot.source, `golden:${dataset.id}`);
      assert.deepEqual(snapshot.tags, ["support", "billing"]);
      assert.equal(snapshot.questions.length, 2);

      const withContext = snapshot.questions.find((q) => q.expectedContext === "Refunds are processed from the billing settings page.");
      assert.ok(withContext);
      assert.equal(withContext.question, "How do I request a refund?");
      assert.equal(withContext.expectedAnswer, "Open Settings → Billing → Refund");
      const meta = withContext.metadata as Record<string, unknown>;
      assert.equal(meta.category, "billing");
      assert.deepEqual(meta.tags, ["refund"]);
      assert.deepEqual(meta.expectedCitations, ["DOC-1"]);
      assert.equal(meta.domain, "support");
    } finally {
      await client.$disconnect();
    }
  });

  it("dedupes unchanged content, versions changed content under the same root, and pins runs to published content", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    const orgId = randomUUID();
    const ownerUserId = randomUUID();

    try {
      await client.$connect();
      userIds.push(ownerUserId);
      orgIds.push(orgId);
      await client.user.create({
        data: { id: ownerUserId, email: `gd-ver-${randomUUID()}@test.local`, name: "Owner" },
      });
      await client.organization.create({
        data: {
          id: orgId,
          name: "Golden Version Org",
          slug: `golden-ver-${randomUUID()}`,
          ownerId: ownerUserId,
          members: { create: [{ userId: ownerUserId, role: "OWNER" }] },
        },
      });

      const dataset = await createDataset(orgId, ownerUserId, { name: "Versioned QA" });
      await addEntry(dataset.id, { question: "Q1?", expectedAnswer: "A1" }, orgId);

      const v1 = await publishDataset(dataset.id, orgId);
      registerPublished(v1.benchmarkDatasetId);

      const again = await publishDataset(dataset.id, orgId);
      assert.equal(again.benchmarkDatasetId, v1.benchmarkDatasetId, "unchanged content re-publishes to the same snapshot");
      assert.equal(again.version, 1);
      assert.equal(again.questionCount, 1);

      await addEntry(dataset.id, { question: "Q2?", expectedAnswer: "A2" }, orgId);
      const v2 = await publishDataset(dataset.id, orgId);
      registerPublished(v2.benchmarkDatasetId);
      const v2Row = await client.benchmarkDataset.findUnique({ where: { id: v2.benchmarkDatasetId } });
      assert.ok(v2Row);
      assert.equal(v2Row.parentVersionId, v1.benchmarkDatasetId, "changed content lands as a child of the same root");
      assert.equal(v2.version, 2);
      assert.equal(v2.questionCount, 2);

      const family = await client.benchmarkDataset.findMany({
        where: { OR: [{ id: v1.benchmarkDatasetId }, { parentVersionId: v1.benchmarkDatasetId }] },
        orderBy: { version: "asc" },
      });
      assert.deepEqual(family.map((f) => f.version), [1, 2]);
      const child = family.find((f) => f.version === 2);
      assert.ok(child);
      assert.equal(child.parentVersionId, v1.benchmarkDatasetId);
      assert.notEqual(child.contentHash, family[0].contentHash);

      const pinned = await resolveRunDataset(v1.benchmarkDatasetId, { createIfMissing: false });
      assert.equal(pinned.id, child!.id, "regression runs resolve to the immutable snapshot for published content");
      assert.equal(pinned.questions.length, 2);
    } finally {
      await client.$disconnect();
    }
  });

  it("rejects cross-tenant, empty, and invalid publishes", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    const orgId = randomUUID();
    const foreignOrgId = randomUUID();
    const ownerUserId = randomUUID();
    const foreignUserId = randomUUID();

    try {
      await client.$connect();
      userIds.push(ownerUserId, foreignUserId);
      orgIds.push(orgId, foreignOrgId);
      await client.user.createMany({
        data: [
          { id: ownerUserId, email: `gd-sec-${randomUUID()}@test.local`, name: "Owner" },
          { id: foreignUserId, email: `gd-sec-f-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });
      await client.organization.create({
        data: {
          id: orgId,
          name: "Golden Secure Org",
          slug: `golden-sec-${randomUUID()}`,
          ownerId: ownerUserId,
          members: { create: [{ userId: ownerUserId, role: "OWNER" }] },
        },
      });
      await client.organization.create({
        data: {
          id: foreignOrgId,
          name: "Foreign Secure Org",
          slug: `golden-sec-f-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const dataset = await createDataset(orgId, ownerUserId, { name: "Secure QA" });
      await addEntry(dataset.id, { question: "Q?", expectedAnswer: "A" }, orgId);

      // A user from another org cannot publish this org's golden dataset.
      await assert.rejects(publishDataset(dataset.id, foreignOrgId), /Dataset not found/);

      // Empty dataset is refused.
      const emptyDataset = await createDataset(orgId, ownerUserId, { name: "Empty QA" });
      await assert.rejects(publishDataset(emptyDataset.id, orgId), /Cannot publish an empty dataset/);

      // Entry-level validation still guards the pipeline.
      const brokenDataset = await createDataset(orgId, ownerUserId, { name: "Broken QA" });
      await addEntry(brokenDataset.id, { question: "Q?", expectedAnswer: "A" }, orgId);
      await addEntry(brokenDataset.id, { question: "", expectedAnswer: "A" }, orgId);
      await assert.rejects(publishDataset(brokenDataset.id, orgId), /Cannot publish a dataset with invalid entries/);
    } finally {
      await client.$disconnect();
    }
  });

  // The primitive export dedupes at the snapshot layer so a caller could not
  // accidentally stack duplicate roots for the same source.
  it("publishDatasetSnapshot deduplicates roots by source", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      const source = `golden:${randomUUID()}`;
      const a = await publishDatasetSnapshot({
        name: "Snapshot QA",
        source,
        questions: [{ question: "Q?", expectedAnswer: "A" }],
      });
      registerPublished(a.id);
      const b = await publishDatasetSnapshot({
        name: "Snapshot QA",
        source,
        questions: [{ question: "Q?", expectedAnswer: "A" }],
      });
      assert.equal(b.id, a.id);
      assert.equal(b.version, 1);
    } finally {
      await client.$disconnect();
    }
  });
});