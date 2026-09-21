// P1-3: the conversation model persisted in the DB must pass the same canonical
// allowlist as the request-supplied model before it can reach the LLM provider.
// Exercised at the real route boundary (POST /api/ai/chat and
// POST /api/ai/conversations) with a demo-mode session:
//   - a forged stored model must never appear in the provider request body
//     (falls back to the provider default),
//   - a valid stored model is honored when the request omits a model,
//   - a forged model body on conversation create is never persisted.
// The OpenAI SDK's chat/completions request is captured via a global fetch stub
// (same pattern as the chat-empty-retrieval suite) so the model that would be
// sent upstream is observable.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { resetAIProviderCache } from "@/lib/ai/providers";
import { PgVectorStore } from "@/lib/vector/store";
import { POST as chatPOST } from "@/app/api/ai/chat/route";
import { POST as createConversationPOST } from "@/app/api/ai/conversations/route";

const DIMS = 1536;
const FIXED_VEC = Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0));

function unitVectorBase64(): string {
  const arr = new Float32Array(DIMS);
  arr[0] = 1;
  return Buffer.from(arr.buffer).toString("base64");
}

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

interface CapturedCall {
  url: string;
  body: Record<string, unknown> | null;
}

function installFetch(calls: CapturedCall[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    let body: Record<string, unknown> | null = null;
    if (init?.body && typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
    }
    calls.push({ url: u, body });
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
      return new Response(
        new ReadableStream({ start(c) { c.enqueue(makeStreamBody("Fixture answer [Source 1].")); c.close(); } }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

if (process.env.NODE_ENV !== "production") {
  process.env.KAIROS_DEMO_MODE = "true";
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
}

describe("stored conversation model allowlist against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const orgAId = randomUUID();
  const orgOwnerA = randomUUID();
  const projAId = randomUUID();
  const kbAId = randomUUID();
  const docAId = randomUUID();
  const chunkAId = randomUUID();

  let client: PrismaClient;
  let demoId: string;
  let calls: CapturedCall[] = [];
  const originalFetch = globalThis.fetch;

  async function postChat(body: Record<string, unknown>) {
    const req = new NextRequest("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return chatPOST(req);
  }

  function chatModelReachingProvider(): string | undefined {
    const hit = calls.find((c) => c.url.includes("/chat/completions"));
    return typeof hit?.body?.model === "string" ? hit.body.model : undefined;
  }

  function requireEnvironment(t: { skip: (message?: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return false;
    }
    if (!isDemoModeEnabled()) {
      t.skip("requires KAIROS_DEMO_MODE=true for the session");
      return false;
    }
    return true;
  }

  before(async () => {
    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();

    demoId = await ensureDemoUser();

    await client.user.create({
      data: { id: orgOwnerA, email: `p13-owner-${randomUUID()}@test.local`, name: "P13 Owner" },
    });
    await client.organization.create({
      data: {
        id: orgAId,
        name: "P13 Org A",
        slug: `p13a-${randomUUID()}`,
        ownerId: orgOwnerA,
      },
    });
    await client.project.create({
      data: { id: projAId, name: "P13 Project A", slug: `p13a-p-${randomUUID()}`, organizationId: orgAId },
    });
    await client.knowledgeBase.create({
      data: { id: kbAId, name: "P13 KB A", projectId: projAId },
    });
    await client.document.create({
      data: { id: docAId, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
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
        { organizationId: orgAId, userId: demoId, role: "ADMIN" },
      ],
    });
    await new PgVectorStore(client).bulkUpsertEmbeddings(
      [{ chunkId: chunkAId, embedding: FIXED_VEC }],
      DIMS,
    );
  });

  after(async () => {
    resetAIProviderCache();
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: orgAId } });
      await client.user.deleteMany({ where: { id: orgOwnerA } });
    } finally {
      await client.$disconnect();
    }
  });

  beforeEach(() => {
    if (!testDbUrl) return;
    calls = [];
    globalThis.fetch = originalFetch;
    installFetch(calls);
    resetAIProviderCache();
  });

  it("never lets a forged stored model reach the provider in the chat route", async (t) => {
    if (!requireEnvironment(t)) return;

    const forgedModel = "l33t/gpt-offbrand-mk2";
    const conv = await client.conversation.create({
      data: {
        title: "Forged stored model",
        model: forgedModel,
        provider: "openai",
        knowledgeBaseId: kbAId,
        userId: demoId,
      },
      select: { id: true },
    });

    try {
      const res = await postChat({ conversationId: conv.id, kbId: kbAId, query: "What does alpha cover?" });
      assert.equal(res.status, 200);
      const sse = await res.text();
      assert.match(sse, /data: \{"type":"done"\}/);

      const received = chatModelReachingProvider();
      assert.ok(received, "the provider endpoint must be reached");
      assert.notEqual(received, forgedModel, "forged stored model must never reach the provider");
      assert.ok(received, "an allowlisted model is used as the fallback");
    } finally {
      await client.conversation.deleteMany({ where: { id: conv.id } });
    }
  });

  it("honors a valid stored model when the request omits a model", async (t) => {
    if (!requireEnvironment(t)) return;

    const conv = await client.conversation.create({
      data: {
        title: "Valid stored model",
        model: "gpt-4o",
        provider: "openai",
        knowledgeBaseId: kbAId,
        userId: demoId,
      },
      select: { id: true },
    });

    try {
      const res = await postChat({ conversationId: conv.id, kbId: kbAId, query: "What does alpha cover?" });
      assert.equal(res.status, 200);
      await res.text();

      assert.equal(chatModelReachingProvider(), "gpt-4o");
    } finally {
      await client.conversation.deleteMany({ where: { id: conv.id } });
    }
  });

  it("rejects a forged request model in favor of the stored allowlisted model", async (t) => {
    if (!requireEnvironment(t)) return;

    const conv = await client.conversation.create({
      data: {
        title: "Valid stored model with forged request",
        model: "gpt-3.5-turbo",
        provider: "openai",
        knowledgeBaseId: kbAId,
        userId: demoId,
      },
      select: { id: true },
    });

    try {
      const res = await postChat({
        conversationId: conv.id,
        kbId: kbAId,
        query: "What does alpha cover?",
        model: "clown/made-up-model",
      });
      assert.equal(res.status, 200);
      await res.text();

      assert.equal(chatModelReachingProvider(), "gpt-3.5-turbo");
    } finally {
      await client.conversation.deleteMany({ where: { id: conv.id } });
    }
  });

  it("never persists a forged model via the conversation-create route", async (t) => {
    if (!requireEnvironment(t)) return;

    const req = new NextRequest("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kbId: kbAId,
        title: "Forged create",
        model: "vibe/magical-9000",
        provider: "openai",
      }),
    });
    const res = await createConversationPOST(req);
    assert.equal(res.status, 200);
    const { conversation } = await res.json();
    assert.ok(conversation?.id, "conversation is created");
    assert.notEqual(conversation.model, "vibe/magical-9000", "forged model must not be persisted");
    assert.equal(conversation.model, "gpt-4o-mini", "default model is stored instead");
    await client.conversation.deleteMany({ where: { id: conversation.id } });
  });

  it("persists an allowlisted model via the conversation-create route", async (t) => {
    if (!requireEnvironment(t)) return;

    const req = new NextRequest("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kbId: kbAId,
        title: "Valid create",
        model: "gpt-4o",
        provider: "openai",
      }),
    });
    const res = await createConversationPOST(req);
    assert.equal(res.status, 200);
    const { conversation } = await res.json();
    assert.ok(conversation?.id);
    assert.equal(conversation.model, "gpt-4o");
    await client.conversation.deleteMany({ where: { id: conversation.id } });
  });
});