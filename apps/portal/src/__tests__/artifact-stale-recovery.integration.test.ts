import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  createLearningArtifact,
  getLearningArtifact,
  completeLearningArtifact,
  deleteLearningArtifact,
} from "@/lib/artifacts/persistence";
import { recoverStaleProcessingArtifacts } from "@/lib/artifacts/persistence";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function metadataOf(artifact: { metadata: unknown }): Record<string, unknown> {
  return (artifact.metadata as Record<string, unknown> | null) ?? {};
}

describe("stale PROCESSING recovery against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const aliceId = randomUUID();
  const bobId = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `recovery-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `recovery-bob-${randomUUID()}@test.local`, name: "Bob" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Recovery Org A", slug: `recoveryorga-${randomUUID()}`, ownerId: aliceId },
        { id: orgBId, name: "Recovery Org B", slug: `recoveryorgb-${randomUUID()}`, ownerId: bobId },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Recovery Project A", slug: `recoveryproja-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Recovery Project B", slug: `recoveryprojb-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "Recovery KB A", projectId: projAId },
        { id: kbBId, name: "Recovery KB B", projectId: projBId },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
        { organizationId: orgBId, userId: bobId, role: "MEMBER" },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await client.user.deleteMany({ where: { id: { in: [aliceId, bobId] } } });
    } finally {
      await client.$disconnect();
    }
  });

  // Helper: create a PROCESSING artifact and roll its updatedAt backwards
  // so recovery considers it stale.
  async function seedStaleProcessing(kbId: string, userId: string, metadata?: Prisma.InputJsonValue) {
    const artifact = await createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "SUMMARY",
      sourceIds: [],
      status: "PROCESSING",
      metadata,
      createdById: userId,
    });

    // Move updatedAt into the past to satisfy the staleness condition.
    await client.$executeRaw`UPDATE "LearningArtifact" SET "updatedAt" = now() - interval '2 hours' WHERE "id" = ${artifact.id}`;

    return artifact;
  }

  // ---- Fresh PROCESSING is untouched ----

  it("returns 0 for a fresh PROCESSING artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const fresh = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [],
      status: "PROCESSING",
      createdById: aliceId,
    });

    // Use a cutoff well in the past so a freshly created row (updatedAt ≈ now)
    // does not satisfy updatedAt < cutoff.
    const cutoff = new Date(Date.now() - 60_000);
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0);
    const row = await getLearningArtifact(fresh.id);
    assert.equal(row?.status, "PROCESSING", "a fresh PROCESSING row must not be recovered");
  });

  // ---- Stale PROCESSING → FAILED ----

  it("recovers a stale PROCESSING artifact to FAILED", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const stale = await seedStaleProcessing(kbAId, aliceId, { error: "previous" });
    const cutoff = new Date(Date.now() - 60_000); // must be after the stale updatedAt

    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 1);
    const row = await getLearningArtifact(stale.id);
    assert.equal(row?.status, "FAILED");
    assert.deepEqual(metadataOf(row!), { error: "previous" }, "metadata must be preserved");
  });

  // ---- Idempotency ----

  it("repeat recovery returns 0 and does not alter the FAILED row further", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const stale = await seedStaleProcessing(kbAId, aliceId);
    const cutoff = new Date(Date.now() - 60_000);

    const first = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(first, 1);
    const second = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(second, 0, "second recovery on the same row must be a no-op");
    const row = await getLearningArtifact(stale.id);
    assert.equal(row?.status, "FAILED");
  });

  // ---- COMPLETED is never clobbered ----

  it("a COMPLETED artifact with a stale updatedAt is not recovered", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const completed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [],
      status: "COMPLETED",
      content: { title: "kept", keyPoints: [] },
      createdById: aliceId,
    });
    await client.$executeRaw`UPDATE "LearningArtifact" SET "updatedAt" = now() - interval '3 hours' WHERE "id" = ${completed.id}`;

    const cutoff = new Date(Date.now() - 60_000);
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0, "COMPLETED must never be touched");
    const row = await getLearningArtifact(completed.id);
    assert.equal(row?.status, "COMPLETED");
    assert.deepEqual(row?.content, { title: "kept", keyPoints: [] });
  });

  // ---- FAILED is never clobbered ----

  it("a FAILED artifact with a stale updatedAt is not recovered again", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const failed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [],
      status: "FAILED",
      metadata: { error: "initial failure" },
      createdById: aliceId,
    });
    await client.$executeRaw`UPDATE "LearningArtifact" SET "updatedAt" = now() - interval '1 hour' WHERE "id" = ${failed.id}`;

    const cutoff = new Date(Date.now() - 60_000);
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0, "FAILED must not be re-recovered");
    const row = await getLearningArtifact(failed.id);
    assert.equal(row?.status, "FAILED");
    assert.deepEqual(metadataOf(row!), { error: "initial failure" });
  });

  // ---- Tenant safety ----

  it("stale PROCESSING in KB B is not recovered when recovering KB A", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const staleB = await seedStaleProcessing(kbBId, bobId);
    const cutoff = new Date(Date.now() - 60_000);

    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0, "a different KB must not be healed");
    const row = await getLearningArtifact(staleB.id);
    assert.equal(row?.status, "PROCESSING", "a cross-KB row must remain untouched");
  });

  // ---- Deleted row is not resurrected ----

  it("a deleted artifact is not resurrected by recovery", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const stale = await seedStaleProcessing(kbAId, aliceId);
    await deleteLearningArtifact(kbAId, stale.id);

    const cutoff = new Date(Date.now() - 60_000);
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0, "recovery must not resurrect deleted rows");
    const row = await getLearningArtifact(stale.id);
    assert.equal(row, null, "a deleted row must stay deleted");
  });

  // ---- Concurrent completion is never clobbered ----

  it("recovery never overwrites a concurrently COMPLETED artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const stale = await seedStaleProcessing(kbAId, aliceId);
    const cutoff = new Date(Date.now() - 60_000);

    // Complete first; recovery's updateMany requires status=PROCESSING so it matches nothing.
    await completeLearningArtifact(stale.id, { title: "concurrent result", keyPoints: [] });
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 0, "a completed row must not be re-recovered");
    const row = await getLearningArtifact(stale.id);
    assert.equal(row?.status, "COMPLETED");
    assert.deepEqual(row?.content, { title: "concurrent result", keyPoints: [] });
  });

  it("recovery happening before completion never leaves PROCESSING (half of the race)", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const stale = await seedStaleProcessing(kbAId, aliceId);
    const cutoff = new Date(Date.now() - 60_000);

    // Recovery wins first; the subsequent completion call finds status=FAILED and
    // fails its atomic guard (updateMany requires status=PROCESSING).
    const recovered = await recoverStaleProcessingArtifacts(kbAId, cutoff);
    assert.equal(recovered, 1);

    await assert.rejects(
      completeLearningArtifact(stale.id, { title: "late" }),
      (err: unknown) => err instanceof Error && /not in PROCESSING state/i.test(err.message),
      "a failed-recovery artifact must not accept a late completion",
    );

    const row = await getLearningArtifact(stale.id);
    assert.equal(row?.status, "FAILED");
  });
});
