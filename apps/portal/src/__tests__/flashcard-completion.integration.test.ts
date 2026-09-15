import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createLearningArtifact } from "@/lib/artifacts";
import { regenerateLearningArtifactForUser } from "@/lib/artifacts/engine";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";
import {
  getFlashcardReviewsForUser,
  markFlashcardReviewForUser,
  summarizeFlashcardDeckProgress,
} from "@/lib/study";
import { getStudyProgressForUser } from "@/lib/study";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

function validDeck() {
  return {
    title: "Geometry deck",
    cards: [
      { front: "angles in a triangle?", back: "180 degrees" },
      { front: "area of a circle?", back: "pi r squared" },
      { front: "hypotenuse?", back: "longest side" },
    ],
  };
}

// Deck completion + provenance correctness against a real database: completion
// is always derived from the per-card review rows (a card is "reviewed" once it
// has reviewCount > 0), the projection sums total verdict marks separately from
// distinct reviewed cards, and provenance maps the immutable sourceIds snapshot
// without ever inventing names or leaking across KB/org boundaries.
describe("flashcard completion and source provenance against a real database", () => {
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
        { id: aliceId, email: `completion-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `completion-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `completion-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `completion-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `completion-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Completion Org A", slug: `complorga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Completion Org B", slug: `complorgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `complpa-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `complpb-${randomUUID()}`, organizationId: orgBId },
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

    // Alice and Bob share KB A (per-user isolation on the same KB); only the
    // stranger reaches KB B (cross-org boundary for provenance/authz).
    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
        { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
        { organizationId: orgAId, userId: bobId, role: "MEMBER" },
        { organizationId: orgBId, userId: strangerId, role: "MEMBER" },
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
      name: "Geometry deck",
      content: content as never,
      createdById: kbId === kbAId ? aliceId : strangerId,
    });
  }

  it("an untouched deck shows 0 reviewed cards and is never complete", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);

    const reviews = await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id });
    const summary = summarizeFlashcardDeckProgress(reviews);
    assert.equal(summary.cardCount, 3);
    assert.equal(summary.reviewedCount, 0);
    assert.equal(summary.totalReviews, 0);
    assert.equal(summary.complete, false, "0 of 3 reviewed is not complete");
    assert.ok(reviews.every((r) => r.reviewCount === 0 && r.status === "NEW"));
  });

  it("reviewing a single card reports 1/N reviewed and stays incomplete", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    const summary = summarizeFlashcardDeckProgress(
      await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
    );
    assert.equal(summary.reviewedCount, 1);
    assert.equal(summary.complete, false);
  });

  it("progress tracks multiple distinct cards and stays incomplete while any card is unreviewed", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "AGAIN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });

    const summary = summarizeFlashcardDeckProgress(
      await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
    );
    assert.equal(summary.reviewedCount, 2, "two distinct cards reviewed");
    assert.equal(summary.totalReviews, 2);
    assert.equal(summary.complete, false, "card 2 (index 2) is still unreviewed");
  });

  it("re-reviewing the same card never inflates the distinct reviewed count", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    for (let i = 0; i < 3; i++) {
      await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    }

    const reviews = await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id });
    assert.equal(reviews[0].reviewCount, 3, "reviewCount increments per verdict mark");
    const summary = summarizeFlashcardDeckProgress(reviews);
    assert.equal(summary.reviewedCount, 1, "one distinct card, three marks");
    assert.equal(summary.totalReviews, 3, "total verdict marks are counted separately");
    assert.equal(summary.complete, false, "cards 1 and 2 were never reviewed");
  });

  it("a deck is complete only once every card has been reviewed at least once", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "AGAIN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 2, verdict: "KNOWN" });

    const summary = summarizeFlashcardDeckProgress(
      await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
    );
    assert.equal(summary.complete, true, "all three cards have reviewCount > 0");
    assert.equal(summary.reviewedCount, 3);
  });

  it("known/learning counts aggregate deterministically from current card status", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    // card 0: NEW -> LEARNING (one KNOWN mark)
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    // card 1: NEW -> LEARNING -> KNOWN (two KNOWN marks)
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });
    // card 2: untouched.

    const summary = summarizeFlashcardDeckProgress(
      await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
    );
    assert.equal(summary.knownCount, 1, "only card 1 reached KNOWN (deterministic two-mark climb)");
    assert.equal(summary.learningCount, 1, "card 0 is LEARNING");
    assert.equal(summary.reviewedCount, 2);
    assert.equal(summary.totalReviews, 3);

    const progress = await getStudyProgressForUser(aliceId, kbAId);
    const entry = progress[deck.id];
    assert.ok(entry);
    assert.equal(entry.attempts, 2, "DTO attempts = distinct cards reviewed");
    assert.equal(entry.knownCount, 1, "DTO knownCount matches the derived summary");
    assert.equal(entry.reviewCount, 3, "DTO reviewCount sums every verdict mark across the deck");
  });

  it("completion and totals never leak across users in the same knowledge base", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    const bobReviews = await getFlashcardReviewsForUser(bobId, { knowledgeBaseId: kbAId, artifactId: deck.id });
    assert.ok(bobReviews.every((r) => r.reviewCount === 0), "Bob shares the KB but sees no review activity");
    assert.equal(summarizeFlashcardDeckProgress(bobReviews).reviewedCount, 0);
    assert.deepEqual(await getStudyProgressForUser(bobId, kbAId), {}, "Bob's projection has no entry at all");

    const aliceSummary = summarizeFlashcardDeckProgress(
      await getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
    );
    assert.equal(aliceSummary.totalReviews, 2);
    assert.equal(aliceSummary.reviewedCount, 1);
  });

  it("cross-org knowledge bases are NOT_FOUND so provenance is unreachable across orgs", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deckB = await makeDeck(kbBId);

    await assert.rejects(
      getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbBId, artifactId: deckB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbBId, artifactId: deckB.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(getStudyProgressForUser(bobId, kbBId), rejectsCode("NOT_FOUND"));
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: deckB.id } }),
      0,
      "a denied mark never persists a review row",
    );
  });

  it("provenance maps the sourceIds snapshot to real names and never invents the missing ones", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    const sources = [{ id: docA1Id, name: "alpha.pdf" }];

    const refs = resolveSourceProvenance(deck.sourceIds, sources);
    assert.deepEqual(refs, [{ id: docA1Id, name: "alpha.pdf" }], "known snapshot ids resolve to their names");
    assert.equal(deck.sourceIds.length, 1, "the snapshot is the artifact's own source scope");
  });

  it("a deleted source never crashes provenance and falls back to the raw id", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const goneId = randomUUID();
    const refs = resolveSourceProvenance([docA1Id, goneId], [{ id: docA1Id, name: "alpha.pdf" }]);
    assert.deepEqual(refs, [
      { id: docA1Id, name: "alpha.pdf" },
      { id: goneId, name: goneId },
    ], "a missing source falls back to its id instead of an invented name");
  });

  it("regenerating a deck starts independent progress while the original keeps its totals", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const regenerated = (await client.learningArtifact.findFirst({
      where: {
        knowledgeBaseId: kbAId,
        type: "FLASHCARDS",
        metadata: { path: ["parentArtifactId"], equals: deck.id },
      },
    }))!;
    assert.equal(regenerated.status, "FAILED");
    await assert.rejects(
      getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: regenerated.id }),
      rejectsCode("ARTIFACT_NOT_COMPLETED"),
    );
    assert.equal(
      await client.flashcardReview.count({ where: { artifactId: regenerated.id } }),
      0,
      "the regenerated deck inherits none of the original's review state",
    );

    const progress = await getStudyProgressForUser(aliceId, kbAId);
    assert.equal(progress[deck.id]?.attempts, 1, "the original deck keeps its distinct-reviewed count");
    assert.equal(progress[deck.id]?.reviewCount, 1, "the original deck keeps its total-verdict count");
  });

  it("a non-flashcards artifact is rejected as the wrong type", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "QUIZ",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "A quiz, not a deck",
      content: {
        title: "Q",
        questions: [],
      } as never,
      createdById: aliceId,
    });

    await assert.rejects(
      getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id }),
      rejectsCode("ARTIFACT_NOT_FLASHCARDS"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("ARTIFACT_NOT_FLASHCARDS"),
    );
  });

  it("malformed deck content is rejected safely without a review row", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const malformed = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "FLASHCARDS",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      name: "Broken deck",
      content: { title: "Broken", cards: [] } as never,
      createdById: aliceId,
    });

    await assert.rejects(
      getFlashcardReviewsForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: malformed.id }),
      rejectsCode("ARTIFACT_CONTENT_INVALID"),
    );
    await assert.rejects(
      markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: malformed.id, cardId: 0, verdict: "KNOWN" }),
      rejectsCode("ARTIFACT_CONTENT_INVALID"),
    );
    assert.equal(await client.flashcardReview.count({ where: { artifactId: malformed.id } }), 0);
  });
});