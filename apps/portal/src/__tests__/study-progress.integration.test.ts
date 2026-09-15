import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createLearningArtifact } from "@/lib/artifacts";
import {
  getStudyCountsForProject,
  getStudyProgressForUser,
  startQuizAttemptForUser,
  submitQuizAttemptForUser,
  getQuizAttemptHistoryForUser,
  markFlashcardReviewForUser,
} from "@/lib/study";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

function validQuizContent() {
  return {
    title: "Numbers",
    instructions: "Pick the right value.",
    questions: [
      { question: "1+1?", options: ["1", "2", "3"], correctAnswer: 1, explanation: "One plus one is two." },
      { question: "2+2?", options: ["4", "5"], correctAnswer: 0, explanation: "Two plus two is four." },
    ],
  };
}

function validDeckContent() {
  return {
    title: "Numbers deck",
    cards: [
      { front: "1+1", back: "2" },
      { front: "2+2", back: "4" },
      { front: "3+3", back: "6" },
    ],
  };
}

const ALL_ANSWERS = [
  { questionId: 0, selectedAnswer: 1 },
  { questionId: 1, selectedAnswer: 0 },
];

// Derived study progress projection against a real database: per-learner,
// per-KB aggregates over the persisted quiz attempts and flashcard reviews,
// plus the per-project rolling totals. Runs in the same DB as every other
// integration suite, so assertions are always scoped to test-owned rows.
describe("study progress projection against a real database", () => {
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
        { id: aliceId, email: `progress-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `progress-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `progress-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `progress-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `progress-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Progress Org A", slug: `proga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Progress Org B", slug: `progb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `projpa-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `projpb-${randomUUID()}`, organizationId: orgBId },
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

    // Bob and Alice share KB A (per-user isolation on the same KB); the
    // stranger only reaches KB B (cross-org boundary).
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

  async function makeQuiz(kbId: string, status = "COMPLETED", content: unknown = validQuizContent()) {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "QUIZ",
      sourceIds: [kbId === kbAId ? docA1Id : docB1Id],
      status: status as "COMPLETED",
      name: "Numbers quiz",
      content: content as never,
      createdById: kbId === kbAId ? aliceId : strangerId,
    });
  }

  async function makeDeck(kbId: string, status = "COMPLETED", content: unknown = validDeckContent()) {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "FLASHCARDS",
      sourceIds: [kbId === kbAId ? docA1Id : docB1Id],
      status: status as "COMPLETED",
      name: "Numbers deck",
      content: content as never,
      createdById: kbId === kbAId ? aliceId : strangerId,
    });
  }

  it("aggregates completed quiz attempts into best score, attempts and lastStudiedAt", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    await submitQuizAttemptForUser(aliceId, {
      attemptId: (await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id })).id,
      answers: [{ questionId: 0, selectedAnswer: 1 }, { questionId: 1, selectedAnswer: 1 }], // score 1
    });
    const second = await submitQuizAttemptForUser(aliceId, {
      attemptId: (await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id })).id,
      answers: ALL_ANSWERS, // score 2
    });

    const progress = await getStudyProgressForUser(aliceId, kbAId);
    const summary = progress[quiz.id];
    assert.ok(summary, "a studied quiz gets a progress entry");
    assert.equal(summary.attempts, 2);
    assert.equal(summary.bestScore, 2);
    assert.equal(summary.totalQuestions, 2);
    assert.equal(summary.knownCount, null, "quiz entries never carry flashcard fields");
    assert.equal(
      summary.lastStudiedAt,
      new Date(second.completedAt ?? "").toISOString(),
      "lastStudiedAt is the newest completed attempt",
    );
  });

  it("aggregates flashcard reviews into per-deck known and reviewed counts", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    // NEW + KNOWN only reaches LEARNING; a card climbs to KNOWN on a second
    // KNOWN verdict (deterministic progression).
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 2, verdict: "AGAIN" });

    const progress = await getStudyProgressForUser(aliceId, kbAId);
    const summary = progress[deck.id];
    assert.ok(summary, "a reviewed deck gets a progress entry");
    assert.equal(summary.attempts, 3, "attempts = distinct cards reviewed (one row per card)");
    assert.equal(summary.knownCount, 2);
    assert.equal(summary.bestScore, null, "deck entries never carry quiz fields");
    assert.ok(summary.lastStudiedAt);
  });

  it("a user's progress never leaks across users in the same knowledge base", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    await submitQuizAttemptForUser(aliceId, {
      attemptId: (await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id })).id,
      answers: ALL_ANSWERS,
    });

    const bobsProgress = await getStudyProgressForUser(bobId, kbAId);
    assert.equal(bobsProgress[quiz.id], undefined, "Bob shares the KB but has no attempt");
    assert.deepEqual(Object.keys(bobsProgress), [], "Bob sees no progress at all");
  });

  it("untouched artifacts get no progress entry (caller renders them as not started)", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId);
    const progress = await getStudyProgressForUser(aliceId, kbAId);
    assert.equal(progress[deck.id], undefined, "no review rows -> no entry");
  });

  it("cross-org knowledge bases resolve to NOT_FOUND", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quizInB = await makeQuiz(kbBId);
    await submitQuizAttemptForUser(strangerId, {
      attemptId: (await startQuizAttemptForUser(strangerId, { knowledgeBaseId: kbBId, artifactId: quizInB.id })).id,
      answers: ALL_ANSWERS,
    });

    await assert.rejects(getStudyProgressForUser(aliceId, kbBId), rejectsCode("NOT_FOUND"));
    await assert.rejects(getStudyProgressForUser(strangerId, kbAId), rejectsCode("NOT_FOUND"));
  });

  it("score history returns completed attempts newest first", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    await submitQuizAttemptForUser(aliceId, {
      attemptId: (await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id })).id,
      answers: [{ questionId: 0, selectedAnswer: 1 }, { questionId: 1, selectedAnswer: 1 }], // score 1
    });
    const last = await submitQuizAttemptForUser(aliceId, {
      attemptId: (await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id })).id,
      answers: ALL_ANSWERS, // score 2
    });

    const history = await getQuizAttemptHistoryForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    assert.equal(history.length, 2);
    assert.equal(history[0].id, last.id, "newest completed attempt first");
    assert.equal(history[0].score, 2);
    assert.equal(history[1].score, 1);
    assert.ok(history[0].completedAt);

    assert.deepEqual(
      await getQuizAttemptHistoryForUser(bobId, { knowledgeBaseId: kbAId, artifactId: quiz.id }),
      [],
      "same-KB users see no one else's history",
    );
    await assert.rejects(
      getQuizAttemptHistoryForUser(aliceId, { knowledgeBaseId: kbBId, artifactId: quiz.id }),
      rejectsCode("NOT_FOUND"),
    );
  });

  it("project-level counts sum only the learner's completed/known rows in the project's KBs", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    // The test DB is shared across suites, so everything here is asserted as a
    // delta from the file's own baseline, never as an absolute total.
    const baseline = await getStudyCountsForProject(aliceId, projAId);

    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    assert.deepEqual(
      await getStudyCountsForProject(aliceId, projAId),
      baseline,
      "a pending attempt does not count as taken",
    );

    await submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: ALL_ANSWERS });
    const afterQuiz = await getStudyCountsForProject(aliceId, projAId);
    assert.equal(afterQuiz.quizzesTaken, baseline.quizzesTaken + 1);
    assert.equal(afterQuiz.cardsKnown, baseline.cardsKnown, "a quiz moves no card counts");

    const deck = await makeDeck(kbAId);
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "AGAIN" });
    // Bob's knowledge in the same KB must not leak into Alice's totals.
    await markFlashcardReviewForUser(bobId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });

    const afterCards = await getStudyCountsForProject(aliceId, projAId);
    assert.equal(afterCards.quizzesTaken, baseline.quizzesTaken + 1);
    assert.equal(afterCards.cardsKnown, baseline.cardsKnown + 1, "only Alice's KNOWN cards count");
  });
});