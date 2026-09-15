import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestText, updateTextSource, repointUrlSource, repointYouTubeSource } from "@/lib/actions/document";
import { createConversation, addMessage } from "@/lib/ai/memory/service";
import { createLearningArtifact } from "@/lib/artifacts/persistence";
import { ensureDemoUser } from "@/lib/server/demo-user";

const DIM = 1536;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function unitVectorBase64(hotIndex: number): string {
  const arr = new Float32Array(DIM);
  arr[hotIndex] = 1;
  return Buffer.from(arr.buffer).toString("base64");
}

async function waitForStatus(
  client: PrismaClient,
  docId: string,
  expected: string,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await client.document.findUnique({
      where: { id: docId },
      select: { status: true, metadata: true },
    });
    if (doc && doc.status === expected) return doc;
    if (doc && doc.status === "ERROR") {
      throw new Error(
        `Document reached ERROR instead of ${expected}: ${JSON.stringify(doc.metadata)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for document ${docId} to reach ${expected}`);
}

describe("source mutations and stored snapshots against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];
  const conversationIds: string[] = [];
  const artifactIds: string[] = [];
  const foreignUserIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    await ensureDemoUser();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: unitVectorBase64(0) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!client || !testDbUrl) return;
    try {
      await client.messageCitation.deleteMany({ where: { message: { conversationId: { in: conversationIds } } } });
      await client.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await client.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      await client.learningArtifact.deleteMany({ where: { id: { in: artifactIds } } });
      await client.document.deleteMany({ where: { id: { in: docIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: foreignUserIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function makeKbForDemo(demoUserId: string): Promise<string> {
    const clientRef = client as PrismaClient;
    const orgId = randomUUID();
    const projectId = randomUUID();
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Snapshot Org",
        slug: `snapshot-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Snapshot Project", slug: `snapshot-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Snapshot KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  it("keeps stored MessageCitation and LearningArtifact snapshots intact across a successful source edit", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Snapshot source", content: "Alpha version content for the snapshot test." });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const chunk = await clientRef.documentChunk.findFirst({
      where: { documentId: doc.id },
      select: { id: true, index: true },
    });
    assert.ok(chunk, "a chunk should exist after ingestion");

    // Persist a citation referencing the pre-edit chunk + name.
    const conversation = await createConversation(kbId, demoUser, "Snapshot chat");
    conversationIds.push(conversation.id);
    await addMessage(conversation.id, "assistant", "Here is the answer.", 10, [
      {
        chunkId: chunk!.id,
        documentId: doc.id,
        documentName: "Snapshot source",
        chunkIndex: chunk!.index,
        excerpt: "Alpha version content",
      },
    ]);

    // Persist a learning artifact whose sourceIds reference the source.
    const artifact = await createLearningArtifact({
      knowledgeBaseId: kbId,
      type: "SUMMARY",
      sourceIds: [doc.id],
      status: "COMPLETED",
      name: "Snapshot brief",
      content: { title: "Snapshot source", keyPoints: ["Alpha"] },
      metadata: { promptVersion: "v1" },
      createdById: demoUser,
    });
    artifactIds.push(artifact.id);
    const artifactBefore = {
      sourceIds: artifact.sourceIds,
      content: artifact.content,
      name: artifact.name,
    };

    // Successful mutation: edit the source.
    await updateTextSource(doc.id, { title: "Renamed source", content: "Beta version content for the snapshot test." });
    const settled = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const citation = await clientRef.messageCitation.findFirst({
      where: { messageId: (await clientRef.message.findFirst({ where: { conversationId: conversation.id }, select: { id: true } }))?.id ?? "" },
    });
    assert.ok(citation, "the message citation should still exist");
    assert.equal(citation.documentName, "Snapshot source", "citation name snapshot must not be rewritten");
    assert.equal(citation.chunkId, chunk!.id, "citation chunk snapshot must not be rewritten");
    assert.equal(citation.chunkIndex, chunk!.index, "citation chunk index snapshot must not be rewritten");

    const artifactAfter = await clientRef.learningArtifact.findUnique({
      where: { id: artifact.id },
      select: { sourceIds: true, content: true, name: true },
    });
    assert.ok(artifactAfter);
    assert.deepEqual(
      { sourceIds: artifactAfter.sourceIds, content: artifactAfter.content, name: artifactAfter.name },
      artifactBefore,
      "the artifact snapshot must be byte-for-byte untouched by the source edit",
    );
  });

  it("rejects every mutation action against a source in a knowledge base the user cannot access", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const ownerId = randomUUID();
    const orgId = randomUUID();
    const projectId = randomUUID();
    foreignUserIds.push(ownerId);
    await clientRef.user.create({
      data: { id: ownerId, email: `snapshot-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Snapshot Foreign Org",
        slug: `snapshot-foreign-org-${randomUUID()}`,
        ownerId,
        members: { create: [{ userId: ownerId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Snapshot Foreign Project", slug: `snapshot-foreign-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Snapshot Foreign KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);

    const textDoc = await clientRef.document.create({
      data: {
        name: "Foreign text",
        fileType: "txt",
        sourceType: "TEXT",
        knowledgeBaseId: kb.id,
        sourceUrl: null,
        status: "INDEXED",
        metadata: { source: "text", title: "Foreign text" },
      },
      select: { id: true },
    });
    const urlDoc = await clientRef.document.create({
      data: {
        name: "Foreign URL",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: "https://example.com/foreign",
        knowledgeBaseId: kb.id,
        status: "INDEXED",
        metadata: { source: "url", title: "Foreign URL" },
      },
      select: { id: true },
    });
    const ytDoc = await clientRef.document.create({
      data: {
        name: "Foreign video",
        fileType: "txt",
        sourceType: "YOUTUBE",
        sourceUrl: `https://www.youtube.com/watch?v=AbCdEfGhIjK`,
        knowledgeBaseId: kb.id,
        status: "INDEXED",
        metadata: { source: "youtube", videoId: "AbCdEfGhIjK", title: "Foreign video" },
      },
      select: { id: true },
    });
    docIds.push(textDoc.id, urlDoc.id, ytDoc.id);

    // edit
    await assert.rejects(
      updateTextSource(textDoc.id, { title: "Nope", content: "sneaky text edit" }),
      /Knowledge base not found/,
    );

    // repoint (fetch is attempted only after tenancy passes; if it leaked past
    // the tenancy gate it would also need a mock, so this doubles as a gate test)
    await assert.rejects(
      repointUrlSource(urlDoc.id, "https://example.com/new"),
      /Knowledge base not found/,
    );
    await assert.rejects(
      repointYouTubeSource(ytDoc.id, "https://youtu.be/AbCdEfGhIjK"),
      /Knowledge base not found/,
    );
  });
});