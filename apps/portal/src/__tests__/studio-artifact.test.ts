import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARTIFACT_STATUS_META,
  parseSummaryContent,
  resolveSourceProvenance,
} from "@/lib/artifacts/summary-view";
import { parseReportContent } from "@/lib/artifacts/report-view";
import { parseQuizContent } from "@/lib/artifacts/quiz-view";
import {
  ACTIVE_STUDIO_ARTIFACT_TYPES,
  ARTIFACT_TYPE_META,
  isActiveStudioArtifactType,
} from "@/components/app/studio/artifact-type-meta";

describe("summary content view", () => {
  it("parses a valid stored SUMMARY payload", () => {
    const content = {
      title: "Quantum Computing",
      overview: "A survey of qubits.",
      keyPoints: ["Qubits", "Entanglement"],
    };
    assert.deepEqual(parseSummaryContent(content), {
      title: "Quantum Computing",
      overview: "A survey of qubits.",
      keyPoints: ["Qubits", "Entanglement"],
    });
  });

  it("returns null for malformed content (missing keys)", () => {
    assert.equal(parseSummaryContent({ title: "Only a title" }), null);
  });

  it("returns null for empty key points and empty overview", () => {
    assert.equal(parseSummaryContent({ title: "T", overview: "", keyPoints: ["a"] }), null);
    assert.equal(parseSummaryContent({ title: "T", overview: "o", keyPoints: [] }), null);
  });

  it("returns null for unknown stored shapes and strict-invalid extra keys", () => {
    assert.equal(parseSummaryContent(null), null);
    assert.equal(parseSummaryContent("not json"), null);
    assert.equal(
      parseSummaryContent({ title: "T", overview: "o", keyPoints: ["a"], internal: "x" }),
      null,
    );
  });
});

describe("report content view", () => {
  const content = {
    title: "Qubit Survey",
    executiveSummary: "A survey of qubit technologies.",
    sections: [{ heading: "Mechanism", content: "Qubits use superposition." }],
    keyFindings: ["Noise is the core challenge"],
  };

  it("parses a valid stored REPORT payload", () => {
    assert.deepEqual(parseReportContent(content), content);
  });

  it("returns null for malformed content (missing fields or bad shape)", () => {
    assert.equal(parseReportContent({ title: "Only a title" }), null);
    assert.equal(parseReportContent({ ...content, sections: [] }), null);
    assert.equal(parseReportContent("not json"), null);
  });

  it("returns null for strict-invalid extra keys", () => {
    assert.equal(
      parseReportContent({ ...content, footnotes: ["x"] }),
      null,
    );
  });
});

describe("quiz content view", () => {
  const content = {
    title: "Qubit Quiz",
    instructions: "Pick the single best answer.",
    questions: [
      {
        question: "What is a qubit?",
        options: ["A quantum bit", "A classical bit"],
        correctAnswer: 0,
        explanation: "A qubit is the quantum analogue of a bit.",
      },
    ],
  };

  it("parses a valid stored QUIZ payload", () => {
    assert.deepEqual(parseQuizContent(content), content);
  });

  it("returns null for malformed content (out-of-range answer or missing field)", () => {
    assert.equal(parseQuizContent({ title: "Only a title" }), null);
    assert.equal(
      parseQuizContent({
        ...content,
        questions: [{ ...content.questions[0], correctAnswer: 7 }],
      }),
      null,
    );
    assert.equal(parseQuizContent("not json"), null);
  });

  it("returns null for strict-invalid extra keys", () => {
    assert.equal(
      parseQuizContent({ ...content, difficulty: "hard" }),
      null,
    );
  });
});

describe("source provenance", () => {
  const sources = [
    { id: "doc_a", name: "paper.pdf" },
    { id: "doc_b", name: null },
  ];

  it("resolves persisted source ids to names, preserving order", () => {
    assert.deepEqual(resolveSourceProvenance(["doc_a", "doc_b"], sources), [
      { id: "doc_a", name: "paper.pdf" },
      { id: "doc_b", name: "doc_b" },
    ]);
  });

  it("falls back to the id for sources without a known name (no invented metadata)", () => {
    assert.deepEqual(resolveSourceProvenance(["doc_a", "unknown_doc"], sources), [
      { id: "doc_a", name: "paper.pdf" },
      { id: "unknown_doc", name: "unknown_doc" },
    ]);
  });
});

describe("artifact status meta", () => {
  it("describes exactly the four supported statuses", () => {
    assert.deepEqual(Object.keys(ARTIFACT_STATUS_META).sort(), [
      "COMPLETED",
      "FAILED",
      "PENDING",
      "PROCESSING",
    ]);
  });

  it("exposes safe display labels and render kinds", () => {
    assert.equal(ARTIFACT_STATUS_META.PENDING.label, "Pending");
    assert.equal(ARTIFACT_STATUS_META.PENDING.kind, "pending");
    assert.equal(ARTIFACT_STATUS_META.PROCESSING.kind, "processing");
    assert.equal(ARTIFACT_STATUS_META.COMPLETED.label, "Completed");
    assert.equal(ARTIFACT_STATUS_META.COMPLETED.kind, "completed");
    assert.equal(ARTIFACT_STATUS_META.FAILED.label, "Failed");
    assert.equal(ARTIFACT_STATUS_META.FAILED.kind, "failed");
  });
});

describe("artifact type presentation meta", () => {
  it("lists exactly the three studio-supported artifact types (no ghost entries)", () => {
    assert.deepEqual(ACTIVE_STUDIO_ARTIFACT_TYPES, ["SUMMARY", "REPORT", "QUIZ"]);
  });

  it("every active type has a label, description and icon", () => {
    for (const type of ACTIVE_STUDIO_ARTIFACT_TYPES) {
      const meta = ARTIFACT_TYPE_META[type];
      assert.ok(meta.label.length > 0);
      assert.ok(meta.description.length > 0);
      assert.ok(meta.Icon);
    }
  });

  it("narrows only the active types and rejects the unimplemented ones", () => {
    assert.equal(isActiveStudioArtifactType("SUMMARY"), true);
    assert.equal(isActiveStudioArtifactType("REPORT"), true);
    assert.equal(isActiveStudioArtifactType("QUIZ"), true);
    assert.equal(isActiveStudioArtifactType("FLASHCARDS"), false);
    assert.equal(isActiveStudioArtifactType("MINDMAP"), false);
    assert.equal(isActiveStudioArtifactType("TAKEAWAYS"), false);
    assert.equal(isActiveStudioArtifactType("PODCAST"), false);
  });
});

describe("studio wiring", () => {
  const studioSource = readFileSync(
    new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../app/app/knowledge-bases/[kbId]/studio/page.tsx", import.meta.url),
    "utf8",
  );
  const dialogSource = readFileSync(
    new URL("../components/app/studio/artifact-dialog.tsx", import.meta.url),
    "utf8",
  );
  const summaryViewerSource = readFileSync(
    new URL("../components/app/studio/summary-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );
  const reportViewerSource = readFileSync(
    new URL("../components/app/studio/report-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );
  const quizViewerSource = readFileSync(
    new URL("../components/app/studio/quiz-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );

  it("generates through the O4-T3/O4-T5 application actions, never the engine or database directly", () => {
    assert.match(studioSource, /generateSummaryArtifact/);
    assert.match(studioSource, /generateReportArtifact/);
    assert.match(studioSource, /generateQuizArtifact/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact|getAIProvider|generateChat/);
    assert.doesNotMatch(studioSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(studioSource, /from ["']openai["']/);
  });

  it("exposes exactly three active artifact types in the selector, never the unimplemented ones", () => {
    assert.doesNotMatch(studioSource, /FLASHCARDS|MINDMAP|TAKEAWAYS|PODCAST/);
    assert.match(studioSource, /ACTIVE_STUDIO_ARTIFACT_TYPES/);
    assert.match(studioSource, /Generate \$\{typeMeta\.label\}/);
  });

  it("lists artifacts through the O4-T3 workspace action without a client-side type split", () => {
    assert.match(pageSource, /listLearningArtifactsForWorkspace/);
    assert.doesNotMatch(pageSource, /type: "SUMMARY"/);
  });

  it("opens artifacts through the O4-T3 read action and routes to a type-specific viewer", () => {
    assert.match(dialogSource, /getLearningArtifactForWorkspace/);
    assert.match(dialogSource, /SummaryArtifactViewer/);
    assert.match(dialogSource, /ReportArtifactViewer/);
    assert.match(dialogSource, /QuizArtifactViewer/);
    assert.doesNotMatch(dialogSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(dialogSource, /generateLearningArtifact|getAIProvider|generateChat/);
  });

  it("renders summary content strictly through the view helpers (no crashing on legacy data)", () => {
    assert.match(summaryViewerSource, /parseSummaryContent/);
    assert.match(summaryViewerSource, /resolveSourceProvenance/);
    assert.doesNotMatch(summaryViewerSource, /from ["']@\/lib\/actions\//);
  });

  it("renders report content through the view helpers with provenance and no action access", () => {
    assert.match(reportViewerSource, /parseReportContent/);
    assert.match(reportViewerSource, /resolveSourceProvenance/);
    assert.doesNotMatch(reportViewerSource, /from ["']@\/lib\/actions\//);
  });

  it("keeps the quiz interaction local: client state only, no persistence or server access", () => {
    assert.match(quizViewerSource, /"use client"/);
    assert.match(quizViewerSource, /useState/);
    assert.match(quizViewerSource, /parseQuizContent/);
    assert.doesNotMatch(quizViewerSource, /from ["']@\/lib\/actions\//);
    assert.doesNotMatch(quizViewerSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(quizViewerSource, /from ["']@\/lib\/artifacts\/persistence["']/);
    assert.doesNotMatch(quizViewerSource, /generateQuizArtifact|getLearningArtifactForWorkspace|createLearningArtifact/);
  });

  it("reuses the source library contract from the existing server action", () => {
    assert.match(pageSource, /listDocuments/);
    assert.match(studioSource, /SourceListItem/);
  });

  it("renders only through the Studio panel and guards against missing knowledge bases", () => {
    assert.match(pageSource, /ArtifactStudio/);
    assert.match(pageSource, /redirect\("\/app"\)/);
  });
});

describe("unsupported artifact types", () => {
  it("cannot be generated: no unimplemented type appears as an option or action anywhere", () => {
    const studioSource = readFileSync(
      new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
      "utf8",
    );
    const dialogSource = readFileSync(
      new URL("../components/app/studio/artifact-dialog.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(studioSource, /FLASHCARDS|MINDMAP|TAKEAWAYS|PODCAST/);
    assert.doesNotMatch(dialogSource, /FLASHCARDS|MINDMAP|TAKEAWAYS|PODCAST/);
  });
});