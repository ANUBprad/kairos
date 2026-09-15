import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createLearningArtifact,
  deleteLearningArtifact,
  getLearningArtifactInKb,
  listLearningArtifacts,
} from "@/lib/artifacts";
import { regenerateLearningArtifactForUser } from "@/lib/artifacts/engine";
import {
  getQuizAttemptForUser,
  startQuizAttemptForUser,
  submitQuizAttemptForUser,
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

const ALL_ANSWERS = [
  { questionId: 0, selectedAnswer: 1 },
  { questionId: 1, selectedAnswer: 0 },
];

// Lifecycle runs against a real database. Like the artifact suites, all
// generation paths stop at the context stage (chunkless sources) before any
// provider call, so the regeneration tests need a dummy key only.
describe("persistent quiz attempts against a real database", () => {
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
        { id: aliceId, email: `study-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `study-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: strangerId, email: `study-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `study-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `study-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Study Org A", slug: `storga-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Study Org B", slug: `storgb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `stproja-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `stprojb-${randomUUID()}`, organizationId: orgBId },
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

  async function makeQuiz(kbId: string, status = "COMPLETED", content: unknown = validQuizContent()) {
    return createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "QUIZ",
      sourceIds: [kbId === kbAId ? docA1Id : docB1Id],
      status: status as "COMPLETED",
      name: "Numbers quiz",
      content: content as never,
      createdById: kbId === kbAId ? aliceId : bobId,
    });
  }

  it("starting creates a PENDING attempt and a second start reuses it", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);

    const first = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    assert.equal(first.status, "PENDING");
    assert.equal(first.artifactId, quiz.id);
    assert.deepEqual(first.answers, []);

    const second = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    assert.equal(second.id, first.id, "an in-progress attempt is reused, not duplicated");
    assert.equal(
      await client.quizAttempt.count({ where: { artifactId: quiz.id, userId: aliceId } }),
      1,
    );
  });

  it("submitting grades server-side and finalizes the attempt", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });

    const completed = await submitQuizAttemptForUser(aliceId, {
      attemptId: attempt.id,
      answers: [
        { questionId: 0, selectedAnswer: 1 },
        { questionId: 1, selectedAnswer: 1 }, // wrong on purpose
      ],
    });

    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.score, 1);
    assert.equal(completed.totalQuestions, 2);
    assert.ok(completed.completedAt);
    assert.equal(completed.answers.length, 2);
    assert.equal(completed.answers[0].isCorrect, true);
    assert.equal(completed.answers[0].correctAnswer, 1);
    assert.equal(completed.answers[0].explanation, "One plus one is two.");
    assert.equal(completed.answers[1].isCorrect, false);
    assert.equal(completed.answers[1].selectedAnswer, 1);

    const rows = await client.quizAttemptAnswer.findMany({ where: { attemptId: attempt.id } });
    assert.equal(rows.length, 2);
    const byQuestion = new Map(rows.map((r) => [r.questionId, r]));
    assert.equal(byQuestion.get(0)?.isCorrect, true, "isCorrect is computed server-side");
    assert.equal(byQuestion.get(1)?.isCorrect, false);

    const row = await client.quizAttempt.findUnique({ where: { id: attempt.id } });
    assert.equal(row?.status, "COMPLETED");
    assert.equal(row?.score, 1);
    assert.ok(row?.completedAt);
  });

  it("a completed attempt is immutable: a second submit is rejected and changes nothing", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    await submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: ALL_ANSWERS });

    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: ALL_ANSWERS }),
      rejectsCode("QUIZ_ATTEMPT_COMPLETED"),
    );

    const row = await client.quizAttempt.findUnique({ where: { id: attempt.id } });
    assert.equal(row?.status, "COMPLETED");
    assert.equal(row?.score, 2);
    assert.equal(await client.quizAttemptAnswer.count({ where: { attemptId: attempt.id } }), 2);
  });

  it("rejects incomplete, unknown-question, out-of-range and duplicate submissions and leaves the attempt PENDING", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });

    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: [{ questionId: 0, selectedAnswer: 1 }] }),
      rejectsCode("QUIZ_ATTEMPT_INCOMPLETE"),
    );
    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: [
        { questionId: 7, selectedAnswer: 0 },
        { questionId: 0, selectedAnswer: 0 },
        { questionId: 1, selectedAnswer: 0 },
      ] }),
      rejectsCode("QUIZ_ATTEMPT_INVALID_QUESTION"),
    );
    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: [
        { questionId: 0, selectedAnswer: 9 },
        { questionId: 1, selectedAnswer: 0 },
      ] }),
      rejectsCode("QUIZ_ATTEMPT_INVALID_ANSWER"),
    );
    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: [
        { questionId: 0, selectedAnswer: 1 },
        { questionId: 0, selectedAnswer: 0 },
        { questionId: 1, selectedAnswer: 0 },
      ] }),
      rejectsCode("QUIZ_ATTEMPT_DUPLICATE_QUESTION"),
    );

    const row = await client.quizAttempt.findUnique({ where: { id: attempt.id } });
    assert.equal(row?.status, "PENDING", "rejected submissions must not finalize the attempt");
  });

  it("a foreign attempt id resolves to NOT_FOUND", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: randomUUID(), answers: ALL_ANSWERS }),
      rejectsCode("NOT_FOUND"),
    );
  });

  it("another user's attempt resolves to NOT_FOUND (per-user isolation)", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbBId);
    const bobsAttempt = await startQuizAttemptForUser(bobId, { knowledgeBaseId: kbBId, artifactId: quiz.id });

    await assert.rejects(
      submitQuizAttemptForUser(aliceId, { attemptId: bobsAttempt.id, answers: ALL_ANSWERS }),
      rejectsCode("NOT_FOUND"),
    );
    assert.equal(
      (await client.quizAttempt.findUnique({ where: { id: bobsAttempt.id } }))?.status,
      "PENDING",
      "the rejected cross-user submit must not touch the owner's attempt",
    );
  });

  it("cross-org cross-KB accesses resolve to NOT_FOUND and leak nothing", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quizInB = await makeQuiz(kbBId);
    const aliceAttempt = await startQuizAttemptForUser(aliceId, {
      knowledgeBaseId: kbAId,
      artifactId: (await makeQuiz(kbAId)).id,
    });

    await assert.rejects(
      startQuizAttemptForUser(strangerId, { knowledgeBaseId: kbAId, artifactId: quizInB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      startQuizAttemptForUser(bobId, { knowledgeBaseId: kbAId, artifactId: quizInB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbBId, artifactId: quizInB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      getQuizAttemptForUser(strangerId, { knowledgeBaseId: kbAId, artifactId: quizInB.id }),
      rejectsCode("NOT_FOUND"),
    );
    await assert.rejects(
      submitQuizAttemptForUser(aliceId, {
        attemptId: (await startQuizAttemptForUser(bobId, { knowledgeBaseId: kbBId, artifactId: quizInB.id })).id,
        answers: ALL_ANSWERS,
      }),
      rejectsCode("NOT_FOUND"),
    );
    assert.equal((await client.quizAttempt.count({ where: { id: aliceAttempt.id } })), 1);
  });

  it("starting a non-QUIZ artifact is rejected with ARTIFACT_NOT_QUIZ", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const summary = await createLearningArtifact({
      knowledgeBaseId: kbAId,
      type: "SUMMARY",
      sourceIds: [docA1Id],
      status: "COMPLETED",
      content: { title: "brief", keyPoints: [] },
      createdById: aliceId,
    });
    await assert.rejects(
      startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: summary.id }),
      rejectsCode("ARTIFACT_NOT_QUIZ"),
    );
  });

  it("starting an unfinished quiz is rejected with ARTIFACT_NOT_COMPLETED", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const pending = await makeQuiz(kbAId, "PENDING");
    await assert.rejects(
      startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: pending.id }),
      rejectsCode("ARTIFACT_NOT_COMPLETED"),
    );
  });

  it("a legacy quiz with unparseable content fails gracefully with ARTIFACT_CONTENT_INVALID", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const legacy = await makeQuiz(kbAId, "COMPLETED", { title: "broken", questions: [{ nope: true }] });
    await assert.rejects(
      startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: legacy.id }),
      rejectsCode("ARTIFACT_CONTENT_INVALID"),
    );
  });

  it("reload after completion returns the persisted attempt", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    await submitQuizAttemptForUser(aliceId, {
      attemptId: (await getQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id }))!.id,
      answers: ALL_ANSWERS,
    });

    const reloaded = await getQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    assert.equal(reloaded?.status, "COMPLETED");
    assert.equal(reloaded?.score, 2);
    assert.equal(reloaded?.answers.length, 2);
    assert.equal(reloaded?.answers[1].explanation, "Two plus two is four.");
  });

  it("regeneration creates a fresh artifact with a clean study slate — no attempt transfer", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    await submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: ALL_ANSWERS });

    await assert.rejects(
      regenerateLearningArtifactForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id }),
      rejectsCode("ARTIFACT_CONTEXT_EMPTY"),
    );

    const regenerated = (await listLearningArtifacts(kbAId)).find(
      (a) => a.id !== quiz.id && a.type === "QUIZ",
    );
    assert.ok(regenerated, "regeneration produced a sibling row");
    assert.equal(regenerated?.status, "FAILED");

    assert.equal(
      await getQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: regenerated!.id }),
      null,
      "a regenerated artifact starts with no attempt history",
    );
    assert.equal(
      await client.quizAttempt.count({
        where: { artifactId: quiz.id, userId: aliceId },
      }),
      1,
      "the original artifact keeps its attempt",
    );
    assert.equal(
      (await client.quizAttempt.findUnique({ where: { id: attempt.id } }))?.artifactId,
      quiz.id,
    );
  });

  it("deleting an artifact cascades its attempts and answers away", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }
    const quiz = await makeQuiz(kbAId);
    const attempt = await startQuizAttemptForUser(aliceId, { knowledgeBaseId: kbAId, artifactId: quiz.id });
    await submitQuizAttemptForUser(aliceId, { attemptId: attempt.id, answers: ALL_ANSWERS });

    const deleted = await deleteLearningArtifact(kbAId, quiz.id);
    assert.equal(deleted?.id, quiz.id);
    assert.equal(await getLearningArtifactInKb(quiz.id, kbAId), null);
    assert.equal(
      await client.quizAttempt.count({ where: { artifactId: quiz.id } }),
      0,
      "attempt rows are cleaned up with their artifact",
    );
    assert.equal(
      await client.quizAttemptAnswer.count({ where: { attemptId: attempt.id } }),
      0,
      "answer rows are cleaned up with their attempt",
    );
  });
});