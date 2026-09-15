import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getArtifactDetailForUser, resolveArtifactReturnTarget } from "@/lib/artifacts/detail";
import { createLearningArtifact, deleteLearningArtifact } from "@/lib/artifacts/persistence";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function audioOf(artifact: { metadata: unknown }): Record<string, unknown> {
  return ((artifact.metadata as Record<string, unknown> | null)?.audio as Record<string, unknown>) ?? {};
}

// The artifact detail page resolves artifact + return-target through these two
// helpers. They run against real Postgres to prove the tenancy boundary: the
// detail route must re-authorize every read and must not leak a foreign or
// deleted artifact, and the ?conversation= return link must only ever round
// trip the current user's own conversation in the same KB.
describe("artifact detail deep link against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const aliceId = randomUUID();
  const bobId = randomUUID();
  const strangerId = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();
  const docA1Id = randomUUID();
  const docA2Id = randomUUID();
  const docB1Id = randomUUID();

  let client: PrismaClient;
  let summaryA: string;
  let quizA: string;
  let processingA: string;
  let failedA: string;
  let podcastA: string;
  let summaryB: string;
  let deletedA: string;
  let convA: string;
  let convAOtherUser: string;
  let convB: string;
  let forgedId: string;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `deeplink-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `deeplink-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `deeplink-stranger-${randomUUID()}@test.local`, name: "Stranger" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Deep Org A", slug: `deeplinka-${randomUUID()}`, ownerId: aliceId },
        { id: orgBId, name: "Deep Org B", slug: `deeplinkb-${randomUUID()}`, ownerId: bobId },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Deep Project A", slug: `deepproja-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Deep Project B", slug: `deepprojb-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "Deep KB A", projectId: projAId },
        { id: kbBId, name: "Deep KB B", projectId: projBId },
      ],
    });

    await client.document.createMany({
      data: [
        { id: docA1Id, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docA2Id, name: "beta.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docB1Id, name: "gamma.md", fileType: "md", knowledgeBaseId: kbBId, status: "INDEXED" },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: aliceId, role: "OWNER" },
        { organizationId: orgBId, userId: bobId, role: "OWNER" },
      ],
    });

    const created = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id, docA2Id],
      status: "COMPLETED",
      name: "Deep summary",
      content: { title: "Deep summary", overview: "overview", keyPoints: ["a"] },
      createdById: aliceId,
    });
    summaryA = created.id;

    const quiz = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Deep quiz",
      content: { questions: [] },
      createdById: aliceId,
    });
    quizA = quiz.id;

    const processing = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "PROCESSING",
      name: "Still cooking",
      createdById: aliceId,
    });
    processingA = processing.id;

    const failed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "FAILED",
      name: "Broke quiz",
      createdById: aliceId,
    });
    failedA = failed.id;

    const podcast = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "PODCAST",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Deep episode",
      content: { script: { intro: "hi" } },
      metadata: {
        audio: { storageKey: "s3://kairos-media/secret-key", storageProvider: "s3", durationMs: 42000 },
      },
      createdById: aliceId,
    });
    podcastA = podcast.id;

    const foreign = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "SUMMARY",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      name: "Foreign summary",
      content: { title: "Foreign", overview: "x", keyPoints: [] },
      createdById: bobId,
    });
    summaryB = foreign.id;

    const doomed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Doomed",
      content: { title: "Doomed", overview: "x", keyPoints: [] },
      createdById: aliceId,
    });
    await deleteLearningArtifact(kbAId, doomed.id);
    deletedA = doomed.id;

    convA = randomUUID();
    convAOtherUser = randomUUID();
    convB = randomUUID();
    forgedId = randomUUID();

    await client.conversation.createMany({
      data: [
        { id: convA, knowledgeBaseId: kbAId, userId: aliceId, title: "Own chat in kbA" },
        { id: convAOtherUser, knowledgeBaseId: kbAId, userId: bobId, title: "Bob's chat in kbA" },
        { id: convB, knowledgeBaseId: kbBId, userId: aliceId, title: "Alice's chat in kbB" },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, strangerId] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("resolves the artifact, its in-KB source names, and the KB name for an authorized user", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const detail = await getArtifactDetailForUser(kbAId, summaryA, aliceId);
    assert.ok(detail, "expected the deep-link detail to resolve");
    assert.equal(detail.artifact.name, "Deep summary");
    assert.equal(detail.kbName, "Deep KB A");
    assert.deepEqual(
      detail.sources
        .map((s) => ({ name: s.name, id: s.id }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      [
        { id: docA1Id, name: "alpha.pdf" },
        { id: docA2Id, name: "beta.pdf" },
      ],
    );

    const quizDetail = await getArtifactDetailForUser(kbAId, quizA, aliceId);
    assert.ok(quizDetail);
    assert.equal(quizDetail.artifact.type, "QUIZ");
  });

  it("strips podcast storage references from metadata before handing it to the client", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const detail = await getArtifactDetailForUser(kbAId, podcastA, aliceId);
    assert.ok(detail);
    assert.equal(audioOf(detail.artifact).storageKey, undefined);
    assert.equal(audioOf(detail.artifact).storageProvider, undefined);
    assert.equal(audioOf(detail.artifact).durationMs, 42000);
  });

  it("resolves PROCESSING and FAILED artifacts so deep links show their state", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const processing = await getArtifactDetailForUser(kbAId, processingA, aliceId);
    assert.ok(processing);
    assert.equal(processing.artifact.status, "PROCESSING");

    const failed = await getArtifactDetailForUser(kbAId, failedA, aliceId);
    assert.ok(failed);
    assert.equal(failed.artifact.status, "FAILED");
  });

  it("returns null for an artifact that lives in a different KB (no cross-KB leak)", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await getArtifactDetailForUser(kbAId, summaryB, aliceId), null);
    assert.equal(await getArtifactDetailForUser(kbBId, summaryA, aliceId), null);
  });

  it("returns null for a user with no membership in the artifact's org", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await getArtifactDetailForUser(kbAId, summaryA, strangerId), null);
    assert.equal(await getArtifactDetailForUser(kbBId, summaryB, strangerId), null);
  });

  it("returns null for a deleted artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await getArtifactDetailForUser(kbAId, deletedA, aliceId), null);
  });

  it("returns null for a fabricated artifact id", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await getArtifactDetailForUser(kbAId, forgedId, aliceId), null);
  });

  it("round-trips the user's own conversation in the same KB as the return target", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await resolveArtifactReturnTarget(kbAId, convA, aliceId), convA);
  });

  it("refuses a return target that belongs to another user", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await resolveArtifactReturnTarget(kbAId, convAOtherUser, aliceId), null);
  });

  it("refuses a return target in a different knowledge base", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await resolveArtifactReturnTarget(kbAId, convB, aliceId), null);
  });

  it("refuses missing, malformed, and nonexistent conversation ids", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await resolveArtifactReturnTarget(kbAId, undefined, aliceId), null);
    assert.equal(await resolveArtifactReturnTarget(kbAId, "../../etc/passwd", aliceId), null);
    assert.equal(await resolveArtifactReturnTarget(kbAId, forgedId, aliceId), null);
  });
});