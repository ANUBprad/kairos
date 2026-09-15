import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createLearningArtifact,
  getLearningArtifact,
  getLearningArtifactInKb,
  listLearningArtifacts,
  deleteLearningArtifact,
  collectArtifactMediaKeys,
  type LearningArtifactData,
} from "@/lib/artifacts";
import { regenerateLearningArtifactForUser } from "@/lib/artifacts/engine";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

function metadataOf(artifact: LearningArtifactData): Record<string, unknown> {
  return (artifact.metadata as Record<string, unknown> | null) ?? {};
}

function validInterruption(storageKey: string) {
  return {
    id: randomUUID(),
    question: "What is this about?",
    turns: [
      { speaker: "HOST_A", text: "A first thought." },
      { speaker: "HOST_B", text: "A reply that follows." },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    audio: { provider: "openai", storageProvider: "cloudinary", storageKey, format: "wav", durationSeconds: 2 },
  };
}

function snapshot(artifact: LearningArtifactData) {
  return {
    status: artifact.status,
    name: artifact.name,
    content: artifact.content,
    metadata: artifact.metadata,
    updatedAt: artifact.updatedAt,
  };
}

// Lifecycle runs against a real database. Every regeneration path that creates
// a row stops at the context stage — the seeded sources have no chunks, so
// generation fails with ARTIFACT_CONTEXT_EMPTY before any provider call and a
// dummy key keeps the suite hermetic.
describe("learning artifact lifecycle against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const strangerId = randomUUID();
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();
  const docA1Id = randomUUID();
  const docRemovableId = randomUUID();
  const docB1Id = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `lifecycle-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `lifecycle-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `lifecycle-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `lifecycle-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `lifecycle-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Lifecycle Org A", slug: `lfcycleta-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Lifecycle Org B", slug: `lfcycletb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `lfcla-proj-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `lfclb-proj-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "KB A", projectId: projAId },
        { id: kbBId, name: "KB B", projectId: projBId },
      ],
    });

    // Chunkless INDEXED docs: owned by the KB so they pass the ownership
    // revalidation, but without chunks generation fails at the context stage
    // (hermetic — no provider call).
    await client.document.createMany({
      data: [
        { id: docA1Id, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docRemovableId, name: "removable.md", fileType: "md", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docB1Id, name: "gamma.md", fileType: "md", knowledgeBaseId: kbBId, status: "INDEXED" },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
        { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
        { organizationId: orgBId, userId: bobId, role: "MEMBER" },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, strangerId, orgOwnerA, orgOwnerB] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  // ---- Regeneration (1-9) ----

  it("regeneration creates a fresh artifact, keeps the original intact, and records parent lineage", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Weekly Brief",
      content: { title: "Brief", keyPoints: [] },
      metadata: { promptVersion: "summary-v1" },
      createdById: aliceId,
    });
    const before = snapshot(original);

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const artifacts = await listLearningArtifacts(kbAId);
    const regenerated = artifacts.find((a) => a.id !== original.id)!;

    assert.ok(regenerated, "a regeneration must produce a second artifact row");
    assert.notEqual(regenerated.id, original.id);
    assert.equal(regenerated.knowledgeBaseId, kbAId);
    assert.equal(regenerated.type, "SUMMARY");
    assert.equal(regenerated.name, "Weekly Brief");
    assert.deepEqual(regenerated.sourceIds, [docA1Id]);
    assert.equal(regenerated.status, "FAILED");
    assert.equal(metadataOf(regenerated).parentArtifactId, original.id);
    assert.ok(
      typeof metadataOf(regenerated).error === "string",
      "the failed regeneration must carry its (sanitized) error",
    );

    const row = await client.learningArtifact.findUnique({ where: { id: original.id } });
    assert.ok(row);
    assert.equal(row.status, "COMPLETED", "the original must stay COMPLETED");
    assert.deepEqual(
      {
        status: row.status,
        name: row.name,
        content: row.content,
        metadata: row.metadata,
        updatedAt: row.updatedAt,
      },
      before,
      "the original must be byte-for-byte untouched by regeneration",
    );
  });

  it("regeneration is blocked while the original is PROCESSING", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "PROCESSING",
      createdById: aliceId,
    });
    const otherArtifactsBefore = (await listLearningArtifacts(kbAId)).filter(
      (a) => a.id !== original.id,
    ).length;

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_IN_PROGRESS"),
    );
    assert.equal(
      (await listLearningArtifacts(kbAId)).filter((a) => a.id !== original.id).length,
      otherArtifactsBefore,
      "a blocked regeneration must not leave a second row",
    );
  });

  it("regeneration is blocked while the original is PENDING", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "MINDMAP",
      sourceIds: [docA1Id],
      status: "PENDING",
      createdById: aliceId,
    });
    const otherRowsBefore = await client.learningArtifact.count({
      where: { knowledgeBaseId: kbAId, id: { not: original.id } },
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_IN_PROGRESS"),
    );
    assert.equal(
      await client.learningArtifact.count({
        where: { knowledgeBaseId: kbAId, id: { not: original.id } },
      }),
      otherRowsBefore,
    );
  });

  it("a FAILED artifact can be regenerated (retry) into its own new row", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const failed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "FLASHCARDS",
      sourceIds: [docA1Id],
      status: "FAILED",
      metadata: { error: "previous failure" },
      createdById: aliceId,
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: failed.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const artifacts = (await listLearningArtifacts(kbAId)).filter(
      (a) => a.knowledgeBaseId === kbAId && a.type === "FLASHCARDS",
    );
    const retried = artifacts.find((a) => a.id !== failed.id);
    assert.ok(retried, "retrying a failed artifact must create a new row");
    assert.equal(retried?.status, "FAILED");
    assert.equal(metadataOf(retried).parentArtifactId, failed.id);

    const originalRow = await getLearningArtifact(failed.id);
    assert.equal(originalRow?.status, "FAILED");
    assert.deepEqual(metadataOf(originalRow!), { error: "previous failure" });
    assert.equal(
      artifacts.filter((a) => a.id === failed.id).length,
      1,
      "retrying must never replace or mutate the failed original",
    );
  });

  it("a foreign artifact id inside an accessible KB resolves to NOT_FOUND", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const foreign = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "REPORT",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      content: { sections: [] },
      createdById: bobId,
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: foreign.id }),
      rejectsCode("NOT_FOUND"),
    );
    assert.equal(
      (await getLearningArtifactInKb(foreign.id, kbBId))?.id,
      foreign.id,
      "the foreign artifact must survive the rejected cross-KB regeneration",
    );
  });

  it("a cross-org regeneration (no KB access) resolves to NOT_FOUND, no new row", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const target = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "TAKEAWAYS",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      content: { takeaways: [] },
      createdById: bobId,
    });
    const kbBIdsBefore = (await listLearningArtifacts(kbBId)).map((a) => a.id);

    await assert.rejects(
      regenerateLearningArtifactForUser(strangerId, { knowledgeBaseId: kbBId, artifactId: target.id }),
      rejectsCode("NOT_FOUND"),
    );
    assert.deepEqual(
      (await listLearningArtifacts(kbBId)).map((a) => a.id),
      kbBIdsBefore,
      "a blocked cross-org regeneration must not create a new row",
    );
  });

  it("regeneration revalidates the stored source scope — a since-deleted source aborts before any row exists", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docRemovableId],
      status: "COMPLETED",
      content: { title: "x", keyPoints: [] },
      createdById: aliceId,
    });
    await client.document.delete({ where: { id: docRemovableId } });
    const kbARowsBefore = await client.learningArtifact.count({
      where: { id: { not: original.id }, knowledgeBaseId: kbAId },
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_SOURCE_OUT_OF_SCOPE"),
    );
    assert.equal(
      await client.learningArtifact.count({
        where: { id: { not: original.id }, knowledgeBaseId: kbAId },
      }),
      kbARowsBefore,
      "an out-of-scope source must reject before a replacement row is created",
    );
  });

  it("regeneration of a legacy artifact with an empty stored scope is rejected as ARTIFACT_NO_SOURCES", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [],
      status: "COMPLETED",
      content: { title: "lonely", keyPoints: [] },
      createdById: aliceId,
    });
    const rowsBefore = await client.learningArtifact.count({
      where: { knowledgeBaseId: kbAId, id: { not: original.id } },
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_NO_SOURCES"),
    );
    assert.equal(
      await client.learningArtifact.count({
        where: { knowledgeBaseId: kbAId, id: { not: original.id } },
      }),
      rowsBefore,
    );
  });

  it("a member regenerating an artifact outside their own KB gets a safe NOT_FOUND", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const foreign = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "PODCAST",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "Ep", turns: [], summary: "" },
      createdById: aliceId,
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(bobId, { knowledgeBaseId: kbAId, artifactId: foreign.id }),
      rejectsCode("NOT_FOUND"),
    );
  });

  // ---- Deletion (10-17) ----

  it("deletes an artifact KB-scoped: removed from get and list", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const target = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "doomed", keyPoints: [] },
      createdById: aliceId,
    });

    const deleted = await deleteLearningArtifact(kbAId, target.id);
    assert.equal(deleted?.id, target.id);
    assert.equal(await getLearningArtifact(target.id), null);
    assert.equal(
      (await listLearningArtifacts(kbAId)).some((a) => a.id === target.id),
      false,
    );
  });

  it("deleting from one KB never touches another KB's artifacts", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const inA = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "kept", keyPoints: [] },
      createdById: aliceId,
    });
    const inB = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "REPORT",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      content: { sections: [] },
      createdById: bobId,
    });

    await deleteLearningArtifact(kbAId, inA.id);
    assert.equal(await getLearningArtifact(inA.id), null);
    assert.equal((await getLearningArtifact(inB.id))?.id, inB.id);
  });

  it("a foreign artifact id resolves to null and preserves the foreign row", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const foreign = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "QUIZ",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      content: { questions: [] },
      createdById: bobId,
    });

    assert.equal(await deleteLearningArtifact(kbAId, foreign.id), null);
    assert.equal((await getLearningArtifact(foreign.id))?.id, foreign.id);
  });

  it("a nonexistent artifact id is a safe null, not an error", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await deleteLearningArtifact(kbAId, randomUUID()), null);
  });

  it("deleting the same artifact twice is a safe no-op on the second call", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const target = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "MINDMAP",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { nodes: [] },
      createdById: aliceId,
    });

    assert.ok(await deleteLearningArtifact(kbAId, target.id));
    assert.equal(await deleteLearningArtifact(kbAId, target.id), null);
  });

  it("deleting a podcast returns its full metadata so the caller can clean stored media", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const podcast = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "PODCAST",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "Ep", turns: [], summary: "" },
      metadata: {
        audio: { storageProvider: "cloudinary", storageKey: "artifacts/episode-1.mp3", format: "mp3" },
      },
      createdById: aliceId,
    });

    const deleted = await deleteLearningArtifact(kbAId, podcast.id);
    assert.equal(deleted?.id, podcast.id);
    const audio = metadataOf(deleted!).audio as { storageKey?: string } | undefined;
    assert.equal(audio?.storageKey, "artifacts/episode-1.mp3");
    assert.equal(await getLearningArtifact(podcast.id), null);
  });

  it("collectArtifactMediaKeys gathers episode audio + interruption audio and nothing else", () => {
    const keys = collectArtifactMediaKeys({
      audio: { storageProvider: "cloudinary", storageKey: "ep.mp3", format: "mp3" },
      interruptions: [validInterruption("i1.wav"), validInterruption("i2.wav")],
    });
    assert.deepEqual(keys, ["ep.mp3", "i1.wav", "i2.wav"]);

    assert.deepEqual(collectArtifactMediaKeys(null), []);
    assert.deepEqual(collectArtifactMediaKeys({}), []);
    assert.deepEqual(collectArtifactMediaKeys({ audio: { provider: "openai" } }), []);
  });

  it("one podcast's deletion media keys never reference another artifact's media", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const podA = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "PODCAST",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "A", turns: [], summary: "" },
      metadata: { audio: { storageProvider: "cloudinary", storageKey: "ep-a.mp3", format: "mp3" } },
      createdById: aliceId,
    });
    const podB = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "PODCAST",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "B", turns: [], summary: "" },
      metadata: {
        audio: { storageProvider: "cloudinary", storageKey: "ep-b.mp3", format: "mp3" },
        interruptions: [validInterruption("interrupt-b.wav")],
      },
      createdById: aliceId,
    });

    const deletedA = await deleteLearningArtifact(kbAId, podA.id);
    assert.deepEqual(collectArtifactMediaKeys(deletedA!.metadata), ["ep-a.mp3"]);

    const rowB = (await getLearningArtifact(podB.id))!;
    assert.deepEqual(collectArtifactMediaKeys(rowB.metadata), ["ep-b.mp3", "interrupt-b.wav"]);
  });

  // ---- Status / lifecycle semantics (18-20) ----

  it("a failed regeneration preserves the original COMPLETED artifact byte-for-byte", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "REPORT",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Trusted Report",
      content: { sections: [] },
      metadata: { promptVersion: "report-v1" },
      createdById: aliceId,
    });
    const before = snapshot(original);

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const row = (await getLearningArtifact(original.id))!;
    assert.deepEqual(snapshot(row), before);
  });

  it("a regenerated artifact lands FAILED with sanitized error and parentArtifactId lineage", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "TAKEAWAYS",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { takeaways: [] },
      createdById: aliceId,
    });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const siblings = (await listLearningArtifacts(kbAId)).filter((a) => a.id !== original.id);
    const regenerated = siblings.find((a) => metadataOf(a).parentArtifactId === original.id);
    assert.ok(regenerated);
    assert.equal(regenerated.status, "FAILED");
    assert.equal(metadataOf(regenerated).parentArtifactId, original.id);
    assert.ok(typeof metadataOf(regenerated).error === "string");
  });

  it("regeneration never mutates or replaces the original's own id, status or metadata", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const original = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Original",
      content: { questions: [] },
      metadata: { promptVersion: "quiz-v1", marker: 42 },
      createdById: aliceId,
    });
    const before = { ...snapshot(original), id: original.id };

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: original.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const row = (await getLearningArtifact(original.id))!;
    assert.equal(row.id, before.id);
    assert.deepEqual(snapshot(row), {
      status: before.status,
      name: before.name,
      content: before.content,
      metadata: before.metadata,
      updatedAt: before.updatedAt,
    });
  });
});