import { AppError } from "@/lib/errors";

// A benchmark run spends one provider generation per dataset question, and a
// campaign spends one per question per configuration combination. Both are
// driven by stored dataset contents, and a campaign's configuration arrays come
// straight from the client, so without a ceiling a single request fans out into
// an unbounded number of paid calls.

export const MAX_RUN_QUESTIONS = Number(process.env.EVALUATION_MAX_QUESTIONS) || 100;
export const MAX_CAMPAIGN_EXPERIMENTS =
  Number(process.env.EVALUATION_MAX_CAMPAIGN_EXPERIMENTS) || 24;

// Refuses an oversized run instead of silently truncating it: a partial run
// would report metrics that describe only part of the dataset.
export function assertRunQuestionCount(questionCount: number): void {
  if (questionCount > MAX_RUN_QUESTIONS) {
    throw new AppError(
      "EVALUATION_RUN_TOO_LARGE",
      `A run may process at most ${MAX_RUN_QUESTIONS} questions; this dataset has ${questionCount}`,
      413,
    );
  }
}

// The multiplication that makes a campaign expensive: configurations x questions.
export function assertCampaignExperimentCount(experimentCount: number): void {
  if (experimentCount > MAX_CAMPAIGN_EXPERIMENTS) {
    throw new AppError(
      "EVALUATION_CAMPAIGN_TOO_LARGE",
      `A campaign may evaluate at most ${MAX_CAMPAIGN_EXPERIMENTS} configurations; this one has ${experimentCount}`,
      413,
    );
  }
}