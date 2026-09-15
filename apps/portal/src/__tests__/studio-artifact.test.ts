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
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import { parseMindmapContent } from "@/lib/artifacts/mindmap-view";
import { parseTakeawaysContent } from "@/lib/artifacts/takeaways-view";
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

describe("flashcards content view", () => {
  const content = {
    title: "Qubit Deck",
    cards: [
      { front: "What is a qubit?", back: "The quantum analogue of a bit." },
      { front: "What does superposition mean?", back: "A qubit is a mix of states until measured." },
    ],
  };

  it("parses a valid stored FLASHCARDS payload", () => {
    assert.deepEqual(parseFlashcardsContent(content), content);
  });

  it("returns null for malformed content (missing fields or empty deck)", () => {
    assert.equal(parseFlashcardsContent({ title: "Only a title" }), null);
    assert.equal(parseFlashcardsContent({ ...content, cards: [] }), null);
    assert.equal(parseFlashcardsContent("not json"), null);
  });

  it("returns null for strict-invalid extra keys", () => {
    assert.equal(parseFlashcardsContent({ ...content, tags: ["x"] }), null);
  });
});

describe("mindmap content view", () => {
  const content = {
    title: "Qubit Concepts",
    root: {
      label: "Quantum Computing",
      description: "Computing with qubits.",
      children: [{ label: "Superposition", description: "Mixed states" }, { label: "Entanglement" }],
    },
  };

  it("parses a valid stored MINDMAP payload", () => {
    assert.deepEqual(parseMindmapContent(content), content);
  });

  it("returns null for malformed content (missing root or bad recursion)", () => {
    assert.equal(parseMindmapContent({ title: "Only a title" }), null);
    assert.equal(parseMindmapContent({ title: "T", root: {} }), null);
    assert.equal(parseMindmapContent("not json"), null);
  });

  it("returns null for strict-invalid extra keys", () => {
    assert.equal(parseMindmapContent({ ...content, style: {} }), null);
  });
});

describe("takeaways content view", () => {
  const content = {
    title: "Qubit Essentials",
    takeaways: [
      { heading: "Superposition", detail: "A qubit holds a mix of states." },
      { heading: "Entanglement", detail: "Qubits can be correlated across distance." },
    ],
  };

  it("parses a valid stored TAKEAWAYS payload", () => {
    assert.deepEqual(parseTakeawaysContent(content), content);
  });

  it("returns null for malformed content (missing fields or empty list)", () => {
    assert.equal(parseTakeawaysContent({ title: "Only a title" }), null);
    assert.equal(parseTakeawaysContent({ ...content, takeaways: [] }), null);
    assert.equal(parseTakeawaysContent("not json"), null);
  });

  it("returns null for strict-invalid extra keys", () => {
    assert.equal(parseTakeawaysContent({ ...content, summary: "x" }), null);
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
  it("lists exactly the seven studio-supported artifact types (no ghost entries)", () => {
    assert.deepEqual(ACTIVE_STUDIO_ARTIFACT_TYPES, [
      "SUMMARY",
      "REPORT",
      "QUIZ",
      "FLASHCARDS",
      "MINDMAP",
      "TAKEAWAYS",
      "PODCAST",
    ]);
  });

  it("every active type has a label, description and icon", () => {
    for (const type of ACTIVE_STUDIO_ARTIFACT_TYPES) {
      const meta = ARTIFACT_TYPE_META[type];
      assert.ok(meta.label.length > 0);
      assert.ok(meta.description.length > 0);
      assert.ok(meta.Icon);
    }
  });

  it("narrows exactly the active types, including PODCAST as the seventh", () => {
    assert.equal(isActiveStudioArtifactType("SUMMARY"), true);
    assert.equal(isActiveStudioArtifactType("REPORT"), true);
    assert.equal(isActiveStudioArtifactType("QUIZ"), true);
    assert.equal(isActiveStudioArtifactType("FLASHCARDS"), true);
    assert.equal(isActiveStudioArtifactType("MINDMAP"), true);
    assert.equal(isActiveStudioArtifactType("TAKEAWAYS"), true);
    assert.equal(isActiveStudioArtifactType("PODCAST"), true);
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
  const flashcardsViewerSource = readFileSync(
    new URL("../components/app/studio/flashcards-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );
  const mindmapViewerSource = readFileSync(
    new URL("../components/app/studio/mindmap-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );
  const takeawaysViewerSource = readFileSync(
    new URL("../components/app/studio/takeaways-artifact-viewer.tsx", import.meta.url),
    "utf8",
  );

  it("generates through the O4 application actions, never the engine or database directly", () => {
    assert.match(studioSource, /generateSummaryArtifact/);
    assert.match(studioSource, /generateReportArtifact/);
    assert.match(studioSource, /generateQuizArtifact/);
    assert.match(studioSource, /generateFlashcardsArtifact/);
    assert.match(studioSource, /generateMindmapArtifact/);
    assert.match(studioSource, /generateTakeawaysArtifact/);
    assert.match(studioSource, /generatePodcastArtifact/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact\(|getAIProvider|generateChat/);
    assert.doesNotMatch(studioSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(studioSource, /from ["']openai["']/);
  });

  it("exposes the seven active artifact types through the shared selector and meta", () => {
    assert.match(studioSource, /ACTIVE_STUDIO_ARTIFACT_TYPES/);
    assert.match(studioSource, /Generate \$\{typeMeta\.label\}/);
    assert.match(studioSource, /PODCAST/);
  });

  it("lists artifacts through the O4-T3 workspace action without a client-side type split", () => {
    assert.match(pageSource, /listLearningArtifactsForWorkspace/);
    assert.doesNotMatch(pageSource, /type: "SUMMARY"/);
  });

  it("opens artifacts through the O4-T3 read action and routes to the shared viewer", () => {
    const contentType = (name: string) =>
      readFileSync(
        new URL(`../components/app/studio/artifact-${name}.tsx`, import.meta.url),
        "utf8",
      );
    const contentSource = contentType("content");
    assert.match(dialogSource, /getLearningArtifactForWorkspace/);
    assert.match(dialogSource, /ArtifactContent/);
    assert.match(contentSource, /SummaryArtifactViewer/);
    assert.match(contentSource, /ReportArtifactViewer/);
    assert.match(contentSource, /QuizArtifactViewer/);
    assert.match(contentSource, /FlashcardsArtifactViewer/);
    assert.match(contentSource, /MindmapArtifactViewer/);
    assert.match(contentSource, /TakeawaysArtifactViewer/);
    assert.match(contentSource, /PodcastArtifactViewer/);
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

  it("persists quiz attempts through the study actions while grading stays server-side", () => {
    assert.match(quizViewerSource, /"use client"/);
    assert.match(quizViewerSource, /useState/);
    assert.match(quizViewerSource, /parseQuizContent/);
    assert.match(quizViewerSource, /from ["']@\/lib\/actions\/study-quiz["']/);
    assert.match(quizViewerSource, /startQuizAttemptForWorkspace/);
    assert.match(quizViewerSource, /submitQuizAttemptForWorkspace/);
    assert.match(quizViewerSource, /getQuizAttemptForWorkspace/);
    assert.doesNotMatch(quizViewerSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(quizViewerSource, /from ["']@\/lib\/artifacts\/persistence["']/);
    assert.doesNotMatch(quizViewerSource, /generateQuizArtifact|getLearningArtifactForWorkspace|createLearningArtifact/);
  });

  it("reuses the source library contract from the existing server action", () => {
    assert.match(pageSource, /listDocuments/);
    assert.match(studioSource, /SourceListItem/);
  });

  it("performs soft-swipe flashcards client-side while reviews persist through the study actions", () => {
    assert.match(flashcardsViewerSource, /"use client"/);
    assert.match(flashcardsViewerSource, /useState/);
    assert.match(flashcardsViewerSource, /parseFlashcardsContent/);
    assert.match(flashcardsViewerSource, /getFlashcardReviewsForWorkspace/);
    assert.match(flashcardsViewerSource, /markFlashcardReviewForWorkspace/);
    assert.match(flashcardsViewerSource, /setIndex|setRevealed/);
    assert.doesNotMatch(flashcardsViewerSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(flashcardsViewerSource, /generateFlashcardsArtifact|getLearningArtifactForWorkspace/);
  });

  it("renders the mind map as a nested hierarchy without a graph engine", () => {
    assert.match(mindmapViewerSource, /"use client"/);
    assert.match(mindmapViewerSource, /parseMindmapContent/);
    assert.match(mindmapViewerSource, /MindMapNodeTree/);
    assert.doesNotMatch(mindmapViewerSource, /@xyflow|reactflow|mermaid|d3/);
    assert.doesNotMatch(mindmapViewerSource, /from ["']@\/lib\/actions\//);
  });

  it("renders takeaways through the view helpers with provenance and no action access", () => {
    assert.match(takeawaysViewerSource, /parseTakeawaysContent/);
    assert.match(takeawaysViewerSource, /resolveSourceProvenance/);
    assert.doesNotMatch(takeawaysViewerSource, /from ["']@\/lib\/actions\//);
  });

  it("renders podcast media through the native audio player with a same-origin source", () => {
    const podcastViewerSource = readFileSync(
      new URL("../components/app/studio/podcast-artifact-viewer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(podcastViewerSource, /"use client"/);
    assert.match(podcastViewerSource, /parsePodcastContent/);
    assert.match(podcastViewerSource, /parsePodcastAudioMetadata/);
    assert.match(podcastViewerSource, /<audio[\s\S]*preload="none"/);
    assert.match(podcastViewerSource, /`\/api\/artifacts\/\$\{artifact\.id\}\/audio`/);
    assert.match(podcastViewerSource, /PODCAST_HOST_PERSONAS/);
    assert.doesNotMatch(podcastViewerSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(podcastViewerSource, /from ["']@\/lib\/artifacts\/persistence["']/);
  });

  it("links podcast sources back to the knowledge base like the quiz and flashcard viewers", () => {
    const podcastViewerSource = readFileSync(
      new URL("../components/app/studio/podcast-artifact-viewer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(podcastViewerSource, /Revisit the sources behind this podcast/);
    assert.match(podcastViewerSource, /availableSourceIds/);
    assert.match(
      podcastViewerSource,
      /href=\{`\/app\/knowledge-bases\/\$\{artifact\.knowledgeBaseId\}\/\$\{ref\.id\}`\}/,
    );
    assert.match(podcastViewerSource, /Unavailable source/);
    assert.doesNotMatch(podcastViewerSource, /<h4[\s\S]*>\s*Sources\s*<\/h4>/);
  });

  it("grounds questions exclusively in the podcast interrupt action and resumes the episode from its stored position", () => {
    const podcastViewerSource = readFileSync(
      new URL("../components/app/studio/podcast-artifact-viewer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(podcastViewerSource, /from ["']@\/lib\/actions\/podcast-interrupt["']/);
    assert.match(podcastViewerSource, /askPodcastInterruption/);
    assert.match(podcastViewerSource, /parseClientInterruptions/);
    assert.match(podcastViewerSource, /audio\/interruption\/\$\{interruptionId\}/);
    assert.match(podcastViewerSource, /startInterruption/);
    assert.match(podcastViewerSource, /endInterruptionPlayback/);
    assert.match(podcastViewerSource, /wasPlaying: !el\.paused/);
    assert.match(podcastViewerSource, /intent\.resume/);
    assert.doesNotMatch(podcastViewerSource, /from ["']@\/lib\/actions\/artifacts["']|from ["']@\/lib\/actions\/["']/);
    assert.doesNotMatch(podcastViewerSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(podcastViewerSource, /getAIProvider|generateChat|getTTSProvider|generatePodcastAudio/);
    assert.doesNotMatch(
      podcastViewerSource,
      /storage\.ownerType|from ["']@\/lib\/storage["']|from ["']@\/lib\/artifacts\/persistence["']/,
    );
  });

  it("renders only through the Studio panel and guards against missing knowledge bases", () => {
    assert.match(pageSource, /ArtifactStudio/);
    assert.match(pageSource, /redirect\("\/app"\)/);
  });
});

describe("podcast artifact support", () => {
  it("is generated, advertised and viewable end to end", () => {
    const studioSource = readFileSync(
      new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
      "utf8",
    );
    const dialogSource = readFileSync(
      new URL("../components/app/studio/artifact-dialog.tsx", import.meta.url),
      "utf8",
    );
    const contentSource = readFileSync(
      new URL("../components/app/studio/artifact-content.tsx", import.meta.url),
      "utf8",
    );
    const actionsSource = readFileSync(
      new URL("../lib/actions/artifacts.ts", import.meta.url),
      "utf8",
    );
    const metaSource = readFileSync(
      new URL("../components/app/studio/artifact-type-meta.tsx", import.meta.url),
      "utf8",
    );
    assert.match(studioSource, /generatePodcastArtifact/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact\(|getAIProvider|generateChat/);
    assert.match(dialogSource, /ArtifactContent/);
    assert.match(contentSource, /PodcastArtifactViewer/);
    assert.match(actionsSource, /generatePodcastArtifact[\s\S]*artifactType: "PODCAST"/);
    assert.match(metaSource, /PODCAST[\s\S]*label: "Podcast"/);
  });
});