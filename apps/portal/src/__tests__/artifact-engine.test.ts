import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveArtifactDefinition,
  listRegisteredArtifactTypes,
  summaryArtifactSchema,
  reportArtifactSchema,
  quizArtifactSchema,
  flashcardsArtifactSchema,
  mindmapArtifactSchema,
  mindmapNodeSchema,
  takeawaysArtifactSchema,
  extractJsonObject,
  parseStructuredOutput,
  buildBoundedContext,
  assertNonEmptySourceScope,
  assertSourcesOwned,
  buildArtifactTraceMetadata,
  toLearningArtifactData,
  type ArtifactSourceChunk,
  type LearningArtifactRow,
} from "@/lib/artifacts";

const validSummary = {
  title: "Photosynthesis",
  overview: "Plants convert sunlight into chemical energy.",
  keyPoints: ["Chlorophyll absorbs light", "Oxygen is released"],
};

const validReport = {
  title: "Photosynthesis Overview",
  executiveSummary: "A survey of how plants convert sunlight into chemical energy.",
  sections: [
    {
      heading: "Mechanism",
      content: "Chlorophyll absorbs light and drives the light-dependent reactions.",
    },
  ],
  keyFindings: ["Chlorophyll absorbs light", "Oxygen is released"],
};

describe("artifact definition registry", () => {
  it("registers the supported artifact types (no ghost implementations beyond them)", () => {
    assert.deepEqual(listRegisteredArtifactTypes(), [
      "SUMMARY",
      "REPORT",
      "QUIZ",
      "FLASHCARDS",
      "MINDMAP",
      "TAKEAWAYS",
      "PODCAST",
    ]);
  });

  it("resolves the SUMMARY definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("SUMMARY");
    assert.equal(def.type, "SUMMARY");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "summary-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
  });

  it("resolves the REPORT definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("REPORT");
    assert.equal(def.type, "REPORT");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "report-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });

  it("rejects generation for types without a registered definition", () => {
    assert.throws(() => resolveArtifactDefinition("UNKNOWN" as never), {
      code: "UNSUPPORTED_ARTIFACT_TYPE",
    });
  });

  it("resolves the PODCAST definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("PODCAST");
    assert.equal(def.type, "PODCAST");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "podcast-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });

  it("resolves the QUIZ definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("QUIZ");
    assert.equal(def.type, "QUIZ");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "quiz-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });

  it("resolves the FLASHCARDS definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("FLASHCARDS");
    assert.equal(def.type, "FLASHCARDS");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "flashcards-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });

  it("resolves the MINDMAP definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("MINDMAP");
    assert.equal(def.type, "MINDMAP");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "mindmap-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });

  it("resolves the TAKEAWAYS definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("TAKEAWAYS");
    assert.equal(def.type, "TAKEAWAYS");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "takeaways-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
    assert.equal(def.buildUserPrompt("context").includes("context"), true);
  });
});

describe("summary output schema", () => {
  it("accepts a valid summary payload", () => {
    const result = summaryArtifactSchema.safeParse(validSummary);
    assert.deepEqual(result.success ? result.data : null, validSummary);
  });

  it("rejects a payload missing required keys", () => {
    assert.equal(summaryArtifactSchema.safeParse({ title: "X", overview: "Y" }).success, false);
  });

  it("rejects empty overview and empty keyPoints", () => {
    assert.equal(summaryArtifactSchema.safeParse({ ...validSummary, overview: "" }).success, false);
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, keyPoints: [] }).success,
      false,
    );
  });

  it("rejects non-string titles and non-string key points", () => {
    assert.equal(summaryArtifactSchema.safeParse({ ...validSummary, title: 42 }).success, false);
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, keyPoints: [1, 2] }).success,
      false,
    );
  });

  it("strictly rejects unknown extra keys", () => {
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, fceExtras: true }).success,
      false,
    );
  });
});

describe("report output schema", () => {
  it("accepts a valid report payload", () => {
    const result = reportArtifactSchema.safeParse(validReport);
    assert.deepEqual(result.success ? result.data : null, validReport);
  });

  it("rejects a payload missing required keys", () => {
    assert.equal(reportArtifactSchema.safeParse({ title: "X", keyFindings: ["K"] }).success, false);
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, executiveSummary: undefined }).success,
      false,
    );
  });

  it("rejects empty sections, empty findings and empty executive summary", () => {
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, sections: [] }).success,
      false,
    );
    assert.equal(reportArtifactSchema.safeParse({ ...validReport, keyFindings: [] }).success, false);
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, executiveSummary: "" }).success,
      false,
    );
  });

  it("rejects unbounded structures (excessive sections or findings)", () => {
    const manySections = {
      ...validReport,
      sections: Array.from({ length: 13 }, (_, i) => ({ heading: `H${i}`, content: "C" })),
    };
    assert.equal(reportArtifactSchema.safeParse(manySections).success, false);

    const manyFindings = {
      ...validReport,
      keyFindings: Array.from({ length: 21 }, (_, i) => `Finding ${i}`),
    };
    assert.equal(reportArtifactSchema.safeParse(manyFindings).success, false);
  });

  it("rejects oversize strings (runaway title or section heading)", () => {
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, title: "x".repeat(201) }).success,
      false,
    );
    assert.equal(
      reportArtifactSchema.safeParse({
        ...validReport,
        sections: [{ heading: "h".repeat(201), content: "C" }],
      }).success,
      false,
    );
  });

  it("rejects non-string content and non-object section entries", () => {
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, executiveSummary: 42 }).success,
      false,
    );
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, sections: [{ heading: "H", content: 7 }] })
        .success,
      false,
    );
  });

  it("strictly rejects unknown extra keys in the report and its sections", () => {
    assert.equal(
      reportArtifactSchema.safeParse({ ...validReport, footnotes: [] }).success,
      false,
    );
    assert.equal(
      reportArtifactSchema.safeParse({
        ...validReport,
        sections: [{ heading: "H", content: "C", citations: [] }],
      }).success,
      false,
    );
  });
});

describe("quiz output schema", () => {
  const validQuestion = {
    question: "What drives photosynthesis?",
    options: ["Light", "Sound", "Gravity", "Wind"],
    correctAnswer: 0,
    explanation: "Chlorophyll absorbs light energy in the light-dependent reactions.",
  };

  const validQuiz = {
    title: "Photosynthesis Quiz",
    instructions: "Pick the single best answer for each question.",
    questions: [validQuestion],
  };

  it("accepts a valid quiz payload", () => {
    const result = quizArtifactSchema.safeParse(validQuiz);
    assert.deepEqual(result.success ? result.data : null, validQuiz);
  });

  it("rejects a payload missing required fields (title, instructions, questions)", () => {
    assert.equal(quizArtifactSchema.safeParse({ questions: [validQuestion] }).success, false);
    assert.equal(
      quizArtifactSchema.safeParse({ ...validQuiz, instructions: undefined }).success,
      false,
    );
    assert.equal(quizArtifactSchema.safeParse({ ...validQuiz, questions: [] }).success, false);
  });

  it("rejects questions with too few options and empty or non-string options", () => {
    const tooFew = { ...validQuiz, questions: [{ ...validQuestion, options: ["Only one"] }] };
    assert.equal(quizArtifactSchema.safeParse(tooFew).success, false);

    const includesEmpty = {
      ...validQuiz,
      questions: [{ ...validQuestion, options: ["A", ""] }],
    };
    assert.equal(quizArtifactSchema.safeParse(includesEmpty).success, false);

    const nonString = { ...validQuiz, questions: [{ ...validQuestion, options: ["A", 7] }] };
    assert.equal(quizArtifactSchema.safeParse(nonString).success, false);
  });

  it("rejects a correctAnswer that is out of range for its option list", () => {
    const outOfRange = {
      ...validQuiz,
      questions: [{ ...validQuestion, correctAnswer: 4 }],
    };
    assert.equal(quizArtifactSchema.safeParse(outOfRange).success, false);

    const negative = {
      ...validQuiz,
      questions: [{ ...validQuestion, correctAnswer: -1 }],
    };
    assert.equal(quizArtifactSchema.safeParse(negative).success, false);

    const fractional = {
      ...validQuiz,
      questions: [{ ...validQuestion, correctAnswer: 1.5 }],
    };
    assert.equal(quizArtifactSchema.safeParse(fractional).success, false);
  });

  it("accepts each in-range answer index", () => {
    for (let index = 0; index < 4; index++) {
      const quiz = { ...validQuiz, questions: [{ ...validQuestion, correctAnswer: index }] };
      assert.equal(quizArtifactSchema.safeParse(quiz).success, true);
    }
  });

  it("rejects unreasonable question counts over the bound", () => {
    const manyQuestions = {
      ...validQuiz,
      questions: Array.from({ length: 16 }, () => validQuestion),
    };
    assert.equal(quizArtifactSchema.safeParse(manyQuestions).success, false);
  });

  it("rejects an over-bound option count and oversize strings", () => {
    const tooManyOptions = {
      ...validQuiz,
      questions: [{ ...validQuestion, options: ["A", "B", "C", "D", "E", "F"] }],
    };
    assert.equal(quizArtifactSchema.safeParse(tooManyOptions).success, false);

    const longQuestion = {
      ...validQuiz,
      questions: [{ ...validQuestion, question: "q".repeat(501) }],
    };
    assert.equal(quizArtifactSchema.safeParse(longQuestion).success, false);

    const longExplanation = {
      ...validQuiz,
      questions: [{ ...validQuestion, explanation: "e".repeat(1001) }],
    };
    assert.equal(quizArtifactSchema.safeParse(longExplanation).success, false);
  });

  it("rejects questions missing the single answer index or missing explanation", () => {
    const missingAnswer = {
      ...validQuiz,
      questions: [
        { question: "Q?", options: ["A", "B"], explanation: "Because A." },
      ],
    };
    assert.equal(quizArtifactSchema.safeParse(missingAnswer).success, false);

    const missingExplanation = {
      ...validQuiz,
      questions: [
        { question: "Q?", options: ["A", "B"], correctAnswer: 0 },
      ],
    };
    assert.equal(quizArtifactSchema.safeParse(missingExplanation).success, false);
  });

  it("strictly rejects unknown extra keys in the quiz and its questions", () => {
    assert.equal(quizArtifactSchema.safeParse({ ...validQuiz, tags: [] }).success, false);
    assert.equal(
      quizArtifactSchema.safeParse({
        ...validQuiz,
        questions: [{ ...validQuestion, difficulty: "hard" }],
      }).success,
      false,
    );
  });
});

describe("flashcards output schema", () => {
  const validDeck = {
    title: "Photosynthesis Deck",
    cards: [
      { front: "Where does photosynthesis occur?", back: "In the chloroplasts of plant cells." },
      { front: "What gas does photosynthesis release?", back: "Oxygen." },
    ],
  };

  it("accepts a valid deck payload", () => {
    const result = flashcardsArtifactSchema.safeParse(validDeck);
    assert.deepEqual(result.success ? result.data : null, validDeck);
  });

  it("rejects a payload missing required fields (title or cards)", () => {
    assert.equal(flashcardsArtifactSchema.safeParse({ cards: [] }).success, false);
    assert.equal(flashcardsArtifactSchema.safeParse({ title: "X" }).success, false);
  });

  it("rejects an empty card list and empty card text", () => {
    assert.equal(flashcardsArtifactSchema.safeParse({ ...validDeck, cards: [] }).success, false);
    assert.equal(
      flashcardsArtifactSchema.safeParse({
        ...validDeck,
        cards: [{ front: "", back: "Answer" }],
      }).success,
      false,
    );
    assert.equal(
      flashcardsArtifactSchema.safeParse({
        ...validDeck,
        cards: [{ front: "Prompt", back: "" }],
      }).success,
      false,
    );
  });

  it("rejects an excessive card count over the bound", () => {
    const manyCards = {
      ...validDeck,
      cards: Array.from({ length: 31 }, () => ({ front: "F", back: "B" })),
    };
    assert.equal(flashcardsArtifactSchema.safeParse(manyCards).success, false);
  });

  it("rejects oversize card fields", () => {
    assert.equal(
      flashcardsArtifactSchema.safeParse({
        ...validDeck,
        cards: [{ front: "f".repeat(1001), back: "B" }],
      }).success,
      false,
    );
    assert.equal(
      flashcardsArtifactSchema.safeParse({
        ...validDeck,
        cards: [{ front: "F", back: "b".repeat(1001) }],
      }).success,
      false,
    );
  });

  it("strictly rejects unknown extra keys in the deck and its cards", () => {
    assert.equal(flashcardsArtifactSchema.safeParse({ ...validDeck, tags: [] }).success, false);
    assert.equal(
      flashcardsArtifactSchema.safeParse({
        ...validDeck,
        cards: [{ front: "F", back: "B", difficulty: 1 }],
      }).success,
      false,
    );
  });
});

describe("mindmap output schema", () => {
  const validMindMap = {
    title: "Photosynthesis at a glance",
    root: {
      label: "Photosynthesis",
      description: "How plants convert light into chemical energy.",
      children: [
        {
          label: "Light-dependent reactions",
          children: [{ label: "Thylakoid membranes" }],
        },
        { label: "Calvin cycle" },
      ],
    },
  };

  it("accepts a valid tree payload", () => {
    const result = mindmapArtifactSchema.safeParse(validMindMap);
    assert.deepEqual(result.success ? result.data : null, validMindMap);
  });

  it("accepts leaf nodes and nodes without descriptions", () => {
    const leaves = {
      title: "T",
      root: { label: "Root", children: [{ label: "Leaf" }] },
    };
    assert.equal(mindmapArtifactSchema.safeParse(leaves).success, true);
  });

  it("rejects a payload missing the root or the title", () => {
    assert.equal(mindmapArtifactSchema.safeParse({ title: "T" }).success, false);
    assert.equal(mindmapArtifactSchema.safeParse({ root: { label: "R" } }).success, false);
  });

  it("rejects invalid node shapes (missing label, non-string label, empty label)", () => {
    assert.equal(mindmapArtifactSchema.safeParse({ ...validMindMap, root: {} }).success, false);
    assert.equal(
      mindmapArtifactSchema.safeParse({ ...validMindMap, root: { label: 7 } }).success,
      false,
    );
    assert.equal(
      mindmapArtifactSchema.safeParse({ ...validMindMap, root: { label: "" } }).success,
      false,
    );
  });

  it("deeply validates malformed nodes at any level of the tree", () => {
    const missingLabel = {
      title: "T",
      root: { label: "0", children: [{ label: "1", children: [{ children: [] }] }] },
    };
    assert.equal(mindmapArtifactSchema.safeParse(missingLabel).success, false);

    const extraKeyDeep = {
      title: "T",
      root: { label: "0", children: [{ label: "1", children: [{ label: "2", color: "red" }] }] },
    };
    assert.equal(mindmapArtifactSchema.safeParse(extraKeyDeep).success, false);

    const nonObjectChild = {
      title: "T",
      root: { label: "0", children: [{ label: "1", children: ["not a node"] }] },
    };
    assert.equal(mindmapArtifactSchema.safeParse(nonObjectChild).success, false);
  });

  it("rejects an excessive total node count", () => {
    // 1 root + 12 children + each child 3 grandchildren = 49 nodes, depth 3:
    // within every bound, accepted.
    const okTree = {
      title: "T",
      root: {
        label: "Root",
        children: Array.from({ length: 12 }, (_, i) => ({
          label: `Branch ${i}`,
          children: Array.from({ length: 3 }, (_, j) => ({ label: `Leaf ${i}-${j}` })),
        })),
      },
    };
    assert.equal(mindmapArtifactSchema.safeParse(okTree).success, true);

    // 1 root + 12 children + each child 10 grandchildren = 133 nodes with a
    // legal per-node shape (<=12 children) but over the total-node bound.
    const tooWide = {
      title: "T",
      root: {
        label: "Root",
        children: Array.from({ length: 12 }, (_, i) => ({
          label: `Branch ${i}`,
          children: Array.from({ length: 10 }, (_, j) => ({ label: `Leaf ${i}-${j}` })),
        })),
      },
    };
    assert.equal(mindmapArtifactSchema.safeParse(tooWide).success, false);
  });

  it("rejects an excessive depth", () => {
    // Exactly at the 6-level limit: root + 5 descendants.
    let okBranch: unknown = { label: "level-6" };
    for (let i = 5; i >= 2; i--) {
      okBranch = { label: `level-${i}`, children: [okBranch] };
    }
    const okTree = { title: "T", root: { label: "root", children: [okBranch] } };
    assert.equal(mindmapArtifactSchema.safeParse(okTree).success, true);

    // One level past the limit: root + 6 descendants.
    let deepBranch: unknown = { label: "level-7" };
    for (let i = 6; i >= 2; i--) {
      deepBranch = { label: `level-${i}`, children: [deepBranch] };
    }
    const tooDeep = { title: "T", root: { label: "root", children: [deepBranch] } };
    assert.equal(mindmapArtifactSchema.safeParse(tooDeep).success, false);
  });

  it("rejects oversize labels and descriptions", () => {
    assert.equal(
      mindmapArtifactSchema.safeParse({
        ...validMindMap,
        root: { ...validMindMap.root, label: "l".repeat(201) },
      }).success,
      false,
    );
    assert.equal(
      mindmapArtifactSchema.safeParse({
        ...validMindMap,
        root: { ...validMindMap.root, description: "d".repeat(1001) },
      }).success,
      false,
    );
  });

  it("rejects more children than the per-node cap on any level", () => {
    const manyChildren = {
      title: "T",
      root: {
        label: "Root",
        children: Array.from({ length: 13 }, (_, i) => ({ label: `C${i}` })),
      },
    };
    assert.equal(mindmapArtifactSchema.safeParse(manyChildren).success, false);
  });

  it("strictly rejects unknown extra keys in the map and every node", () => {
    assert.equal(mindmapArtifactSchema.safeParse({ ...validMindMap, style: {} }).success, false);
    assert.equal(
      mindmapArtifactSchema.safeParse({
        ...validMindMap,
        root: { ...validMindMap.root, color: "#fff" },
      }).success,
      false,
    );
  });

  it("parses a standalone node through the recursive node schema", () => {
    const node = { label: "Hi", children: [{ label: "Child", description: "Detail" }] };
    const result = mindmapNodeSchema.safeParse(node);
    assert.deepEqual(result.success ? result.data : null, node);
  });
});

describe("takeaways output schema", () => {
  const validTakeaways = {
    title: "Photosynthesis essentials",
    takeaways: [
      {
        heading: "Energy conversion",
        detail: "Plants convert sunlight into chemical energy stored as glucose.",
      },
      {
        heading: "Location",
        detail: "Photosynthesis happens in the chloroplasts.",
      },
    ],
  };

  it("accepts a valid takeaways payload", () => {
    const result = takeawaysArtifactSchema.safeParse(validTakeaways);
    assert.deepEqual(result.success ? result.data : null, validTakeaways);
  });

  it("rejects a payload missing required fields (title or takeaways)", () => {
    assert.equal(takeawaysArtifactSchema.safeParse({ takeaways: [] }).success, false);
    assert.equal(takeawaysArtifactSchema.safeParse({ title: "X" }).success, false);
  });

  it("rejects an empty list and empty heading/detail strings", () => {
    assert.equal(takeawaysArtifactSchema.safeParse({ ...validTakeaways, takeaways: [] }).success, false);
    assert.equal(
      takeawaysArtifactSchema.safeParse({
        ...validTakeaways,
        takeaways: [{ heading: "", detail: "D" }],
      }).success,
      false,
    );
    assert.equal(
      takeawaysArtifactSchema.safeParse({
        ...validTakeaways,
        takeaways: [{ heading: "H", detail: "" }],
      }).success,
      false,
    );
  });

  it("rejects an excessive item count over the bound", () => {
    const many = {
      ...validTakeaways,
      takeaways: Array.from({ length: 21 }, (_, i) => ({ heading: `H${i}`, detail: "D" })),
    };
    assert.equal(takeawaysArtifactSchema.safeParse(many).success, false);
  });

  it("rejects oversize headings and details", () => {
    assert.equal(
      takeawaysArtifactSchema.safeParse({
        ...validTakeaways,
        takeaways: [{ heading: "h".repeat(201), detail: "D" }],
      }).success,
      false,
    );
    assert.equal(
      takeawaysArtifactSchema.safeParse({
        ...validTakeaways,
        takeaways: [{ heading: "H", detail: "d".repeat(1001) }],
      }).success,
      false,
    );
  });

  it("strictly rejects unknown extra keys in the payload and its items", () => {
    assert.equal(takeawaysArtifactSchema.safeParse({ ...validTakeaways, summary: "x" }).success, false);
    assert.equal(
      takeawaysArtifactSchema.safeParse({
        ...validTakeaways,
        takeaways: [{ heading: "H", detail: "D", priority: 1 }],
      }).success,
      false,
    );
  });
});

describe("structured output parsing", () => {
  it("extracts bare JSON", () => {
    assert.deepEqual(extractJsonObject(JSON.stringify(validSummary)), validSummary);
  });

  it("extracts JSON from markdown code fences", () => {
    const fenced = "```json\n" + JSON.stringify(validSummary) + "\n```";
    assert.deepEqual(extractJsonObject(fenced), validSummary);
  });

  it("extracts JSON surrounded by prose", () => {
    const noisy = "Sure! Here is your summary:\n" + JSON.stringify(validSummary) + "\nHope that helps.";
    assert.deepEqual(extractJsonObject(noisy), validSummary);
  });

  it("handles braces inside string values", () => {
    assert.deepEqual(extractJsonObject('{"title":"a {b} c"}'), { title: "a {b} c" });
  });

  it("returns null for unbalanced or absent JSON", () => {
    assert.equal(extractJsonObject("{ not json"), null);
    assert.equal(extractJsonObject("no object here"), null);
    assert.deepEqual(extractJsonObject(""), null);
  });

  it("parses valid output through the summary schema", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, JSON.stringify(validSummary));
    assert.equal(parsed.ok, true);
    assert.ok(parsed.ok);
  });

  it("fails output that is not JSON at all", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, "Just some words");
    assert.equal(parsed.ok, false);
  });

  it("fails output that mismatches the schema", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, JSON.stringify({ nope: 1 }));
    assert.equal(parsed.ok, false);
  });
});

describe("bounded source context", () => {
  const chunks: ArtifactSourceChunk[] = [
    {
      chunkId: "ch1",
      documentId: "doc1",
      documentName: "Alpha",
      index: 0,
      pageNumber: null,
      content: "AAAAAAAA", // 8 chars -> 2 tokens by heuristic
      tokenCount: 2,
    },
    {
      chunkId: "ch2",
      documentId: "doc1",
      documentName: "Alpha",
      index: 1,
      pageNumber: 3,
      content: "BBBBBBBB",
      tokenCount: 2,
    },
    {
      chunkId: "ch3",
      documentId: "doc2",
      documentName: "Beta",
      index: 0,
      pageNumber: null,
      content: "CCCCCCCC",
      tokenCount: 2,
    },
  ];

  it("includes all chunks when within budget and preserves document/chunk order", () => {
    const bounded = buildBoundedContext(chunks, 100);
    assert.equal(bounded.includedChunks, 3);
    assert.equal(bounded.truncatedChunks, 0);
    assert.ok(bounded.context.includes('<source id="ch1"'));
    assert.ok(bounded.context.includes("ch2", bounded.context.indexOf("ch1")));
    assert.ok(bounded.context.includes("<source id=\"ch3\""));
  });

  it("hard-caps context at whole-chunk granularity and reports truncation", () => {
    const bounded = buildBoundedContext(chunks, 4);
    assert.equal(bounded.includedChunks, 2);
    assert.equal(bounded.truncatedChunks, 1);
    assert.ok(bounded.context.includes("ch2"));
    assert.ok(!bounded.context.includes("ch3"));
  });

  it("always keeps the first chunk even when it exceeds the budget", () => {
    const hugeFirst = [{ ...chunks[0], tokenCount: 1000 }];
    const bounded = buildBoundedContext(hugeFirst, 10);
    assert.equal(bounded.includedChunks, 1);
    assert.ok(bounded.context.includes("AAAAAAAA"));
  });

  it("estimates tokens with len/4 when tokenCount is missing", () => {
    const noCount = [{ ...chunks[0], tokenCount: null, content: "0123456789abcd" }];
    const bounded = buildBoundedContext(noCount, 4);
    assert.equal(bounded.includedChunks, 1); // 14 chars -> 4 tokens, fits
  });
});

describe("artifact source scope", () => {
  it("rejects an empty source scope explicitly (empty is never all sources)", () => {
    assert.throws(() => assertNonEmptySourceScope([]), { code: "ARTIFACT_NO_SOURCES" });
    assert.deepEqual(assertNonEmptySourceScope(["doc1"]), ["doc1"]);
  });

  it("accepts a fully owned scope and preserves order", () => {
    assert.deepEqual(
      assertSourcesOwned(["doc2", "doc1"], new Set(["doc1", "doc2"])),
      ["doc2", "doc1"],
    );
  });

  it("rejects a scope containing any source outside the knowledge base", () => {
    assert.throws(
      () => assertSourcesOwned(["doc1", "foreign"], new Set(["doc1"])),
      { code: "ARTIFACT_SOURCE_OUT_OF_SCOPE" },
    );
  });
});

describe("artifact trace metadata", () => {
  it("carries artifact, kb, source scope and type in the trace metadata", () => {
    const metadata = buildArtifactTraceMetadata({
      artifactId: "clx-artifact",
      knowledgeBaseId: "clx-kb",
      sourceIds: ["clx-doc1", "clx-doc2"],
      artifactType: "SUMMARY",
    });
    assert.deepEqual(metadata, {
      artifactId: "clx-artifact",
      knowledgeBaseId: "clx-kb",
      sourceIds: ["clx-doc1", "clx-doc2"],
      artifactType: "SUMMARY",
    });
  });

  it("snapshots the source array rather than aliasing caller input", () => {
    const sourceIds = ["clx-doc1"];
    const metadata = buildArtifactTraceMetadata({
      artifactId: "clx-a",
      knowledgeBaseId: "clx-kb",
      sourceIds,
      artifactType: "SUMMARY",
    });
    sourceIds.push("clx-doc2");
    assert.equal((metadata.sourceIds as string[]).length, 1);
  });
});

describe("artifact engine wiring", () => {
  const engineSource = readFileSync(
    new URL("../lib/artifacts/engine.ts", import.meta.url),
    "utf8",
  );

  it("generates through the provider abstraction, never raw provider SDKs", () => {
    assert.match(engineSource, /getAIProvider|generateChat/);
    assert.doesNotMatch(
      engineSource,
      /from ["'](openai|@google\/generativelanguage)["']|new OpenAI\(|new GoogleGenerativeAI\(/,
    );
  });

  it("reuses canAccessKnowledgeBase for authorization", () => {
    assert.match(engineSource, /canAccessKnowledgeBase/);
  });

  it("persists terminal states through the atomic lifecycle operations", () => {
    assert.match(engineSource, /completeLearningArtifact/);
    assert.match(engineSource, /failLearningArtifact/);
  });

  it("requires an explicit non-empty source scope at the entrypoint", () => {
    assert.match(engineSource, /assertNonEmptySourceScope/);
  });
});

describe("artifact application wiring", () => {
  const actionsSource = readFileSync(
    new URL("../lib/actions/artifacts.ts", import.meta.url),
    "utf8",
  );
  const persistenceSource = readFileSync(
    new URL("../lib/artifacts/persistence.ts", import.meta.url),
    "utf8",
  );

  it("is a server action boundary", () => {
    assert.match(actionsSource, /^"use server";/m);
  });

  it("delegates generation to the artifact engine instead of a second pipeline", () => {
    assert.match(actionsSource, /generateLearningArtifact/);
    assert.doesNotMatch(actionsSource, /generateChat|getAIProvider/);
  });

  it("pins REPORT and QUIZ generation to the unified engine with their artifact types", () => {
    assert.match(actionsSource, /generateReportArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "REPORT"/);
    assert.match(actionsSource, /generateQuizArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "QUIZ"/);
  });

  it("pins FLASHCARDS, MINDMAP and TAKEAWAYS generation to the unified engine", () => {
    assert.match(actionsSource, /generateFlashcardsArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "FLASHCARDS"/);
    assert.match(actionsSource, /generateMindmapArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "MINDMAP"/);
    assert.match(actionsSource, /generateTakeawaysArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "TAKEAWAYS"/);
  });

  it("pins PODCAST generation to the unified engine", () => {
    assert.match(actionsSource, /generatePodcastArtifact[\s\S]*generateLearningArtifact\(\{[\s\S]*artifactType: "PODCAST"/);
  });

  it("authorizes reads, lists and deletion through canAccessKnowledgeBase; regeneration is authorized inside the engine like generation", () => {
    const authUses = actionsSource.match(/canAccessKnowledgeBase/g);
    assert.equal(authUses?.length, 5); // one import + read, list, delete and recover call sites (regeneration authorizes in the engine)
    assert.doesNotMatch(actionsSource, /API_KEY|session\.user\.id to|members/);
  });

  it("keeps direct database access out of the application layer", () => {
    assert.doesNotMatch(actionsSource, /from ["']@\/lib\/prisma["']/);
  });

  it("reads artifacts through the KB-scoped persistence primitive", () => {
    assert.match(actionsSource, /getLearningArtifactInKb/);
    assert.match(persistenceSource, /getLearningArtifactInKb[\s\S]*where:\s*\{\s*id,\s*knowledgeBaseId\s*\}/);
  });

  it("routes every server action return through the client-safety projection", () => {
    assert.match(actionsSource, /toWorkspaceArtifactData/);
    assert.ok((actionsSource.match(/toWorkspaceArtifactData\(/g)?.length ?? 0) >= 8);
  });
});

describe("podcast engine media wiring", () => {
  const engineSource = readFileSync(new URL("../lib/artifacts/engine.ts", import.meta.url), "utf8");
  const routeSource = readFileSync(
    new URL("../app/api/artifacts/[artifactId]/audio/route.ts", import.meta.url),
    "utf8",
  );
  const actionsSource = readFileSync(new URL("../lib/actions/artifacts.ts", import.meta.url), "utf8");

  it("synthesizes podcast audio inside the unified engine, not a second pipeline", () => {
    assert.match(engineSource, /generatePodcastAudio/);
    assert.match(engineSource, /artifactType === "PODCAST"/);
    assert.match(engineSource, /accessMode: "authenticated"/);
  });

  it("stores the media reference only in metadata with the storage details server-side", () => {
    assert.match(engineSource, /storageKey: storageFile\.key/);
    assert.match(engineSource, /durationSeconds: synthesized\.durationSeconds/);
  });

  it("cleans up uploaded audio best-effort when a later stage fails", () => {
    assert.match(engineSource, /getStorageProvider\(\)\.delete\(uploadedAudioKey\)/);
    assert.match(engineSource, /logError\("artifact\.engine\.cleanup"/);
  });

  it("serves podcast audio through a session-authenticated same-origin media route", () => {
    assert.match(routeSource, /getServerSession/);
    assert.match(routeSource, /canAccessKnowledgeBase/);
    assert.match(routeSource, /getSignedUrl/);
    assert.match(routeSource, /type !== "PODCAST"/);
    assert.match(routeSource, /proxyMediaResponse/);
    assert.match(routeSource, /mediaContentType\(audio\.format\)/);
    assert.doesNotMatch(routeSource, /arrayBuffer|Buffer\.from/, "media is streamed, never fully buffered");
  });

  it("keeps the storage key out of the client-safe projection at the action boundary", () => {
    const dtoSource = readFileSync(new URL("../lib/artifacts/dto.ts", import.meta.url), "utf8");
    assert.match(dtoSource, /delete safeAudio\.storageKey/);
    assert.match(dtoSource, /delete safeAudio\.storageProvider/);
    assert.match(actionsSource, /toWorkspaceArtifactData/);
  });
});

describe("public artifact DTO contract", () => {
  it("exposes exactly the public application fields and nothing internal", () => {
    const row: LearningArtifactRow = {
      id: "clx-a",
      type: "SUMMARY",
      status: "COMPLETED",
      name: "My summary",
      schemaVersion: 1,
      sourceIds: ["clx-doc1"],
      content: { title: "T", overview: "O", keyPoints: ["K"] },
      metadata: { promptVersion: "summary-v1", providerType: "openai", model: "gpt-4o" },
      knowledgeBaseId: "clx-kb",
      createdById: "clx-user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    assert.deepEqual(Object.keys(toLearningArtifactData(row)).sort(), [
      "content",
      "createdAt",
      "createdById",
      "id",
      "knowledgeBaseId",
      "metadata",
      "name",
      "schemaVersion",
      "sourceIds",
      "status",
      "type",
      "updatedAt",
    ].sort());
  });

  it("the DTO carries no storage URLs, keys, or credentials fields", () => {
    const row: LearningArtifactRow = {
      id: "clx-a",
      type: "SUMMARY",
      status: "COMPLETED",
      name: null,
      schemaVersion: 1,
      sourceIds: [],
      content: null,
      metadata: null,
      knowledgeBaseId: "clx-kb",
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const dto = toLearningArtifactData(row);
    assert.equal(JSON.stringify(dto).match(/storageUrl|storageKey|apiKey|secret|embedding/i), null);
  });

  it("artifact metadata holds only safe provenance fields", () => {
    const safe = JSON.stringify({
      promptVersion: "summary-v1",
      providerType: "openai",
      model: "gpt-4o",
    });
    assert.match(safe, /promptVersion/);
    assert.doesNotMatch(safe, /apiKey|token|secret/i);
  });

  it("the workspace projection strips media storage references but keeps playback fields", async () => {
    const { toWorkspaceArtifactData } = await import("@/lib/artifacts/dto");
    const row: LearningArtifactRow = {
      id: "clx-a",
      type: "PODCAST",
      status: "COMPLETED",
      name: null,
      schemaVersion: 1,
      sourceIds: [],
      content: null,
      metadata: {
        promptVersion: "podcast-v1",
        providerType: "openai",
        model: "gpt-4o",
        audio: {
          provider: "local",
          storageProvider: "cloudinary",
          storageKey: "artifacts/podcast-clx-a",
          format: "wav",
          durationSeconds: 12.5,
        },
      },
      knowledgeBaseId: "clx-kb",
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const projected = toWorkspaceArtifactData(toLearningArtifactData(row));
    const audio = (projected.metadata as { audio?: Record<string, unknown> })?.audio;
    assert.ok(audio);
    assert.equal(audio.storageKey, undefined);
    assert.equal(audio.storageProvider, undefined);
    assert.equal(audio.format, "wav");
    assert.equal(audio.durationSeconds, 12.5);
    assert.equal(JSON.stringify(projected).match(/storageKey|storageProvider/i), null);
  });
});