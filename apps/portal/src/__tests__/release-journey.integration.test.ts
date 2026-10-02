// Phase 9C canonical release-confidence journey.
//
// Every other suite proves one leg of the product against a real database. This
// file proves the *chain* — one tenant, one session, one pass through the
// production path: ingest a source -> index it into pgvector -> retrieve it ->
// answer a grounded question with citations -> generate artifacts from that
// source -> study them -> evaluate the retrieval config -> read the traces back
// -> and prove a foreign tenant sees none of it.
//
// It runs the real code paths end to end. The only substitution is the AI
// network: globalThis.fetch is replaced with a stub that answers Gemini
// embedContent with a fixed 768-dim vector and OpenAI /chat/completions with a
// canned body, so no paid provider and no API key is needed. Retrieval is NOT
// stubbed: the vectors go into the pgvector column and come back out through
// the same `<=>` operator production uses, so a broken index or a wrong
// dimension fails here.
//
// Podcast synthesis (TTS + Cloudinary upload) is deliberately not chained: the
// storage provider throws unless Cloudinary credentials are configured, so it
// cannot run in CI. The episode media route and its tenancy are covered by
// podcast-audio-media.integration.test.ts.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ingestText } from "@/lib/actions/document";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { searchSimilar } from "@/lib/ai/retrieval";
import { streamChatResponse } from "@/lib/ai/chat";
import { createConversation, getConversation } from "@/lib/ai/memory";
import { resetAIProviderCache } from "@/lib/ai/providers";
import { generateLearningArtifactForUser } from "@/lib/artifacts/engine";
import { listLearningArtifacts } from "@/lib/artifacts/persistence";
import {
  getStudyProgressForUser,
  startQuizAttemptForUser,
  submitQuizAttemptForUser,
} from "@/lib/study";
import { runBenchmark } from "@/lib/evaluation/benchmark";
import { MAX_RUN_QUESTIONS } from "@/lib/evaluation/limits";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getTraceById, searchTraces } from "@/lib/observability/trace-explorer";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { DEFAULT_RETRIEVAL_CONFIG } from "@/lib/retrieval/types";
import { AppError } from "@/lib/errors";
import { POST as chatPOST } from "@/app/api/ai/chat/route";

// The pgvector column is pinned to 768, so ingestion and retrieval must both
// resolve a 768-dim model. Chat and artifacts run on OpenAI so the stub also
// covers the OpenAI SSE and non-stream shapes; the KB pins the embedding
// provider to Gemini per-KB so it never falls back to OpenAI's 1536 default.
const DIM = 768;
const FIXED_VEC = Array.from({ length: DIM }, (_, i) => (i === 0 ? 1 : 0));

const SOURCE_TITLE = "Onboarding runbook";
const SOURCE_BODY =
  "Kairos indexes a source into PostgreSQL with pgvector, then answers questions " +
  "from the retrieved chunks and cites the source document for every claim.";

const SUMMARY_CONTENT = {
  title: "Indexing and citations",
  overview: "The runbook covers pgvector indexing and cited answers.",
  keyPoints: ["Sources are indexed into pgvector.", "Answers cite their source document."],
};

const QUIZ_CONTENT = {
  title: "Runbook check",
  instructions: "Pick the right statement.",
  questions: [
    {
      question: "Where are sources indexed?",
      options: ["PostgreSQL with pgvector", "A flat CSV", "The browser cache"],
      correctAnswer: 0,
      explanation: "Kairos indexes into PostgreSQL with pgvector.",
    },
    {
      question: "What does an answer include?",
      options: ["Nothing", "A citation to the source", "A raw file handle"],
      correctAnswer: 1,
      explanation: "Answers cite the source document.",
    },
  ],
};

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function openaiNonStream(content: unknown): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-journey",
      object: "chat.completion",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        { index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function openaiStream(text: string): Response {
  const chunk = (delta: Record<string, unknown>, finish: string | null) =>
    `data: ${JSON.stringify({
      id: "chatcmpl-journey",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;
  const body =
    chunk({ role: "assistant" }, null) + chunk({ content: text }, null) + chunk({}, "stop") + "data: [DONE]\n\n";
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(body));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

// Routes by URL so one stub serves Gemini embeddings and OpenAI chat. The
// provider cache is cleared on install and restore: the OpenAI SDK captures
// globalThis.fetch when its client is constructed, so a provider built under a
// previous stub would keep calling that dead stub.
function installFetch(chat: () => Response): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(":embedContent")) {
      return new Response(JSON.stringify({ embedding: { values: FIXED_VEC } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/chat/completions")) return chat();
    return new Response("unexpected fetch", { status: 500 });
  }) as typeof globalThis.fetch;
  resetAIProviderCache();
  return () => {
    globalThis.fetch = original;
    resetAIProviderCache();
  };
}

async function waitForStatus(client: PrismaClient, docId: string, expected: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await client.document.findUnique({
      where: { id: docId },
      select: { status: true, metadata: true },
    });
    if (doc?.status === expected) return doc;
    if (doc?.status === "ERROR") {
      throw new Error(`Document reached ERROR instead of ${expected}: ${JSON.stringify(doc.metadata)}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for document ${docId} to reach ${expected}`);
}

function appError(code: string, statusCode: number) {
  return (err: unknown) =>
    err instanceof AppError && err.code === code && err.statusCode === statusCode;
}

describe("canonical Portal journey: ingest -> retrieve -> answer -> artifacts -> study -> evaluate -> observe -> isolate", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const foreignUserId = randomUUID();
  const foreignOrgId = randomUUID();
  const foreignProjectId = randomUUID();
  const orgId = randomUUID();
  const projectId = randomUUID();
  const kbId = randomUUID();
  let docId = "";

  let client: PrismaClient;
  let userId = "";
  let chatRequestId = "";
  let chatTraceId = "";
  let summaryArtifactId = "";
  let quizArtifactId = "";
  let benchmarkRunId = "";
  let oversizedDatasetId = "";
  const datasetIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;

    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    // Chat and artifacts run on OpenAI; embeddings are 768-wide, so the Gemini
    // provider still has to be constructible.
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";

    userId = await ensureDemoUser();
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.organization.create({
      data: {
        id: orgId,
        name: "Journey Org",
        slug: `journey-org-${randomUUID()}`,
        ownerId: userId,
        members: { create: [{ userId, role: "OWNER" }] },
      },
    });
    await client.project.create({
      data: { id: projectId, name: "Journey Project", slug: `journey-proj-${randomUUID()}`, organizationId: orgId },
    });
    await client.knowledgeBase.create({
      data: {
        id: kbId,
        name: "Journey KB",
        projectId,
        retrievalConfig: { embeddingProvider: "gemini", embeddingModel: "text-embedding-004" },
      },
    });

    // A second tenant that owns nothing in the journey org.
    await client.user.create({
      data: { id: foreignUserId, email: `journey-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await client.organization.create({
      data: {
        id: foreignOrgId,
        name: "Foreign Org",
        slug: `journey-foreign-org-${randomUUID()}`,
        ownerId: foreignUserId,
        members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
      },
    });
    await client.project.create({
      data: {
        id: foreignProjectId,
        name: "Foreign Project",
        slug: `journey-foreign-proj-${randomUUID()}`,
        organizationId: foreignOrgId,
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      // runBenchmark pins an immutable version row per run, so the children go first.
      await client.benchmarkRun.deleteMany({ where: { datasetId: { in: datasetIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      if (docId) await client.document.deleteMany({ where: { id: docId } });
      await client.knowledgeBase.deleteMany({ where: { id: kbId } });
      await client.project.deleteMany({ where: { id: { in: [projectId, foreignProjectId] } } });
      await client.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
      // The demo user is shared and upserted by every suite; never delete it.
      await client.user.deleteMany({ where: { id: foreignUserId } });
    } finally {
      await client.$disconnect();
    }
  });

  it("indexes an ingested source into pgvector at the pinned 768 dimensions", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const restore = installFetch(() => openaiNonStream(SUMMARY_CONTENT));
    try {
      const doc = await ingestText(kbId, { title: SOURCE_TITLE, content: SOURCE_BODY });
      docId = doc.id;
      await waitForStatus(client, docId, "INDEXED");

      const embeddings = await client.documentEmbedding.findMany({
        where: { chunk: { documentId: docId } },
        select: { dimensions: true, model: true, status: true },
      });
      const chunks = await client.documentChunk.count({ where: { documentId: docId } });

      assert.ok(chunks > 0, "the ingested source must be chunked");
      assert.equal(embeddings.length, chunks, "every chunk must be embedded");
      assert.ok(embeddings.every((e) => e.status === "completed"));
      assert.ok(embeddings.every((e) => e.dimensions === DIM));
      assert.ok(embeddings.every((e) => e.model === "text-embedding-004"));

      // The vector column is not in the Prisma model (it is added by migration),
      // so read it directly: the pgvector row must actually hold a 768-wide
      // vector, not just a row claiming one.
      const stored = await client.$queryRaw<{ chunk_id: string; width: number }[]>`
        SELECT "chunkId" AS chunk_id, vector_dims("embedding") AS width
        FROM "DocumentEmbedding"
        WHERE "embedding" IS NOT NULL
          AND "chunkId" IN (SELECT "id" FROM "DocumentChunk" WHERE "documentId" = ${docId})
      `;
      assert.equal(stored.length, chunks, "every chunk must hold a stored vector");
      assert.ok(stored.every((row) => row.width === DIM), `stored widths: ${stored.map((r) => r.width).join(",")}`);
    } finally {
      restore();
    }
  });

  it("retrieves the ingested chunk back out of pgvector through the real search path", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const restore = installFetch(() => openaiNonStream(SUMMARY_CONTENT));
    try {
      const result = await searchSimilar("how does kairos index and cite sources", {
        knowledgeBaseIds: [kbId],
        providerType: "gemini",
        embeddingModel: "text-embedding-004",
        topK: 5,
        minSimilarity: 0,
      });

      const hit = result.chunks.find((c) => c.documentId === docId);
      assert.ok(hit, `expected the ingested chunk among ${result.chunks.length} results`);
      assert.equal(hit.documentName, SOURCE_TITLE);
      assert.ok(hit.content.includes("pgvector"));
      // The stub returns the same unit vector for the query and the indexed
      // chunk, so a real cosine search must score it a perfect match.
      assert.ok(hit.similarity > 0.99, `expected a real cosine match, got ${hit.similarity}`);
    } finally {
      restore();
    }
  });

  it("answers a grounded question with citations and leaves a retrievable trace", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const restore = installFetch(() => openaiStream("Kairos indexes into pgvector and cites its sources."));
    try {
      const conv = await createConversation(kbId, userId, "How does Kairos answer?");
      chatRequestId = randomUUID();
      const out: string[] = [];

      for await (const part of streamChatResponse({
        conversationId: conv.id,
        kbId,
        query: "How does Kairos answer?",
        providerType: "openai",
        trace: { requestId: chatRequestId, organizationId: orgId, userId },
      })) {
        if (part.content) out.push(part.content);
      }

      assert.deepEqual(out, ["Kairos indexes into pgvector and cites its sources."]);

      const read = await getConversation(conv.id);
      const assistant = read!.messages.find((m) => m.role === "assistant");
      assert.equal(assistant?.citations?.length, 1, "a grounded answer must persist its citation");
      assert.equal(assistant?.citations![0].documentId, docId);

      const trace = await client.trace.findUnique({
        where: { requestId: chatRequestId },
        include: { spans: true },
      });
      assert.ok(trace, "the chat turn must leave a trace");
      chatTraceId = trace!.id;
      assert.equal(trace!.status, "OK");
      assert.equal(trace!.organizationId, orgId);
      assert.deepEqual(trace!.spans.map((s) => s.name).sort(), ["chat.generation", "chat.retrieval"]);
    } finally {
      restore();
    }
  });

  it("generates a summary and a quiz from the ingested source, both grounded and traced", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const summaryRestore = installFetch(() => openaiNonStream(SUMMARY_CONTENT));
    let summary;
    try {
      summary = await generateLearningArtifactForUser({
        userId,
        knowledgeBaseId: kbId,
        artifactType: "SUMMARY",
        sourceIds: [docId],
      });
    } finally {
      summaryRestore();
    }
    assert.equal(summary.status, "COMPLETED");
    assert.deepEqual(summary.content, SUMMARY_CONTENT);
    summaryArtifactId = summary.id;

    const quizRestore = installFetch(() => openaiNonStream(QUIZ_CONTENT));
    let quiz;
    try {
      quiz = await generateLearningArtifactForUser({
        userId,
        knowledgeBaseId: kbId,
        artifactType: "QUIZ",
        sourceIds: [docId],
      });
    } finally {
      quizRestore();
    }
    assert.equal(quiz.status, "COMPLETED");

    const listed = await listLearningArtifacts(kbId);
    assert.ok(listed.some((a) => a.id === summaryArtifactId));
    assert.ok(listed.some((a) => a.id === quiz.id));
    quizArtifactId = quiz.id;

    for (const name of ["artifact.generate.summary", "artifact.generate.quiz"]) {
      const trace = await client.trace.findFirst({
        where: { name, metadata: { path: ["knowledgeBaseId"], equals: kbId } },
        orderBy: { startTime: "desc" },
      });
      assert.ok(trace, `${name} must leave a trace`);
      assert.equal(trace!.status, "OK");
      assert.equal(trace!.organizationId, orgId);
    }
  });

  it("takes and grades the quiz, then reports study progress for the artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const started = await startQuizAttemptForUser(userId, { knowledgeBaseId: kbId, artifactId: quizArtifactId });
    assert.equal(started.status, "PENDING");

    const submitted = await submitQuizAttemptForUser(userId, {
      attemptId: started.id,
      answers: [
        { questionId: 0, selectedAnswer: 0 },
        { questionId: 1, selectedAnswer: 1 },
      ],
    });
    assert.equal(submitted.status, "COMPLETED");
    assert.equal(submitted.score, 2, "both answers are correct");
    assert.equal(submitted.totalQuestions, 2);

    const progress = await getStudyProgressForUser(userId, kbId);
    assert.equal(progress[quizArtifactId].attempts, 1);
    assert.equal(progress[quizArtifactId].bestScore, 2);
  });

  it("runs an evaluation over the same knowledge base and persists its metrics", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const restore = installFetch(() =>
      openaiNonStream({ summary: SOURCE_BODY, keyPoints: ["pgvector", "citations"] }),
    );
    try {
      const dataset = await client.benchmarkDataset.create({
        data: {
          name: `journey-${randomUUID()}`,
          knowledgeBaseId: kbId,
          questions: {
            create: [
              { question: "Where are sources indexed?", expectedAnswer: "PostgreSQL with pgvector" },
              { question: "What does an answer include?", expectedAnswer: "A citation" },
            ],
          },
        },
      });
      datasetIds.push(dataset.id);

      benchmarkRunId = await runBenchmark(
        dataset.id,
        kbId,
        {
          ...DEFAULT_RETRIEVAL_CONFIG,
          retrievalStrategy: "vector",
          retrievalMode: "vector",
          embeddingProvider: "gemini",
          embeddingModel: "text-embedding-004",
          topK: 5,
          similarityThreshold: 0,
        } as never,
        "journey run",
      );

      const run = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: benchmarkRunId },
        include: { results: true },
      });
      assert.equal(run.status, "completed");
      assert.equal(run.results.length, 2, "every question must persist a result row");
      const metrics = run.aggregatedMetrics as Record<string, unknown> | null;
      assert.ok(metrics && Object.keys(metrics).length > 0, "a completed run must record metrics");
    } finally {
      restore();
    }
  });

  it("exposes every step of the journey in the org's observability stream", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const { traces, total } = await searchTraces(orgId, { pageSize: 100 });
    const names = new Set(traces.map((t2) => t2.name));

    assert.ok(total >= 3, `expected the journey to leave several traces, saw ${total}`);
    assert.ok(names.has("chat.generate"));
    assert.ok(names.has("artifact.generate.summary"));
    assert.ok(names.has("artifact.generate.quiz"));
    assert.ok(traces.every((t2) => t2.organizationId === orgId));
  });

  it("shows the foreign tenant none of it", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    // Nothing the foreign tenant can reach exists for it, and the surfaces that
    // take a KB id report "not found" rather than "forbidden", so the KB is not
    // even confirmed to exist.
    assert.equal(await canAccessKnowledgeBase(foreignUserId, kbId), false);
    assert.equal(await getTraceById(chatTraceId, foreignOrgId), null);
    await assert.rejects(
      () => getStudyProgressForUser(foreignUserId, kbId),
      appError("NOT_FOUND", 404),
    );
    await assert.rejects(
      () => startQuizAttemptForUser(foreignUserId, { knowledgeBaseId: kbId, artifactId: quizArtifactId }),
      appError("NOT_FOUND", 404),
    );

    const foreignTraces = await searchTraces(foreignOrgId, { pageSize: 100 });
    assert.equal(foreignTraces.total, 0, "a foreign org must not see the journey's traces");
    assert.equal(foreignTraces.traces.length, 0);
  });

  it("refuses to build the oversized evaluation dataset before any run is created", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const dataset = await client.benchmarkDataset.create({
      data: {
        name: `journey-oversized-${randomUUID()}`,
        knowledgeBaseId: kbId,
        questions: {
          create: Array.from({ length: MAX_RUN_QUESTIONS + 1 }, (_, i) => ({ question: `Question ${i}` })),
        },
      },
    });
    datasetIds.push(dataset.id);
    oversizedDatasetId = dataset.id;

    const runsBefore = await client.benchmarkRun.count({ where: { datasetId: oversizedDatasetId } });

    await assert.rejects(
      () =>
        runBenchmark(
          oversizedDatasetId,
          kbId,
          { ...DEFAULT_RETRIEVAL_CONFIG, embeddingProvider: "gemini", embeddingModel: "text-embedding-004" } as never,
        ),
      appError("EVALUATION_RUN_TOO_LARGE", 413),
    );

    assert.equal(
      await client.benchmarkRun.count({ where: { datasetId: oversizedDatasetId } }),
      runsBefore,
      "a refused run must not leave a BenchmarkRun behind",
    );
  });
});

describe("generation guardrails on the artifact path", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userId = randomUUID();
  const orgId = randomUUID();
  const projectId = randomUUID();
  const kbId = randomUUID();
  const docId = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;

    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";

    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.create({
      data: { id: userId, email: `journey-rl-${randomUUID()}@test.local`, name: "Rate Limited" },
    });
    await client.organization.create({
      data: {
        id: orgId,
        name: "Guardrail Org",
        slug: `journey-rl-org-${randomUUID()}`,
        ownerId: userId,
        members: { create: [{ userId, role: "OWNER" }] },
      },
    });
    await client.project.create({
      data: { id: projectId, name: "Guardrail Project", slug: `journey-rl-proj-${randomUUID()}`, organizationId: orgId },
    });
    await client.knowledgeBase.create({
      data: {
        id: kbId,
        name: "Guardrail KB",
        projectId,
        retrievalConfig: { embeddingProvider: "gemini", embeddingModel: "text-embedding-004" },
      },
    });
    await client.document.create({
      data: { id: docId, name: "source.txt", fileType: "txt", knowledgeBaseId: kbId, status: "INDEXED" },
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.document.deleteMany({ where: { id: docId } });
      await client.knowledgeBase.deleteMany({ where: { id: kbId } });
      await client.project.deleteMany({ where: { id: projectId } });
      await client.organization.deleteMany({ where: { id: orgId } });
      await client.user.deleteMany({ where: { id: userId } });
    } finally {
      await client.$disconnect();
    }
  });

  it("returns 429 once the per-user generation budget is spent, before spending anything", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    // Spend the budget through the same limiter the engine charges, rather than
    // paying for 20 real generations, then prove the engine still refuses.
    for (let i = 0; i < RATE_LIMITS.research.maxRequests; i++) {
      assert.equal(rateLimit(`artifact:${userId}`, RATE_LIMITS.research).allowed, true, `request ${i} must pass`);
    }

    const restore = installFetch(() => {
      throw new Error("the provider must never be reached once the budget is spent");
    });
    try {
      await assert.rejects(
        () =>
          generateLearningArtifactForUser({
            userId,
            knowledgeBaseId: kbId,
            artifactType: "SUMMARY",
            sourceIds: [docId],
          }),
        appError("ARTIFACT_RATE_LIMITED", 429),
      );
    } finally {
      restore();
    }

    const rows = await client.learningArtifact.count({ where: { knowledgeBaseId: kbId } });
    assert.equal(rows, 0, "a refused generation must not persist an artifact row");
  });
});

// The provider-side half of the same budget: an oversized AI request is
// rejected at the route boundary before any database read, retrieval, or
// provider call, so a client cannot turn one request into an unbounded spend.
describe("chat request guardrails at the route boundary", () => {
  before(() => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
  });

  function chatRequest(query: string): NextRequest {
    return new NextRequest("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: randomUUID(),
        kbId: randomUUID(),
        query,
        provider: "openai",
      }),
    });
  }

  it("rejects an oversized query with 400 and never reaches the provider", async (t) => {
    if (!isDemoModeEnabled()) { t.skip("KAIROS_DEMO_MODE is not enabled"); return; }

    const reached: string[] = [];
    const restore = installFetch(() => {
      reached.push("provider");
      throw new Error("the provider must never be reached for an oversized query");
    });
    try {
      const res = await chatPOST(chatRequest("x".repeat(10_001)));
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: "Query is too long" });

      assert.deepEqual(reached, [], "no embedding or generation call may happen");
    } finally {
      restore();
    }
  });

  it("accepts a query at the boundary, so the guard is a bound and not a blanket rejection", async (t) => {
    if (!isDemoModeEnabled()) { t.skip("KAIROS_DEMO_MODE is not enabled"); return; }

    // A valid-length query for a KB that does not exist must pass the length
    // guard and fail later, on tenancy. A 404 (not 400) proves the request was
    // accepted by the size guard and carried on to the access check.
    const res = await chatPOST(chatRequest("x".repeat(10_000)));
    assert.notEqual(res.status, 400);
    assert.equal(res.status, 404);
  });
});