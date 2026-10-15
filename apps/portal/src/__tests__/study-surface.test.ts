import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const quizViewer = source("../components/app/studio/quiz-artifact-viewer.tsx");
const flashcardsViewer = source("../components/app/studio/flashcards-artifact-viewer.tsx");
const dashboard = source("../components/app/study/study-dashboard.tsx");
const studyHub = source("../app/app/study/page.tsx");
const studyLoading = source("../app/app/knowledge-bases/[kbId]/study/loading.tsx");

describe("study surface experience", () => {
  it("keeps parsed content out of the effect dependency loop", () => {
    // parseQuizContent/parseFlashcardsContent return a fresh object each call, so
    // passing the raw result into the load effect would re-run it every render.
    assert.match(
      quizViewer,
      /useMemo\(\(\) => parseQuizContent\(artifact\.content\), \[artifact\.content\]\)/,
    );
    assert.match(
      flashcardsViewer,
      /useMemo\(\(\) => parseFlashcardsContent\(artifact\.content\), \[artifact\.content\]\)/,
    );
  });

  it("exposes the quiz as an accessible, gated radiogroup", () => {
    assert.match(quizViewer, /role="radiogroup"/);
    assert.match(quizViewer, /role="radio"/);
    assert.match(quizViewer, /aria-checked=\{isSelected\}/);
    assert.match(quizViewer, /disabled=\{!allAnswered \|\| submitting\}/);
  });

  it("gives flashcards keyboard paging, a progress bar and honest verdict gating", () => {
    assert.match(flashcardsViewer, /ArrowRight/);
    assert.match(flashcardsViewer, /ArrowLeft/);
    assert.match(flashcardsViewer, /tabIndex=\{0\}/);
    assert.match(flashcardsViewer, /role="progressbar"/);
    // Do not allow a verdict before review rows load: an in-flight load could
    // otherwise clobber a just-persisted mark.
    assert.match(flashcardsViewer, /disabled=\{busy \|\| !reviewsReady\}/);
  });

  it("renders the dashboard as a shared-header editorial surface", () => {
    assert.match(dashboard, /WorkspaceHeader/);
    assert.match(dashboard, /studyArtifactHref\(/);
    assert.match(dashboard, /divide-y divide-border/);
    assert.match(dashboard, /Open Studio/);
  });

  it("routes the cross-workspace hub study sets into each workspace", () => {
    assert.match(studyHub, /kbWorkspaceHref\(kb\.id, "study"\)/);
    assert.doesNotMatch(studyHub, /from "@\/components\/ui\/card"/);
  });

  it("ships a loading skeleton for the study route", () => {
    assert.match(studyLoading, /animate-pulse/);
  });
});
