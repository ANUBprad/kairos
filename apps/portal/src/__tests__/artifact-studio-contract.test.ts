import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studioSource = readFileSync(
  new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
  "utf8",
);
const listSource = readFileSync(
  new URL("../components/app/studio/artifact-list.tsx", import.meta.url),
  "utf8",
);
const dialogSource = readFileSync(
  new URL("../components/app/studio/artifact-dialog.tsx", import.meta.url),
  "utf8",
);
const actionsSource = readFileSync(
  new URL("../lib/actions/artifacts.ts", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/studio/page.tsx", import.meta.url),
  "utf8",
);

describe("artifact studio: source selection and gating", () => {
  it("only indexed sources are selectable; others render a processing badge", () => {
    assert.match(studioSource, /const selectable = source\.status === "INDEXED";/);
    assert.match(studioSource, /disabled=\{!selectable\}/);
    assert.match(studioSource, /!selectable && <ProcessingBadge status=\{source\.status\} \/>/);
    assert.match(studioSource, /Only indexed sources can be selected\./);
  });

  it("selects can be toggled by id and cleared wholesale", () => {
    assert.match(
      studioSource,
      /prev\.includes\(id\) \? prev\.filter\(\(x\) => x !== id\) : \[\.\.\.prev, id\]/,
    );
    assert.match(studioSource, /Clear selection/);
    assert.match(studioSource, /setSelectedIds\(\[\]\)/);
  });

  it("shows an indexed/dirty count prompt instead of inventing availability", () => {
    assert.match(studioSource, /selectedCount === 0/);
    assert.match(studioSource, /No sources selected/);
    assert.match(studioSource, /source\$\{selectedCount !== 1 \? "s" : ""\} selected/);
  });

  it("shows an empty state with a sources shortcut when there are no sources", () => {
    assert.match(studioSource, /sources\.length === 0/);
    assert.match(studioSource, /No sources yet/);
    assert.match(studioSource, /Add sources before generating artifacts\./);
    assert.match(studioSource, /Go to sources/);
    assert.match(studioSource, /href=\{`\/app\/knowledge-bases\/\$\{kbId\}`\}/);
  });
});

describe("artifact studio: submission payload and orchestration", () => {
  it("maps every active studio artifact type to its O4 application action", () => {
    for (const [action, type] of [
      ["generateSummaryArtifact", "SUMMARY"],
      ["generateReportArtifact", "REPORT"],
      ["generateQuizArtifact", "QUIZ"],
      ["generateFlashcardsArtifact", "FLASHCARDS"],
      ["generateMindmapArtifact", "MINDMAP"],
      ["generateTakeawaysArtifact", "TAKEAWAYS"],
      ["generatePodcastArtifact", "PODCAST"],
    ] as const) {
      assert.match(studioSource, new RegExp(`${type}: ${action}`));
      const decl = actionsSource.slice(
        actionsSource.indexOf(`export async function ${action}(`),
        actionsSource.indexOf("}: Promise<LearningArtifactData> {", actionsSource.indexOf(`export async function ${action}(`)),
      );
      assert.match(decl, new RegExp(`artifactType: "${type}"`));
    }
  });

  it("submits kbId, selected ids and a trimmed optional name", () => {
    assert.match(
      studioSource,
      /GENERATORS\[artifactType\]\(\s*kbId,\s*selectedIds,\s*artifactName\.trim\(\) \|\| undefined,\s*\)/,
    );
  });

  it("blocks generation with no selection or while another generation is running", () => {
    assert.match(studioSource, /if \(selectedCount === 0 \|\| generating\) return;/);
    assert.match(studioSource, /disabled=\{selectedCount === 0 \|\| generating\}/);
  });

  it("prepends the completed artifact, opens its dialog, and clears the form", () => {
    assert.match(studioSource, /setArtifacts\(\(prev\) => \[\{ \.\.\.artifact, study: null \}, \.\.\.prev\]\)/);
    assert.match(studioSource, /setOpenArtifactId\(artifact\.id\)/);
    assert.match(studioSource, /setSelectedIds\(\[\]\)/);
    assert.match(studioSource, /setArtifactName\(""\)/);
  });

  it("a failed generation surfaces the error and leaves the source list untouched", () => {
    assert.match(studioSource, /catch \(err\) \{/);
    assert.match(studioSource, /setError\(err instanceof Error \? err\.message : "Artifact generation failed"\)/);
  });
});

describe("artifact studio: duplicate-submit protection", () => {
  it("guards regenerate while another regeneration is in flight or the artifact is not terminal", () => {
    assert.match(
      studioSource,
      /if \(regeneratingId \|\| artifact\.status === "PENDING" \|\| artifact\.status === "PROCESSING"\) return;/,
    );
  });

  it("disables the regenerate and delete affordances of a busy artifact", () => {
    assert.match(listSource, /const busy = regeneratingId === artifact\.id;/);
    assert.match(listSource, /disabled=\{busy\}/g);
    assert.match(listSource, /\{busy \? "Regenerating…" : "Regenerate"\}/);
  });

  it("guards delete confirmation while a delete is in flight", () => {
    assert.match(studioSource, /if \(!pendingDelete \|\| deleting\) return;/);
    assert.match(studioSource, /isLoading=\{deleting\}/);
  });

  it("prevents regen/delete/recover on non-terminal states at the affordance level", () => {
    assert.match(listSource, /const isTerminal = \(status/);
    assert.match(listSource, /status === "COMPLETED" \|\| status === "FAILED"/);
    assert.match(listSource, /terminal && onRegenerate/);
    assert.match(listSource, /terminal && onDelete/);
    assert.match(listSource, /isStaleProcessing\(artifact\) && onRecover/);
    assert.match(listSource, /ARTIFACT_STALE_PROCESSING_MS/);
  });

  it("offers a Recover affordance only for stale PROCESSING artifacts", () => {
    assert.match(
      listSource,
      /artifact\.status === "PROCESSING" &&\s*Date\.now\(\) - new Date\(artifact\.updatedAt\)\.getTime\(\) > ARTIFACT_STALE_PROCESSING_MS/,
    );
  });
});

describe("artifact studio: loading and error states", () => {
  it("shows a spinner and disables the generator while generating", () => {
    assert.match(studioSource, /Loader2 size=\{14\} className="animate-spin"/);
    assert.match(studioSource, /generating \? "Generating…" : `Generate \$\{typeMeta\.label\}`/);
    assert.match(studioSource, /disabled=\{generating\}/);
  });

  it("renders generate failures as an alert region that is cleared on retry", () => {
    assert.match(studioSource, /role="alert"/);
    assert.match(studioSource, /setError\(null\)/);
  });

  it("renders action-level failures (regen/delete/recover) as a separate alert region", () => {
    assert.match(studioSource, /actionError &&/);
    assert.match(studioSource, /setActionError\(err instanceof Error \? err\.message : "Artifact regeneration failed"\)/);
    assert.match(studioSource, /setActionError\(err instanceof Error \? err\.message : "Artifact deletion failed"\)/);
    assert.match(studioSource, /setActionError\(err instanceof Error \? err\.message : "Recovery failed"\)/);
  });
});

describe("artifact studio: result and deep-link behavior", () => {
  it("opens the freshly generated or regenerated artifact in the dialog", () => {
    assert.match(studioSource, /setOpenArtifactId\(artifact\.id\)/);
    assert.match(studioSource, /setOpenArtifactId\(next\.id\)/);
  });

  it("the dialog fetches through the workspace action and never through prisma", () => {
    assert.match(dialogSource, /getLearningArtifactForWorkspace\(kbId, artifactId\)/);
    assert.doesNotMatch(dialogSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(dialogSource, /generateLearningArtifact|getAIProvider|generateChat/);
  });

  it("deep-links completed artifacts to their detail page and nothing else", () => {
    assert.match(
      listSource,
      /href=\{`\/app\/knowledge-bases\/\$\{kbId\}\/artifacts\/\$\{artifact\.id\}`\}/,
    );
    assert.match(listSource, /artifact\.status === "COMPLETED" &&/);
    assert.match(listSource, /aria-label=\{`Open \$\{artifact\.name \|\| "artifact"\}`\}/);
  });

  it("regenerates by id so the restored scope stays server-side", () => {
    assert.match(studioSource, /regenerateLearningArtifactForWorkspace\(kbId, artifact\.id\)/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact\(/);
  });

  it("deletes by id through the workspace action", () => {
    assert.match(studioSource, /deleteLearningArtifactForWorkspace\(kbId, pendingDelete\.id\)/);
    assert.match(studioSource, /setArtifacts\(\(prev\) => prev\.filter\(\(a\) => a\.id !== pendingDelete\.id\)\)/);
  });
});

describe("artifact studio: data-flow boundaries", () => {
  it("the studio page hands the server projection to the client component only", () => {
    assert.match(pageSource, /listDocuments\(kbId\)/);
    assert.match(pageSource, /listLearningArtifactsForWorkspace\(kbId\)/);
    assert.match(pageSource, /ArtifactStudio/);
    assert.doesNotMatch(pageSource, /useState|"use client"/);
  });

  it("the studio talks to engine-adjacent persistence only through the O4 actions", () => {
    assert.doesNotMatch(studioSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact\(|getAIProvider|generateChat/);
    assert.match(actionsSource, /generateLearningArtifact\(/);
    assert.match(actionsSource, /name,\s*\}\)/);
  });
});