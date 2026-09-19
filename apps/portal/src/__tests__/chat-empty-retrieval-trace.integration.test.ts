// P0 hardening for the Core chat loop:
// - P0-3: zero usable retrieved chunks must be a hard generation gate — the
//   LLM is never called and a deterministic no-results answer is returned.
// - P0-4: every chat turn must produce an org-scoped observability Trace with
//   meaningful spans, covering success, empty-retrieval rejection and failure.
// The LLM/embedding network is replaced with a global fetch stub so "never
// called" is provable: the empty-retrieval turn must never POST to the
// chat/completions endpoint.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { streamChatResponse, generateChatResponse } from "@/lib/ai/chat";
import { filterUsableChunks } from "@/lib/ai/chat/engine";
import { resetAIProviderCache } from "@/lib/ai/providers";
import { createConversation, getConversation } from "@/lib/ai/memory";
import { getTraceById } from "@/lib/observability/trace-explorer";
import { PgVectorStore } from "@/lib/vector/store";
import { EMPTY_RETRIEVAL_TEXT, GENERATION_FAILED_TEXT } from "@/lib/ai/chat/stream-markers";

const DIMS = 1536;
const FIXED_VEC = Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0));
// The OpenAI SDK decodes embeddings as base64 float32 when the provider stub
// answers /embeddings, matching the established stub pattern in the
// text-source and artifact-generation suites.
function unitVectorBase64(): string {
  const arr = new Float32Array(DIMS);
  arr[0] = 1;
  return Buffer.from(arr.buffer).toString("base64");
}

function nopRetainedChunk(content: string) {
  return {
    id: randomUUID(),
    content,
    index: 0,
    tokenCount: 1,
    documentId: "doc-1",
    documentName: "test.pdf",
    similarity: 0.9,
    pageNumber: null,
    metadata: null,
  };
}

describe("filterUsableChunks pure gate helper", () => {
  it("treats empty, whitespace-only and mixed-in-empty chunks as unusable", () => {
    assert.equal(filterUsableChunks([nopRetainedChunk("")]).length, 0);
    assert.equal(filterUsableChunks([nopRetainedChunk("   ")]).length, 0);
    assert.equal(filterUsableChunks([nopRetainedChunk("\n\t ")]).length, 0);
    assert.equal(filterUsableChunks([nopRetainedChunk(""), nopRetainedChunk("real content")]).length, 1);
    assert.equal(filterUsableChunks([nopRetainedChunk("  "), nopRetainedChunk(" x ")]).length, 1);
  });
});

function makeStreamBody(content: string): Uint8Array {
  const encoder = new TextEncoder();
  const parts = [
    `data: {"id":"cmpl","object":"chat.completion.chunk","created":0,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n`,
    `data: {"id":"cmpl","object":"chat.completion.chunk","created":0,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"${content}"},"finish_reason":null}]}\n\n`,
    `data: {"id":"cmpl","object":"chat.completion.chunk","created":0,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
    `data: [DONE]\n\n`,
  ].join("");
  return encoder.encode(parts);
}

// Replaces global fetch: embeddings return FIXED_VEC (identical to the stored
// vector so the KB chunk always matches with similarity 1); chat/completions
// stream a canned answer or throw in failChat mode. Every call URL is recorded
// so tests can prove whether the generation endpoint was reached.
function installFetch(
  behavior: { failChat?: boolean } = {},
  calls: string[] = [],
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("/embeddings")) {
      return new Response(
        JSON.stringify({
          data: [{ object: "embedding", index: 0, embedding: unitVectorBase64() }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.includes("/chat/completions")) {
      if (behavior.failChat) throw new Error("stub chat failure");
      return new Response(
        new ReadableStream({ start(c) { c.enqueue(makeStreamBody("Fixture answer [Source 1].")); c.close(); } }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

describe("chat empty-retrieval gate and per-turn traces against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  // Each test installs its own fetch stub; clear the provider cache first so a
  // cached OpenAI client built against a previous test's stub is never reused.
  beforeEach(() => resetAIProviderCache());
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbEmptyAId = randomUUID();
  const kbBId = randomUUID();
  const docAId = randomUUID();
  const chunkAId = randomUUID();

  let client: PrismaClient;

  // The Trace PK is server-generated; resolve the row by the unique requestId
  // we hand the engine, including spans/events for field assertions.
  async function readTrace(requestId: string) {
    return client.trace.findUnique({
      where: { requestId },
      include: { spans: true, events: true },
    });
  }

  before(async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";

    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `chat-trace-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `chat-trace-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: orgOwnerA, email: `chat-trace-oa-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `chat-trace-ob-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Trace Org A", slug: `tracea-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Trace Org B", slug: `traceb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Trace Project A", slug: `tracea-p-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Trace Project B", slug: `traceb-p-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "Trace KB A (has context)", projectId: projAId },
        { id: kbEmptyAId, name: "Trace KB A (empty)", projectId: projAId },
        { id: kbBId, name: "Trace KB B", projectId: projBId },
      ],
    });

    await client.document.createMany({
      data: [
        { id: docAId, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: randomUUID(), name: "empty.pdf", fileType: "pdf", knowledgeBaseId: kbEmptyAId, status: "INDEXED" },
      ],
    });

    await client.documentChunk.create({
      data: {
        id: chunkAId,
        documentId: docAId,
        content: "Alpha covers onboarding steps.",
        index: 0,
        tokenCount: 5,
        metadata: { pageNumber: 1 },
      },
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
        { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
        { organizationId: orgBId, userId: bobId, role: "MEMBER" },
      ],
    });

    await new PgVectorStore(client).bulkUpsertEmbeddings(
      [{ chunkId: chunkAId, embedding: FIXED_VEC }],
      DIMS,
    );
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, orgOwnerA, orgOwnerB] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("a normal turn persists the answer with citations and leaves an OK trace with retrieval and generation spans", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const calls: string[] = [];
    const restore = installFetch({}, calls);
    try {
      const conv = await createConversation(kbAId, aliceId, "Trace me");
      const requestId = randomUUID();
      const out: string[] = [];

      for await (const chunk of streamChatResponse({
        conversationId: conv.id,
        kbId: kbAId,
        query: "What covers alpha?",
        providerType: "openai",
        trace: { requestId, organizationId: orgAId, userId: aliceId },
      })) {
        if (chunk.content) out.push(chunk.content);
      }

      assert.deepEqual(out, ["Fixture answer [Source 1]."]);
      assert.ok(calls.some((u) => u.includes("/chat/completions")), "generation must reach chat completions");

      const trace = await readTrace(requestId);
      assert.ok(trace, "a normal turn must leave a Trace");
      assert.equal(trace!.name, "chat.generate");
      assert.equal(trace!.status, "OK");
      assert.equal(trace!.organizationId, orgAId);
      assert.equal(trace!.userId, aliceId);
      assert.equal(trace!.provider, "openai");
      assert.deepEqual(
        trace!.spans.map((s) => s.name).sort(),
        ["chat.generation", "chat.retrieval"],
      );

      const meta = trace!.metadata as unknown as { knowledgeBaseId: string; conversationId: string } | null;
      assert.equal(meta?.knowledgeBaseId, kbAId);
      assert.equal(meta?.conversationId, conv.id);

      const read = await getConversation(conv.id);
      const [user, assistant] = read!.messages;
      assert.equal(user.content, "What covers alpha?");
      assert.equal(assistant.content, "Fixture answer [Source 1].");
      assert.equal(assistant.citations?.length, 1);
      assert.equal(assistant.citations![0].documentId, docAId);
    } finally {
      restore();
    }
  });

  it("zero retrieval chunks never call the LLM and yield the deterministic no-results answer with a Trace", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const calls: string[] = [];
    const restore = installFetch({}, calls);
    try {
      const conv = await createConversation(kbEmptyAId, aliceId, "Empty kb");
      const requestId = randomUUID();
      const out: string[] = [];

      for await (const chunk of streamChatResponse({
        conversationId: conv.id,
        kbId: kbEmptyAId,
        query: "anything at all",
        providerType: "openai",
        trace: { requestId, organizationId: orgAId, userId: aliceId },
      })) {
        if (chunk.content) out.push(chunk.content);
      }

      assert.deepEqual(out, [EMPTY_RETRIEVAL_TEXT]);
      assert.ok(calls.some((u) => u.includes("/embeddings")), "retrieval must still run");
      assert.ok(
        !calls.some((u) => u.includes("/chat/completions")),
        "the LLM must never be invoked on empty retrieval",
      );

      const read = await getConversation(conv.id);
      const [user, assistant] = read!.messages;
      assert.equal(user.content, "anything at all");
      assert.equal(assistant.content, EMPTY_RETRIEVAL_TEXT);
      assert.equal(assistant.citations, undefined, "no fabricated citations on empty retrieval");

      const trace = await readTrace(requestId);
      assert.ok(trace, "an empty-retrieval turn must still leave a Trace");
      assert.equal(trace!.name, "chat.generate");
      assert.equal(trace!.status, "OK");
      assert.deepEqual(trace!.spans.map((s) => s.name), ["chat.retrieval"]);
      assert.ok(
        trace!.events.some((e) => e.name === "chat.empty_retrieval"),
        "the trace must record that retrieval was empty",
      );
    } finally {
      restore();
    }
  });

  it("the non-stream generation entry point applies the same gate", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const calls: string[] = [];
    const restore = installFetch({}, calls);
    try {
      const conv = await createConversation(kbEmptyAId, aliceId, "Non-stream gate");
      const requestId = randomUUID();

      const response = await generateChatResponse({
        conversationId: conv.id,
        kbId: kbEmptyAId,
        query: "no context",
        providerType: "openai",
        trace: { requestId, organizationId: orgAId, userId: aliceId },
      });

      assert.equal(response.content, EMPTY_RETRIEVAL_TEXT);
      assert.deepEqual(response.citations, []);
      assert.ok(!calls.some((u) => u.includes("/chat/completions")));

      const trace = await readTrace(requestId);
      assert.equal(trace?.status, "OK");
      assert.ok(trace?.events.some((e) => e.name === "chat.empty_retrieval"));
    } finally {
      restore();
    }
  });

  it("a generation failure persists the failure marker and ends the trace as ERROR", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const calls: string[] = [];
    const restore = installFetch({ failChat: true }, calls);
    try {
      const conv = await createConversation(kbAId, aliceId, "Failing turn");
      const requestId = randomUUID();

      // The SDK wraps the transport failure (here "stub chat failure") into a
      // connection error after retries, so assert that the stream rejects with
      // *some* Error and verify the observable outcome below: the failure
      // marker was persisted and the trace ended as ERROR.
      await assert.rejects(
        async () => {
          for await (const _ of streamChatResponse({
            conversationId: conv.id,
            kbId: kbAId,
            query: "will fail",
            providerType: "openai",
            trace: { requestId, organizationId: orgAId, userId: aliceId },
          })) {
            // drain
          }
        },
        (err: unknown) => err instanceof Error,
      );

      const read = await getConversation(conv.id);
      const assistant = read!.messages.find((m) => m.role === "assistant");
      assert.equal(assistant?.content, GENERATION_FAILED_TEXT);

      const trace = await readTrace(requestId);
      assert.ok(trace, "a failing turn must still leave a Trace");
      assert.equal(trace!.status, "ERROR");
    } finally {
      restore();
    }
  });

  it("traces are scoped to the KB's org and a foreign org cannot read them", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const calls: string[] = [];
    const restore = installFetch({}, calls);
    try {
      const conv = await createConversation(kbEmptyAId, aliceId, "Tenancy");
      const requestId = randomUUID();

      for await (const _ of streamChatResponse({
        conversationId: conv.id,
        kbId: kbEmptyAId,
        query: "tenancy probe",
        providerType: "openai",
        trace: { requestId, organizationId: orgAId, userId: aliceId },
      })) {
        // drain
      }

      const byRequestId = await readTrace(requestId);
      assert.ok(byRequestId, "the KB's org must read the trace");
      assert.equal(byRequestId.organizationId, orgAId);
      assert.equal(
        (byRequestId.metadata as unknown as { knowledgeBaseId: string } | null)?.knowledgeBaseId,
        kbEmptyAId,
      );

      const ownerRead = await getTraceById(byRequestId.id, orgAId);
      assert.ok(ownerRead, "the owner org's getTraceById read must succeed");
      const foreignRead = await getTraceById(byRequestId.id, orgBId);
      assert.equal(foreignRead, null, "a foreign org must not read the trace");
    } finally {
      restore();
    }
  });
});