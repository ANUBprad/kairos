import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertAllQuestionsAnswered,
  gradeQuizAnswers,
  type QuizQuestionView,
} from "@/lib/study/quiz";
import {
  nextFlashcardReviewStatus,
  parseFlashcardReviewStatus,
  parseFlashcardVerdict,
} from "@/lib/study/review-status";

const QUESTIONS: QuizQuestionView[] = [
  {
    question: "1+1?",
    options: ["1", "2", "3"],
    correctAnswer: 1,
    explanation: "One plus one is two.",
  },
  {
    question: "2+2?",
    options: ["4", "5"],
    correctAnswer: 0,
    explanation: "Two plus two is four.",
  },
];

function rejectsCode(code: string) {
  return (err: unknown) => (err as { code?: string }).code === code;
}

describe("quiz grading", () => {
  it("grades each answer against the artifact's correctAnswer and exposes the explanation", () => {
    const graded = gradeQuizAnswers(QUESTIONS, [
      { questionId: 0, selectedAnswer: 1 },
      { questionId: 1, selectedAnswer: 1 },
    ]);
    assert.equal(graded[0].isCorrect, true);
    assert.equal(graded[0].correctAnswer, 1);
    assert.equal(graded[0].explanation, "One plus one is two.");
    assert.equal(graded[1].isCorrect, false);
    assert.equal(graded[1].selectedAnswer, 1);
  });

  it("rejects a questionId outside the quiz", () => {
    assert.throws(
      () => gradeQuizAnswers(QUESTIONS, [{ questionId: 5, selectedAnswer: 0 }]),
      rejectsCode("QUIZ_ATTEMPT_INVALID_QUESTION"),
    );
  });

  it("rejects a selectedAnswer outside the option range of its question", () => {
    assert.throws(
      () => gradeQuizAnswers(QUESTIONS, [{ questionId: 0, selectedAnswer: 3 }]),
      rejectsCode("QUIZ_ATTEMPT_INVALID_ANSWER"),
    );
    assert.throws(
      () => gradeQuizAnswers(QUESTIONS, [{ questionId: 0, selectedAnswer: -1 }]),
      rejectsCode("QUIZ_ATTEMPT_INVALID_ANSWER"),
    );
  });

  it("rejects a duplicate questionId in one submission", () => {
    assert.throws(
      () =>
        gradeQuizAnswers(QUESTIONS, [
          { questionId: 0, selectedAnswer: 0 },
          { questionId: 0, selectedAnswer: 1 },
        ]),
      rejectsCode("QUIZ_ATTEMPT_DUPLICATE_QUESTION"),
    );
  });

  it("requires every question to be answered before grading", () => {
    assert.throws(
      () => assertAllQuestionsAnswered(QUESTIONS, [{ questionId: 0, selectedAnswer: 0 }]),
      rejectsCode("QUIZ_ATTEMPT_INCOMPLETE"),
    );
    assert.doesNotThrow(() =>
      assertAllQuestionsAnswered(QUESTIONS, [
        { questionId: 0, selectedAnswer: 0 },
        { questionId: 1, selectedAnswer: 0 },
      ]),
    );
  });
});

describe("flashcard review status transitions", () => {
  it("progresses NEW -> LEARNING -> KNOWN with consecutive KNOWN verdicts", () => {
    assert.equal(nextFlashcardReviewStatus("NEW", "KNOWN"), "LEARNING");
    assert.equal(nextFlashcardReviewStatus("LEARNING", "KNOWN"), "KNOWN");
    assert.equal(nextFlashcardReviewStatus("KNOWN", "KNOWN"), "KNOWN");
  });

  it("degrades KNOWN back to LEARNING on an AGAIN verdict", () => {
    assert.equal(nextFlashcardReviewStatus("KNOWN", "AGAIN"), "LEARNING");
    assert.equal(nextFlashcardReviewStatus("LEARNING", "AGAIN"), "LEARNING");
    assert.equal(nextFlashcardReviewStatus("NEW", "AGAIN"), "LEARNING");
  });

  it("rejects unknown statuses and verdicts", () => {
    assert.throws(() => parseFlashcardReviewStatus("MASTERED"), { code: "INVALID_FLASHCARD_STATUS" });
    assert.throws(() => parseFlashcardVerdict("SORT_OF"), { code: "INVALID_FLASHCARD_VERDICT" });
  });
});