import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createLearningArtifact,
  deleteLearningArtifact,
  listLearningArtifacts,
} from "@/lib/artifacts";
import { regenerateLearningArtifactForUser } from "@/lib/artifacts/engine";
import { getFlashcardReviewsForUser, markFlashcardReviewForUser } from "@/lib/study";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

function validDeck() {
  return {
    title: "Trigonometry",
    cards: [
      { front: "sin(0)?", back: "0" },
      { front: "cos(0)?", back: "1" },
      { front: "tan(0)?", back: "0" },
    ],
  };
}

describe("persistent flashcard review against a real database", () => {
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
        { id: aliceId, email: `flash-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `flash-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `flash-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `flash-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `flash-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Flash Org A", slug: `florga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Flash Org B", slug: `florgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `flproja-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `flprojb-${randomUUID()}`, organizationId: orgBId },
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
      await client.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, strangerId, orgOwnerA, orgOwnerB] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  async function makeDeck(kbId: string, content: unknown = validDeck()) {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "FLASHCARDS",
      sourceIds: [kbId === kbAId ? docA1Id : docB1Id],
      status: "COMPLETED",
      name: "Trig deck",
      content: content as never,
      createdById: kbId === kbAId ? aliceId : bobId,
    });
  }

  it("returns full-coverage default progress for an untouched deck", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);

    const reviews = await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id });
    assert.deepEqual(reviews, [
      { cardId: 0, status: "NEW", knownCount: 0, againCount: 0, reviewCount: 0, lastReviewedAt: null },
      { cardId: 1, status: "NEW", knownCount: 0, againCount: 0, reviewCount: 0, lastReviewedAt: null },
      { cardId: 2, status: "NEW", knownCount: 0, againCount: 0, reviewCount: 0, lastReviewedAt: null },
    ]);
  });

  it("records verdicts with counts and a NEW -> LEARNING -> KNOWN progression", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);

    const first = await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    assert.equal(first.status, "LEARNING");
    assert.equal(first.knownCount, 1);
    assert.equal(first.againCount, 0);
    assert.equal(first.reviewCount, 1);
    assert.ok(first.lastReviewedAt);

    const second = await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    assert.equal(second.status, "KNOWN");
    assert.equal(second.knownCount, 2);
    assert.equal(second.reviewCount, 2);

    const third = await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "AGAIN" });
    assert.equal(third.status, "LEARNING", "a KNOWN card answered Again drops back to LEARNING");
    assert.equal(third.knownCount, 2);
    assert.equal(third.againCount, 1);
    assert.equal(third.reviewCount, 3);

    const row = await client.flashcardReview.findUnique({
      where: { userId_artifactId_cardId: { userId: aliceId, artifactId: deck.id, cardId: 0 } },
    });
    assert.equal(row?.status, "LEARNING");
    assert.equal(row?.againCount, 1);
  });

  it("persists and reloads per-card status", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 2, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 2, verdict: "KNOWN" });

    const reviews = await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id });
    assert.equal(reviews[2].status, "KNOWN");
    assert.equal(reviews[2].knownCount, 2);
    assert.equal(reviews[0].status, "NEW", "untouched cards stay NEW after reload");
  });

  it("review state is per-user: another member's verdicts never cross over", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deckA = await makeDeck(kbAId);
    const deckB = await makeDeck(kbBId);

    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deckA.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(bobId, { knowledgeBaseId: kbBId, artifactId: deckB.id, cardId: 0, verdict: "KNOWN" });

    const aliceReviews = await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deckA.id });
    assert.equal(aliceReviews[0].status, "LEARNING");
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deckA.id, userId: bobId } }),
      0,
      "bob never touched alice's deck",
    );
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deckB.id, userId: aliceId } }),
      0,
      "alice never touched bob's deck",
    );
  });

  it("cross-org and cross-KB accesses resolve to NOT_FOUND", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deckB = await makeDeck(kbBId);

    await assert.rejects(
      getFlashcardReviewsForUser(strangerId, { knowledgeBaseId: kbBId, artifactId: deckB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbBId, artifactId: deckB.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(bobId, { knowledgeBaseId: kbAId, artifactId: deckB.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("NOT_FOUND"),
    );
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deckB.id } }),
      0,
      "rejected cross-KB marks must not persist a review row",
    );
  });

  it("rejects out-of-range card ids and unknown verdicts", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);

    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 99, verdict: "KNOWN" }),
      rejectsCode("FLASHCARD_INVALID_CARD"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "SORT_OF" }),
      rejectsCode("INVALID_FLASHCARD_VERDICT"),
    );
    assert.equal(await client.flashcardReview.count({ where: { artifactId: deck.id } }), 0);
  });

  it("deleting an artifact cascades its review rows away", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    assert.equal((await deleteLearningArtifact(kbAId, deck.id))?.id, deck.id);
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deck.id } }),
      0,
      "review rows are cleaned up with their artifact",
    );
  });

  it("regeneration starts a fresh deck with no inherited review state", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const regenerated = (await listLearningArtifacts(kbAId)).find(
      (a) => a.id !== deck.id && a.type === "FLASHCARDS",
    );
    assert.ok(regenerated);
    assert.equal(regenerated.status, "FAILED");

    await assert.rejects(
      getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: regenerated!.id }),
      rejectsCode("ARTIFACT_NOT_COMPLETED"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: regenerated!.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("ARTIFACT_NOT_COMPLETED"),
    );
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: regenerated!.id } }),
      0,
      "a regenerated deck inherits none of the original's review state",
    );

    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deck.id, userId: aliceId } }),
      1,
      "the original deck keeps its review state",
    );
    assert.equal(
      (await client.flashcardReview.findUnique({
        where: { userId_artifactId_cardId: { userId: aliceId, artifactId: deck.id, cardId: 0 } },
      }))?.status,
      "LEARNING",
    );
  });
});