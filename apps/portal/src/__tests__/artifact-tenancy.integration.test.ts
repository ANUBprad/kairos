import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import {
  normalizeArtifactSourceIds,
  assertSourcesOwned,
  artifactBelongsToKb,
  createLearningArtifact,
  getLearningArtifactInKb,
  getLearningArtifact,
  listLearningArtifacts,
} from "@/lib/artifacts";
import { generateLearningArtifactForUser } from "@/lib/artifacts/engine";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

// Generation authz runs against a real database. The rejection paths throw
// BEFORE any provider call, so a dummy key keeps the suite hermetic: the
// provider object is constructed but never invoked.
describe("learning artifact tenancy against a real database", () => {
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
  const docA2Id = randomUUID();
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
        { id: aliceId, email: `artifact-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `artifact-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `artifact-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `artifact-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `artifact-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Org A", slug: `artifakta-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Org B", slug: `artifaktb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `arta-proj-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `artb-proj-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "KB A", projectId: projAId },
        { id: kbBId, name: "KB B", projectId: projBId },
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

  it("generation rejects an empty source scope before persisting anything", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    await assert.rejects(
      generateLearningArtifactForUser({
        userId: aliceId,
        knowledgeBaseId: kbAId,
        artifactType: "SUMMARY",
        sourceIds: [],
      }),
      rejectsCode("ARTIFACT_NO_SOURCES"),
    );
    assert.deepEqual(await listLearningArtifacts(kbAId), []);
  });

  it("generation rejects a cross-KB source scope as a whole — no foreign source and no artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    await assert.rejects(
      generateLearningArtifactForUser({
        userId: aliceId,
        knowledgeBaseId: kbAId,
        artifactType: "SUMMARY",
        sourceIds: [docA1Id, docB1Id],
      }),
      rejectsCode("ARTIFACT_SOURCE_OUT_OF_SCOPE"),
    );
    assert.equal(
      await client.learningArtifact.count({ where: { knowledgeBaseId: { in: [kbAId, kbBId] } } }),
      0,
      "a rejected generation must not leave an orphan artifact row",
    );
  });

  it("generation is blocked for a user with no access to the knowledge base's org", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await canAccessKnowledgeBase(strangerId, kbAId), false);
    await assert.rejects(
      generateLearningArtifactForUser({
        userId: strangerId,
        knowledgeBaseId: kbAId,
        artifactType: "SUMMARY",
        sourceIds: [docA1Id],
      }),
      rejectsCode("NOT_FOUND"),
    );
    assert.deepEqual(await listLearningArtifacts(kbAId), []);
  });

  it("persistence resolves an artifact only inside its own knowledge base", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const a = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { ok: true },
      createdById: aliceId,
    });
    const b = await createLearningArtifact({
      knowledgeBaseId: kbBId,
      type: "REPORT",
      sourceIds: [docB1Id],
      status: "COMPLETED",
      content: { ok: true },
      createdById: bobId,
    });

    assert.equal(artifactBelongsToKb(a, kbAId), true);
    assert.equal(artifactBelongsToKb(b, kbAId), false);

    assert.equal((await getLearningArtifactInKb(a.id, kbAId))?.id, a.id);
    assert.equal(await getLearningArtifactInKb(a.id, kbBId), null);
    assert.equal(
      await getLearningArtifactInKb(b.id, kbAId),
      null,
      "a foreign artifact id must resolve to missing inside another KB — never leak its existence",
    );

    assert.deepEqual(
      (await listLearningArtifacts(kbAId)).map((x) => x.id),
      [a.id],
    );
    assert.deepEqual(
      (await listLearningArtifacts(kbBId)).map((x) => x.id),
      [b.id],
    );

    assert.equal((await getLearningArtifact(b.id))?.knowledgeBaseId, kbBId);
  });

  it("source normalization and ownership guards use real owned rows", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.deepEqual(
      normalizeArtifactSourceIds([docA1Id, docA1Id, docB1Id, "  junk  ", 7]),
      [docA1Id, docB1Id],
    );

    const owned = await client.document.findMany({
      where: { id: { in: [docA1Id, docB1Id] }, knowledgeBaseId: kbAId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((d) => d.id));
    assert.deepEqual([...ownedIds].sort(), [docA1Id]);

    assert.throws(
      () => assertSourcesOwned([docB1Id, docA1Id], ownedIds),
      rejectsCode("ARTIFACT_SOURCE_OUT_OF_SCOPE"),
    );
  });
});