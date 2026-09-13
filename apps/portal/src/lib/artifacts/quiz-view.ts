import { quizArtifactSchema } from "./quiz";

// Typed window into a stored QUIZ payload. The O4-T5 schema is the single
// source of truth; this only guards rendering against malformed or legacy
// content so the viewer never crashes on stored data.
export interface QuizViewContent {
  title: string;
  instructions: string;
  questions: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }[];
}

export function parseQuizContent(content: unknown): QuizViewContent | null {
  const parsed = quizArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}