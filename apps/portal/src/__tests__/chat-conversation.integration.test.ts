import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { canAccessKnowledgeBase, canUseConversationInKb } from "@/lib/ai/chat/access";
import { filterScopedSourceIds } from "@/lib/ai/chat/source-scope";
import {
  createConversation,
  getConversation,
  listConversations,
  getConversationMessages,
  addMessage,
  deleteConversation,
  updateConversationTitle,
} from "@/lib/ai/memory";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("chat conversations against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const caraId = randomUUID();
  const strangerId = randomUUID();
  const orgOwnerA = randomUUID();
  const orgOwnerB = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const projAId = randomUUID();
  const projBId = randomUUID();
  const kbAId = randomUUID();
  const kbBId = randomUUID();
  const docA1Id = randomUUID();
  const docA2Id = randomUUID();
  const docB1Id = randomUUID();

  let client: PrismaClient;

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.createMany({
      data: [
        { id: aliceId, email: `chat-alice-${randomUUID()}@test.local`, name: "Alice" },
        { id: bobId, email: `chat-bob-${randomUUID()}@test.local`, name: "Bob" },
        { id: caraId, email: `chat-cara-${randomUUID()}@test.local`, name: "Cara" },
        { id: strangerId, email: `chat-stranger-${randomUUID()}@test.local`, name: "Stranger" },
        { id: orgOwnerA, email: `chat-owner-a-${randomUUID()}@test.local`, name: "Owner A" },
        { id: orgOwnerB, email: `chat-owner-b-${randomUUID()}@test.local`, name: "Owner B" },
      ],
    });

    await client.organization.createMany({
      data: [
        { id: orgAId, name: "Org A", slug: `chata-${randomUUID()}`, ownerId: orgOwnerA },
        { id: orgBId, name: "Org B", slug: `chatb-${randomUUID()}`, ownerId: orgOwnerB },
      ],
    });

    await client.project.createMany({
      data: [
        { id: projAId, name: "Project A", slug: `chata-proj-${randomUUID()}`, organizationId: orgAId },
        { id: projBId, name: "Project B", slug: `chatb-proj-${randomUUID()}`, organizationId: orgBId },
      ],
    });

    await client.knowledgeBase.createMany({
      data: [
        { id: kbAId, name: "KB A", projectId: projAId },
        { id: kbBId, name: "KB B", projectId: projBId },
      ],
    });

    await client.document.createMany({
      data: [
        { id: docA1Id, name: "alpha.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docA2Id, name: "beta.pdf", fileType: "pdf", knowledgeBaseId: kbAId, status: "INDEXED" },
        { id: docB1Id, name: "gamma.md", fileType: "md", knowledgeBaseId: kbBId, status: "INDEXED" },
      ],
    });

    await client.member.createMany({
      data: [
        { organizationId: orgAId, userId: orgOwnerA, role: "OWNER" },
        { organizationId: orgBId, userId: orgOwnerB, role: "OWNER" },
        { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
        { organizationId: orgBId, userId: bobId, role: "MEMBER" },
        { organizationId: orgAId, userId: caraId, role: "MEMBER" },
        { organizationId: orgBId, userId: caraId, role: "MEMBER" },
      ],
    });
  });

  after(async () => {
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
      await client.user.deleteMany({
        where: { id: { in: [aliceId, bobId, caraId, strangerId, orgOwnerA, orgOwnerB] } },
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("members can access their own org's KB; foreign KBs are denied without leaking existence", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    assert.equal(await canAccessKnowledgeBase(aliceId, kbAId), true);
    assert.equal(await canAccessKnowledgeBase(bobId, kbBId), true);
    assert.equal(await canAccessKnowledgeBase(caraId, kbAId), true);
    assert.equal(await canAccessKnowledgeBase(aliceId, kbBId), false);
    assert.equal(await canAccessKnowledgeBase(bobId, kbAId), false);
    assert.equal(await canAccessKnowledgeBase(strangerId, kbAId), false);
    assert.equal(await canAccessKnowledgeBase(aliceId, randomUUID()), false);
  });

  it("a conversation only resolves for its owner inside its own KB (streaming-time guard)", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const conv = await createConversation(kbAId, aliceId, "Alice's thread");
    const full = await getConversation(conv.id);
    assert.equal(canUseConversationInKb(full, aliceId, kbAId), true);
    assert.equal(canUseConversationInKb({ userId: bobId, knowledgeBaseId: kbAId }, aliceId, kbAId), false);
    assert.equal(canUseConversationInKb(full, aliceId, kbBId), false);
    assert.equal(canUseConversationInKb(null, aliceId, kbAId), false);
  });

  it("conversations persist and list only the owner's rows for a KB", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const title = "Persist me";
    const conv = await createConversation(kbAId, aliceId, title);

    const listed = await listConversations(kbAId, aliceId);
    assert.ok(listed.some((c) => c.id === conv.id && c.title === title));
    assert.deepEqual(await listConversations(kbAId, bobId), []);

    const read = await getConversation(conv.id);
    assert.equal(read?.userId, aliceId);
    assert.equal(read?.knowledgeBaseId, kbAId);
    assert.equal(read?.messages.length, 0);
  });

  it("cross-org writes are impossible: foreign rename fails, foreign delete is a no-op", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const conv = await createConversation(kbAId, aliceId, "Original title");

    await assert.rejects(updateConversationTitle(conv.id, "Hacked by Bob", bobId));

    await deleteConversation(conv.id, bobId);
    const stillThere = await getConversation(conv.id);
    assert.ok(stillThere, "foreign delete must not remove the conversation");
    assert.equal(stillThere.title, "Original title");

    await updateConversationTitle(conv.id, "Renamed by Alice", aliceId);
    assert.equal((await getConversation(conv.id))?.title, "Renamed by Alice");
  });

  it("switching the selected org swaps the visible conversation set with no leakage", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const inA = await createConversation(kbAId, caraId, "From org A");
    const inB = await createConversation(kbBId, caraId, "From org B");

    const seenFromA = await listConversations(kbAId, caraId);
    assert.ok(seenFromA.some((c) => c.id === inA.id));
    assert.ok(!seenFromA.some((c) => c.id === inB.id), "org B conversation must not appear under org A");

    const seenFromB = await listConversations(kbBId, caraId);
    assert.ok(seenFromB.some((c) => c.id === inB.id));
    assert.ok(!seenFromB.some((c) => c.id === inA.id), "org A conversation must not appear under org B");

    assert.equal((await getConversation(inB.id))?.knowledgeBaseId, kbBId);
    assert.equal(await canAccessKnowledgeBase(caraId, kbAId), true);
  });

  it("source scope keeps only the caller's KB documents; foreign ids drop to all-sources fallback", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const owned = await client.document.findMany({
      where: { knowledgeBaseId: kbAId, status: "INDEXED", id: { in: [docA1Id, docA2Id, docB1Id] } },
      select: { id: true },
    });
    const ownedIds = owned.map((d) => d.id);

    assert.deepEqual(filterScopedSourceIds([docA1Id, docB1Id], ownedIds), [docA1Id]);
    assert.equal(filterScopedSourceIds([docB1Id], ownedIds), undefined);
  });

  it("messages persist in order with role and content", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const conv = await createConversation(kbAId, aliceId, "Message flow");
    await addMessage(conv.id, "user", "What is in alpha.pdf?", 12);
    await addMessage(conv.id, "assistant", "The alpha document covers onboarding.", 40);

    const read = await getConversation(conv.id);
    assert.deepEqual(
      read?.messages.map((m) => ({ role: m.role, content: m.content })),
      [
        { role: "user", content: "What is in alpha.pdf?" },
        { role: "assistant", content: "The alpha document covers onboarding." },
      ],
    );
    assert.deepEqual(
      await getConversationMessages(conv.id),
      [
        { role: "user", content: "What is in alpha.pdf?" },
        { role: "assistant", content: "The alpha document covers onboarding." },
      ],
    );
  });

  it("citations written at stream time survive readback on reload", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const conv = await createConversation(kbAId, aliceId, "Cited answer");
    await addMessage(conv.id, "user", "Summarize alpha.", 8);
    await addMessage(
      conv.id,
      "assistant",
      "Alpha covers onboarding (Source 1) and beta covers metrics (Source 2).",
      50,
      [
        {
          chunkId: "chunk-1",
          documentId: docA1Id,
          documentName: "alpha.pdf",
          chunkIndex: 0,
          pageNumber: 2,
          excerpt: "onboarding steps",
          similarity: 0.91,
        },
        {
          chunkId: "chunk-2",
          documentId: docA2Id,
          documentName: "beta.pdf",
          chunkIndex: 3,
          excerpt: "metrics dashboard",
          similarity: 0.77,
        },
      ],
    );

    const read = await getConversation(conv.id);
    const [user, assistant] = read!.messages;

    assert.equal(user.citations, undefined, "user messages never carry citations");

    const citations = assistant.citations!;
    assert.equal(citations.length, 2);
    assert.deepEqual(
      citations.map((c) => ({ documentId: c.documentId, documentName: c.documentName, chunkIndex: c.chunkIndex })),
      [
        { documentId: docA1Id, documentName: "alpha.pdf", chunkIndex: 0 },
        { documentId: docA2Id, documentName: "beta.pdf", chunkIndex: 3 },
      ],
    );
    assert.equal(citations[0].pageNumber, 2);
    assert.equal(citations[0].excerpt, "onboarding steps");
    assert.equal(citations[0].similarity, 0.91);
    assert.equal(citations[1].pageNumber, null);
  });
});