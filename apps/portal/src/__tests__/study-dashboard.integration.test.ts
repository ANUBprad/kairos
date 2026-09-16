import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createLearningArtifact } from "@/lib/artifacts";
import {
  getStudyDashboardForUser,
  getRecentQuizAttemptsForUser,
  summarizeStudyProgress,
  startQuizAttemptForUser,
  submitQuizAttemptForUser,
  markFlashcardReviewForUser,
  studyArtifactHref,
  studyDashboardHref,
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
const ONE_WRONG = [
  { questionId: 0, selectedAnswer: 1 },
  { questionId: 1, selectedAnswer: 1 },
];

describe("Study Dashboard route and aggregation contracts", () => {
  it("routes to canonical existing pages only", () => {
    assert.equal(studyArtifactHref("kb1", "art9"), "/app/knowledge-bases/kb1/artifacts/art9");
    assert.equal(studyDashboardHref("kb1"), "/app/knowledge-bases/kb1/study");
  });

  it("summarizes quiz attempts and deck verdict marks without inventing mastery", () => {
    const summary = summarizeStudyProgress([
      { type: "QUIZ", study: { attempts: 1, bestScore: 1, totalQuestions: 2, reviewCount: null, knownCount: null, lastStudiedAt: "t" } },
      { type: "QUIZ", study: { attempts: 3, bestScore: 2, totalQuestions: 2, reviewCount: null, knownCount: null, lastStudiedAt: "t" } },
      { type: "FLASHCARDS", study: { attempts: 3, bestScore: null, totalQuestions: null, reviewCount: 5, knownCount: 2, lastStudiedAt: "t" } },
      { type: "MINDMAP", study: null },
      { type: "QUIZ", study: null },
    ]);
    assert.deepEqual(summary, {
      quizzesTaken: 4,
      cardReviews: 5,
      cardsKnown: 2,
      studiedArtifacts: 3,
    });
  });
});

describe("Study Dashboard projection against a real database", () => {
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
  const kbCId = randomUUID();
  const docA1Id = randomUUID();
  const docB1Id = randomUUID();
  const docC1Id = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `dash-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `dash-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `dash-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `dash-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `dash-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Dash Org A", slug: `dashorga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Dash Org B", slug: `dashorgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Dash Project A", slug: `dashpa-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Dash Project B", slug: `dashpb-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "Dash KB A", projectId: projAId },
        { id: kbBId, name: "Dash KB B", projectId: projBId },
        { id: kbCId, name: "Dash KB C (empty)", projectId: projAId },
      ],
    });

    await client.document.createMany({
      data: [
        { id: docA1Id, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docB1Id, name: "gamma.md", fileType: "md", knowledgeBaseId: kbBId, status: "INDEXED" },
        { id: docC1Id, name: "zeta.md", fileType: "md", knowledgeBaseId: kbCId, status: "INDEXED" },
      ],
    });

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

  async function makeQuiz(kbId: string, name = "Numbers quiz") {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "QUIZ",
      sourceIds: [kbId === kbAId ? docA1Id : kbId === kbBId ? docB1Id : docC1Id],
      status: "COMPLETED" as const,
      name,
      content: validQuizContent() as never,
      createdById: kbId === kbAId ? aliceId : kbId === kbBId ? strangerId : aliceId,
    });
  }

  async function makeDeck(kbId: string, name = "Numbers deck") {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "FLASHCARDS",
      sourceIds: [kbId === kbAId ? docA1Id : kbId === kbBId ? docB1Id : docC1Id],
      status: "COMPLETED" as const,
      name,
      content: validDeckContent() as never,
      createdById: kbId === kbAId ? aliceId : kbId === kbBId ? strangerId : aliceId,
    });
  }

  async function takeQuiz(
    userId: string,
    knowledgeBaseId: string,
    artifactId: string,
    answers: typeof ALL_ANSWERS,
  ) {
    return submitQuizAttemptForUser(userId, {
      attemptId: (await startQuizAttemptForUser(userId, { knowledgeBaseId, artifactId })).id,
      answers,
    });
  }

  it("resolves to null for cross-org knowledge bases and unknown ids", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    assert.equal(await getStudyDashboardForUser(aliceId, kbBId), null, "member of another org sees nothing");
    assert.equal(await getStudyDashboardForUser(strangerId, kbAId), null);
    assert.equal(await getStudyDashboardForUser(aliceId, randomUUID()), null, "unknown kb id is null");
  });

  it("serves an untouched knowledge base as an honest empty state", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const dash = await getStudyDashboardForUser(aliceId, kbCId);
    assert.ok(dash);
    assert.equal(dash.kbName, "Dash KB C (empty)");
    assert.deepEqual(dash.artifacts, []);
    assert.deepEqual(dash.recentAttempts, []);
    assert.deepEqual(dash.summary, { quizzesTaken: 0, cardReviews: 0, cardsKnown: 0, studiedArtifacts: 0 });
  });

  it("counts completed quiz attempts and exposes recent attempts newest first", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quizOne = await makeQuiz(kbAId, "Quiz one");
    const quizTwo = await makeQuiz(kbAId, "Quiz two");
    await takeQuiz(aliceId, kbAId, quizOne.id, ONE_WRONG); // score 1
    const firstTwo = await takeQuiz(aliceId, kbAId, quizTwo.id, ONE_WRONG); // score 1
    const lastTwo = await takeQuiz(aliceId, kbAId, quizTwo.id, ALL_ANSWERS); // score 2

    const dash = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(dash);
    assert.equal(dash.summary.quizzesTaken, 3);
    assert.equal(dash.summary.studiedArtifacts, 2);

    const byId = new Map(dash.artifacts.map((a) => [a.id, a]));
    assert.equal(byId.get(quizOne.id)?.study?.attempts, 1);
    assert.equal(byId.get(quizOne.id)?.study?.bestScore, 1);
    assert.equal(byId.get(quizOne.id)?.study?.totalQuestions, 2);
    assert.equal(byId.get(quizTwo.id)?.study?.attempts, 2);
    assert.equal(byId.get(quizTwo.id)?.study?.bestScore, 2);

    assert.equal(dash.recentAttempts.length, 3, "one row per completed attempt");
    assert.equal(dash.recentAttempts[0].id, lastTwo.id, "newest completed attempt first");
    assert.equal(dash.recentAttempts[0].score, 2);
    assert.equal(dash.recentAttempts[1].id, firstTwo.id);
    assert.equal(dash.recentAttempts[1].score, 1);
    assert.equal(dash.recentAttempts[2].artifactId, quizOne.id, "older attempt references its artifact");
    for (const attempt of dash.recentAttempts) {
      assert.ok(attempt.artifactName, "attempt carries the artifact name for display");
      assert.ok(attempt.completedAt);
    }

    // The dashboard stays insulated from non-study artifact types.
    await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "MINDMAP",
      sourceIds: [docA1Id],
      status: "COMPLETED" as const,
      name: "Brain dump",
      content: { nodes: [] } as never,
      createdById: aliceId,
    });
    const afterMindmap = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(afterMindmap);
    assert.equal(
      afterMindmap.artifacts.length,
      dash.artifacts.length,
      "a mindmap is a studio artifact, not a study surface",
    );
  });

  it("keeps distinct reviewed cards separate from review events for decks", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const deck = await makeDeck(kbAId, "Distinct deck");
    // card 0 climbs to KNOWN (two KNOWN verdicts), card 1 stays LEARNING,
    // card 2 is AGAIN: three distinct cards touched, four verdict marks.
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 1, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: deck.id, cardId: 2, verdict: "AGAIN" });

    const dash = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(dash);
    const study = dash.artifacts.find((a) => a.id === deck.id)?.study;
    assert.ok(study);
    assert.equal(study.attempts, 3, "attempts = distinct reviewed cards, not verdict marks");
    assert.equal(study.reviewCount, 4, "reviewCount = total verdict marks incl. repeats");
    assert.equal(study.knownCount, 1);
    assert.equal(dash.summary.cardReviews, 4);
    assert.equal(dash.summary.cardsKnown, 1);

    assert.deepEqual(summarizeStudyProgress(dash.artifacts), dash.summary, "summary matches its projection");
  });

  it("never mixes one learner's attempts or verdicts into another's dashboard", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const sharedQuiz = await makeQuiz(kbAId, "Shared quiz");
    await takeQuiz(aliceId, kbAId, sharedQuiz.id, ALL_ANSWERS);
    await takeQuiz(bobId, kbAId, sharedQuiz.id, ALL_ANSWERS);

    const sharedDeck = await makeDeck(kbAId, "Shared deck");
    // Alice completes a card (two KNOWN verdicts climb NEW -> LEARNING -> KNOWN);
    // Bob's single KNOWN verdict leaves his own copy at LEARNING.
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: sharedDeck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: sharedDeck.id, cardId: 0, verdict: "KNOWN" });
    await markFlashcardReviewForUser(bobId, { knowledgeBaseId: kbAId, artifactId: sharedDeck.id, cardId: 0, verdict: "KNOWN" });

    const alice = await getStudyDashboardForUser(aliceId, kbAId);
    const bob = await getStudyDashboardForUser(bobId, kbAId);
    assert.ok(alice && bob);
    const aliceOwn = alice.recentAttempts.filter((r) => r.artifactId === sharedQuiz.id);
    const bobOwn = bob.recentAttempts.filter((r) => r.artifactId === sharedQuiz.id);
    assert.equal(aliceOwn.length, 1, "Alice sees her own attempt, not Bob's");
    assert.equal(bobOwn.length, 1, "Bob sees his own attempt, not Alice's");
    assert.equal(
      alice.artifacts.find((a) => a.id === sharedDeck.id)?.study?.knownCount,
      1,
      "Bob's KNOWN verdict does not add to Alice's known count",
    );
    assert.equal(
      bob.artifacts.find((a) => a.id === sharedDeck.id)?.study?.knownCount,
      0,
      "Bob's own single KNOWN verdict leaves his card at LEARNING",
    );
  });

  it("a deleted artifact leaves no ghost progress or attempt rows", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const doomed = await makeQuiz(kbAId, "Doomed quiz");
    await takeQuiz(aliceId, kbAId, doomed.id, ALL_ANSWERS);

    const before = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(before);
    assert.ok(before.artifacts.some((a) => a.id === doomed.id));

    await client.learningArtifact.delete({ where: { id: doomed.id } });
    const after = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(after);
    assert.ok(!after.artifacts.some((a) => a.id === doomed.id), "deleted artifact is gone");
    assert.ok(!after.recentAttempts.some((r) => r.artifactId === doomed.id), "attempts cascade away");
    assert.equal(after.summary.quizzesTaken, before.summary.quizzesTaken - 1);
  });

  it("a regenerated artifact starts with independent, empty study state", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const original = await makeQuiz(kbAId, "Regen quiz");
    await takeQuiz(aliceId, kbAId, original.id, ALL_ANSWERS);
    await client.learningArtifact.delete({ where: { id: original.id } });

    const regenerated = await makeQuiz(kbAId, "Regen quiz");
    const dash = await getStudyDashboardForUser(aliceId, kbAId);
    assert.ok(dash);
    const study = dash.artifacts.find((a) => a.id === regenerated.id)?.study;
    assert.equal(study, null, "a brand-new artifact id has no inherited attempts or scores");
    assert.ok(!dash.recentAttempts.some((r) => r.artifactId === regenerated.id));
  });

  it("recent quiz history is scoped and bounded by the knowledge base", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(
      getRecentQuizAttemptsForUser(aliceId, { knowledgeBaseId: kbBId }),
      rejectsCode("NOT_FOUND"),
      "cross-org history query is refused",
    );
    const history = await getRecentQuizAttemptsForUser(aliceId, { knowledgeBaseId: kbAId }, 1);
    assert.ok(history.length <= 1, "limit parameter bounds the rows");
  });
});