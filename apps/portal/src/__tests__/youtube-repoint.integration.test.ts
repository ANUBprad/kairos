import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { repointYouTubeSource } from "@/lib/actions/document";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { PgVectorStore } from "@/lib/vector/store";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { urlDocumentFileHash, type HttpGetResult, type ResolveHostFn } from "@/lib/ingestion/url";

const DIM = 1536;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function unitVector(hotIndex: number): number[] {
  return Array.from({ length: DIM }, (_, i) => (i === hotIndex ? 1 : 0));
}

function unitVectorBase64(hotIndex: number): string {
  const arr = new Float32Array(DIM);
  arr[hotIndex] = 1;
  return Buffer.from(arr.buffer).toString("base64");
}

const YT_DNS: ResolveHostFn = async (host) => {
  const map: Record<string, string[]> = {
    "www.youtube.com": ["142.250.72.46"],
    "youtube.com": ["142.250.72.46"],
    "youtu.be": ["142.250.72.46"],
  };
  const addrs = map[host];
  if (!addrs) throw new Error(`no such host: ${host}`);
  return addrs;
};

function htmlResponse(body: string, status = 200, contentType = "text/plain"): HttpGetResult {
  const encoder = new TextEncoder();
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

function infoBody(player: unknown, status = "ok"): string {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("player_response", JSON.stringify(player));
  return params.toString();
}

function captionTrack(videoId: string, lang = "en"): { baseUrl: string; languageCode: string; kind: string; name: { simpleText: string } } {
  return {
    baseUrl: `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`,
    languageCode: lang,
    kind: "",
    name: { simpleText: "English" },
  };
}

function transcriptXml(phrases: string[]): string {
  return `<transcript>${phrases
    .map((p, i) => `<text start="${i * 2}" dur="1.5">${p}</text>`)
    .join("")}</transcript>`;
}

const VIDEO_A = "AbCdEfGhIjK";
const VIDEO_B = "LmNoPqRsTuV";
const TEXT_A = "This is the original video transcript body that should be evicted on a repoint.";
const TEXT_B = "This is the replaced video transcript that should be retrieved after a repoint.";
const TIMEDTEXT_A = transcriptXml([TEXT_A]);
const TIMEDTEXT_B = transcriptXml([TEXT_B]);

function ytHttpGetFor(videos: {
  [videoId: string]: { title: string; timedText: string };
}): (url: string) => Promise<HttpGetResult> {
  return async (url: string): Promise<HttpGetResult> => {
    const videoId = url.match(/[?&](?:video_id|v)=([A-Za-z0-9_-]{11})/)?.[1] ?? null;
    const v = videoId ? videos[videoId] : undefined;
    if (!v) throw new Error(`No stub for video ${videoId ?? url}`);
    if (url.includes("get_video_info")) {
      return htmlResponse(
        infoBody({
          captions: { playerCaptionsTracklistRenderer: { captionTracks: [captionTrack(videoId!)] } },
          videoDetails: { videoId, title: v.title },
        }),
        200,
        "application/x-www-form-urlencoded",
      );
    }
    return htmlResponse(v.timedText, 200, "text/xml");
  };
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

describe("YouTube source repointing against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  let embeddingFail = false;
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];
  const foreignUserIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    await ensureDemoUser();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      if (embeddingFail) {
        return new Response("embedding provider unavailable", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: unitVectorBase64(0) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!client || !testDbUrl) return;
    try {
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
        name: "Repoint YT Org",
        slug: `repoint-yt-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Repoint YT Project", slug: `repoint-yt-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Repoint YT KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  async function createYoutubeSource(kbId: string, videoId: string, text: string, title: string): Promise<string> {
    const clientRef = client as PrismaClient;
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const doc = await clientRef.document.create({
      data: {
        name: title,
        fileType: "txt",
        sourceType: "YOUTUBE",
        sourceUrl: canonicalUrl,
        fileHash: urlDocumentFileHash(text),
        size: Buffer.byteLength(text),
        status: "INDEXED",
        knowledgeBaseId: kbId,
        uploadedById: await ensureDemoUser(),
        metadata: {
          mimeType: "text/plain",
          source: "youtube",
          videoId,
          title,
          languageCode: "en",
          autoGenerated: false,
          cueCount: 1,
        },
      },
      select: { id: true },
    });
    docIds.push(doc.id);
    await clientRef.documentChunk.create({
      data: { documentId: doc.id, content: text, index: 0, tokenCount: 10 },
    });
    await generateEmbeddings(doc.id);
    return doc.id;
  }

  it("repoints a YouTube source to a new video and retrieval swaps in the new transcript", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createYoutubeSource(kbId, VIDEO_A, TEXT_A, "First video");
    const canonicalB = `https://www.youtube.com/watch?v=${VIDEO_B}`;

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });

    const httpGet = ytHttpGetFor({ [VIDEO_B]: { title: "Second video", timedText: TIMEDTEXT_B } });
    await repointYouTubeSource(docId, `https://youtu.be/${VIDEO_B}`, {
      resolveHost: YT_DNS,
      httpGet,
    });
    const settled = await waitForStatus(clientRef, docId, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const row = await clientRef.document.findUnique({
      where: { id: docId },
      select: { sourceUrl: true, name: true, fileHash: true, metadata: true },
    });
    assert.equal(row?.sourceUrl, canonicalB);
    assert.equal(row?.name, "Second video");
    assert.equal(row?.fileHash, urlDocumentFileHash(TEXT_B));
    const rowMeta = (row?.metadata ?? {}) as Record<string, unknown>;
    assert.equal(rowMeta.videoId, VIDEO_B);
    assert.equal(rowMeta.title, "Second video");

    const afterChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });
    assert.equal(afterChunks.length, 1);
    assert.equal(afterChunks[0].content, TEXT_B);
    assert.equal(afterChunks.some((c) => c.id === beforeChunks[0].id), false);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].chunkId, afterChunks[0].id);

    const activities = await clientRef.documentActivity.findMany({
      where: { documentId: docId },
      select: { action: true, details: true },
    });
    const updated = activities.find((a) => a.action === "UPDATED");
    assert.ok(updated, "UPDATED activity should exist");
    const details = (updated!.details ?? {}) as Record<string, unknown>;
    assert.equal(details.fromUrl, `https://www.youtube.com/watch?v=${VIDEO_A}`);
    assert.equal(details.toUrl, canonicalB);
  });

  it("rolls back to the full last known-good state on embedding failure", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createYoutubeSource(kbId, VIDEO_A, TEXT_A, "First video");

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });

    const httpGet = ytHttpGetFor({ [VIDEO_B]: { title: "Second video", timedText: TIMEDTEXT_B } });

    try {
      embeddingFail = true;
      await repointYouTubeSource(docId, `https://youtu.be/${VIDEO_B}`, {
        resolveHost: YT_DNS,
        httpGet,
      });
      const settled = await waitForStatus(clientRef, docId, "INDEXED");
      assert.equal(settled.status, "INDEXED");
      const meta = (settled.metadata ?? {}) as Record<string, unknown>;
      assert.equal(meta.retainedPreviousContent, true);

      const row = await clientRef.document.findUnique({
        where: { id: docId },
        select: { sourceUrl: true, name: true, fileHash: true, metadata: true },
      });
      assert.equal(row?.sourceUrl, `https://www.youtube.com/watch?v=${VIDEO_A}`);
      assert.equal(row?.name, "First video");
      assert.equal(row?.fileHash, urlDocumentFileHash(TEXT_A));
      const rowMeta = (row?.metadata ?? {}) as Record<string, unknown>;
      assert.equal(rowMeta.videoId, VIDEO_A);

      const afterChunks = await clientRef.documentChunk.findMany({
        where: { documentId: docId },
        orderBy: { index: "asc" },
        select: { id: true, content: true },
      });
      assert.deepEqual(afterChunks.map((c) => c.content), beforeChunks.map((c) => c.content));

      const store = new PgVectorStore(clientRef);
      const retrieved = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbId],
        topK: 5,
        minSimilarity: 0,
      });
      assert.equal(retrieved.length, 1);
      assert.ok(beforeChunks.some((c) => c.id === retrieved[0].chunkId));
    } finally {
      embeddingFail = false;
    }
  });

  it("rejects fetch failures, same video, duplicate content, non-YouTube sources, and foreign access", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createYoutubeSource(kbId, VIDEO_A, TEXT_A, "First video");

    // Non-YouTube source
    const textDoc = await clientRef.document.create({
      data: {
        name: "Text doc",
        fileType: "txt",
        sourceType: "TEXT",
        knowledgeBaseId: kbId,
        status: "INDEXED",
        metadata: { source: "text", title: "Text doc" },
      },
      select: { id: true },
    });
    docIds.push(textDoc.id);
    await assert.rejects(
      repointYouTubeSource(textDoc.id, `https://youtu.be/${VIDEO_B}`),
      /Only YouTube sources can be repointed/,
    );

    // Same video (needs a working stub so the canonical check is reached)
    const sameHttpGet = ytHttpGetFor({ [VIDEO_A]: { title: "First video", timedText: TIMEDTEXT_A } });
    await assert.rejects(
      repointYouTubeSource(docId, `https://youtu.be/${VIDEO_A}`, { resolveHost: YT_DNS, httpGet: sameHttpGet }),
      /already points to that video/,
    );

    // Fetch failure
    const failHttpGet = async (): Promise<HttpGetResult> => {
      throw new Error("network down");
    };
    await assert.rejects(
      repointYouTubeSource(docId, `https://youtu.be/${VIDEO_B}`, { resolveHost: YT_DNS, httpGet: failHttpGet }),
      /Could not reach YouTube to fetch the transcript/,
    );

    // Duplicate content: another doc already holds VIDEO_B's transcript.
    const dupDoc = await createYoutubeSource(kbId, VIDEO_B, TEXT_B, "Existing video");
    const dupHttpGet = ytHttpGetFor({ [VIDEO_B]: { title: "Second video", timedText: TIMEDTEXT_B } });
    await assert.rejects(
      repointYouTubeSource(docId, `https://youtu.be/${VIDEO_B}`, { resolveHost: YT_DNS, httpGet: dupHttpGet }),
      /This video is a duplicate of "Existing video" \(same content\)/,
    );
    // Reset the original to a clean reprocessable state for the next assertions.
    await clientRef.document.update({ where: { id: docId }, data: { status: "INDEXED" } });

    // Foreign KB
    const foreignOwnerId = randomUUID();
    const foreignOrgId = randomUUID();
    foreignUserIds.push(foreignOwnerId);
    await clientRef.user.create({
      data: { id: foreignOwnerId, email: `repoint-yt-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await clientRef.organization.create({
      data: {
        id: foreignOrgId,
        name: "Foreign YT Org",
        slug: `repoint-yt-foreign-org-${randomUUID()}`,
        ownerId: foreignOwnerId,
        members: { create: [{ userId: foreignOwnerId, role: "OWNER" }] },
      },
    });
    const foreignProjectId = randomUUID();
    await clientRef.project.create({
      data: { id: foreignProjectId, name: "Foreign YT Project", slug: `repoint-yt-foreign-proj-${randomUUID()}`, organizationId: foreignOrgId },
    });
    const foreignKb = await clientRef.knowledgeBase.create({
      data: { name: "Foreign YT KB", projectId: foreignProjectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(foreignOrgId);
    projectIds.push(foreignProjectId);
    kbIds.push(foreignKb.id);

    const foreignDoc = await clientRef.document.create({
      data: {
        name: "Foreign video",
        fileType: "txt",
        sourceType: "YOUTUBE",
        sourceUrl: `https://www.youtube.com/watch?v=${VIDEO_A}`,
        knowledgeBaseId: foreignKb.id,
        status: "INDEXED",
        metadata: { source: "youtube", videoId: VIDEO_A, title: "Foreign video" },
      },
      select: { id: true },
    });
    docIds.push(foreignDoc.id);
    const foreignHttpGet = ytHttpGetFor({ [VIDEO_B]: { title: "Second video", timedText: TIMEDTEXT_B } });
    await assert.rejects(
      repointYouTubeSource(foreignDoc.id, `https://youtu.be/${VIDEO_B}`, { resolveHost: YT_DNS, httpGet: foreignHttpGet }),
      /Knowledge base not found/,
    );
  });
});