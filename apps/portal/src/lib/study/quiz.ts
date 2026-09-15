import type { QuizAttempt, QuizAttemptAnswer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { AppError } from "@/lib/errors";
import { getLearningArtifactInKb } from "@/lib/artifacts";
import { parseQuizContent, type QuizViewContent } from "@/lib/artifacts/quiz-view";

// Persistent quiz attempts. questionId is the 0-based index into the artifact's
// (immutable) questions array — generated questions carry no ids of their own.
// Correctness is always computed by the server from the stored content; the
// client only ever submits questionId + selectedAnswer. Completed attempts are
// immutable: the row is written once at submit and never changed again.

export interface QuizAnswerInput {
  questionId: number;
  selectedAnswer: number;
}

export interface GradedQuizAnswer extends QuizAnswerInput {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
}

export interface QuizAttemptData {
  id: string;
  artifactId: string;
  knowledgeBaseId: string;
  status: "PENDING" | "COMPLETED";
  score: number;
  totalQuestions: number;
  completedAt: string | null;
  answers: GradedQuizAnswer[];
}

export type QuizQuestionView = QuizViewContent["questions"][number];
type QuizAttemptRow = QuizAttempt;
type QuizAttemptAnswerRow = QuizAttemptAnswer;

export interface QuizAttemptSummary {
  id: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
}

export function assertAllQuestionsAnswered(
  questions: readonly QuizQuestionView[],
  answers: readonly QuizAnswerInput[],
): void {
  const answered = new Set(answers.map((a) => a.questionId));
  for (let i = 0; i < questions.length; i++) {
    if (!answered.has(i)) {
      throw new AppError("QUIZ_ATTEMPT_INCOMPLETE", `Question ${i} has no answer`, 400);
    }
  }
}

export function gradeQuizAnswers(
  questions: readonly QuizQuestionView[],
  answers: readonly QuizAnswerInput[],
): GradedQuizAnswer[] {
  const seen = new Set<number>();
  return answers.map((answer) => {
    const question = questions[answer.questionId];
    if (!question) {
      throw new AppError(
        "QUIZ_ATTEMPT_INVALID_QUESTION",
        `No question with id ${answer.questionId} in this quiz`,
        400,
      );
    }
    if (seen.has(answer.questionId)) {
      throw new AppError(
        "QUIZ_ATTEMPT_DUPLICATE_QUESTION",
        `Question ${answer.questionId} was answered more than once`,
        400,
      );
    }
    seen.add(answer.questionId);
    if (
      !Number.isInteger(answer.selectedAnswer) ||
      answer.selectedAnswer < 0 ||
      answer.selectedAnswer >= question.options.length
    ) {
      throw new AppError(
        "QUIZ_ATTEMPT_INVALID_ANSWER",
        `Answer for question ${answer.questionId} is not a valid option index`,
        400,
      );
    }
    return {
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: answer.selectedAnswer === question.correctAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  });
}

// The correct option and its explanation are not duplicated into the answer
// rows (single source of truth = the immutable artifact content); they are
// resolved at read time from the parsed content when it is available.
function toQuizAttemptData(
  row: QuizAttemptRow,
  answers: readonly QuizAttemptAnswerRow[],
  questions: readonly QuizQuestionView[] | null,
): QuizAttemptData {
  return {
    id: row.id,
    artifactId: row.artifactId,
    knowledgeBaseId: row.knowledgeBaseId,
    status: row.status,
    score: row.score,
    totalQuestions: row.totalQuestions,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    answers: answers.map((answer) => ({
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: answer.isCorrect,
      correctAnswer: questions?.[answer.questionId]?.correctAnswer ?? 0,
      explanation: questions?.[answer.questionId]?.explanation ?? "",
    })),
  };
}

async function loadQuizForAttempt(
  knowledgeBaseId: string,
  artifactId: string,
): Promise<{ questions: readonly QuizQuestionView[] }> {
  const artifact = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  if (!artifact) throw new AppError("NOT_FOUND", "Artifact not found", 404);
  if (artifact.type !== "QUIZ") throw new AppError("ARTIFACT_NOT_QUIZ", "Artifact is not a quiz", 400);
  if (artifact.status !== "COMPLETED") {
    throw new AppError("ARTIFACT_NOT_COMPLETED", "The quiz is not ready to take", 409);
  }
  const content = parseQuizContent(artifact.content);
  if (!content) throw new AppError("ARTIFACT_CONTENT_INVALID", "The quiz content is unavailable", 400);
  return { questions: content.questions };
}

// Starts (or reuses) the caller's in-progress attempt on a quiz. A completed
// attempt is never resumed — the caller starts a new one via "Try again".
export async function startQuizAttemptForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string },
): Promise<QuizAttemptData> {
  const { knowledgeBaseId, artifactId } = request;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }
  await loadQuizForAttempt(knowledgeBaseId, artifactId);

  const existing = await prisma.quizAttempt.findFirst({
    where: { userId, artifactId, knowledgeBaseId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return toQuizAttemptData(existing, [], null);

  const created = await prisma.quizAttempt.create({
    data: { artifactId, knowledgeBaseId, userId },
  });
  return toQuizAttemptData(created, [], null);
}

// Grades the caller's attempt server-side against the stored artifact content
// and finalizes it. The atomic PENDING->COMPLETED claim makes the first submit
// win: a concurrent or repeated submit of the same attempt is rejected.
export async function submitQuizAttemptForUser(
  userId: string,
  request: { attemptId: string; answers: QuizAnswerInput[] },
): Promise<QuizAttemptData> {
  const { attemptId, answers } = request;

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, status: true, artifactId: true, knowledgeBaseId: true },
  });
  if (!attempt) throw new AppError("NOT_FOUND", "Attempt not found", 404);
  const { knowledgeBaseId, artifactId } = attempt;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }
  if (attempt.status === "COMPLETED") {
    throw new AppError("QUIZ_ATTEMPT_COMPLETED", "This attempt was already submitted", 409);
  }

  const { questions } = await loadQuizForAttempt(knowledgeBaseId, artifactId);
  assertAllQuestionsAnswered(questions, answers);
  const graded = gradeQuizAnswers(questions, answers);
  const score = graded.filter((g) => g.isCorrect).length;

  const [completed, answerRows] = await prisma.$transaction(async (tx) => {
    const claimed = await tx.quizAttempt.updateMany({
      where: { id: attemptId, userId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        score,
        totalQuestions: questions.length,
        completedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new AppError("QUIZ_ATTEMPT_COMPLETED", "This attempt was already submitted", 409);
    }
    await tx.quizAttemptAnswer.deleteMany({ where: { attemptId } });
    await tx.quizAttemptAnswer.createMany({
      data: graded.map((g) => ({
        attemptId,
        questionId: g.questionId,
        selectedAnswer: g.selectedAnswer,
        isCorrect: g.isCorrect,
      })),
    });
    const rows = await tx.quizAttemptAnswer.findMany({
      where: { attemptId },
      orderBy: { questionId: "asc" },
    });
    return [await tx.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } }), rows] as const;
  });

  return toQuizAttemptData(completed, answerRows, questions);
}

// Latest attempt for reload, or null when the user has never started this quiz.
export async function getQuizAttemptForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string },
): Promise<QuizAttemptData | null> {
  const { knowledgeBaseId, artifactId } = request;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }

  const attempt = await prisma.quizAttempt.findFirst({
    where: { userId, artifactId, knowledgeBaseId },
    orderBy: { createdAt: "desc" },
    include: { answers: { orderBy: { questionId: "asc" } } },
  });
  if (!attempt) return null;

  const artifact = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  const content = artifact ? parseQuizContent(artifact.content) : null;
  return toQuizAttemptData(attempt, attempt.answers, content?.questions ?? null);
}

// Score history for a quiz the user can access, newest first. Only completed
// attempts carry a score; an in-progress attempt is resumed separately through
// getQuizAttemptForUser.
export async function getQuizAttemptHistoryForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string },
): Promise<QuizAttemptSummary[]> {
  const { knowledgeBaseId, artifactId } = request;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }

  const rows = await prisma.quizAttempt.findMany({
    where: { userId, artifactId, knowledgeBaseId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, score: true, totalQuestions: true, completedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    score: row.score,
    totalQuestions: row.totalQuestions,
    completedAt: row.completedAt ? row.completedAt.toISOString() : "",
  }));
}