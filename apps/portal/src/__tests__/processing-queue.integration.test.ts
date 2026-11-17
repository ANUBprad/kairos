import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  JOB_STALE_AFTER_MS,
  claimNextProcessingJob,
  claimProcessingJob,
  completeProcessingJob,
  enqueueDocumentProcessing,
  failProcessingJob,
  recoverStaleProcessingJobs,
  runProcessingJobNow,
} from "@/lib/ingestion/queue";
import { recoverStaleEmbeddingDocuments } from "@/lib/ai/embeddings";
import { ensureDemoUser } from "@/lib/server/demo-user";

// Durable-processing guarantees against a real Postgres: a job row alone is
// enough to finish the work, duplicate requests share one job, claims are
// atomic, crashed workers are retried, and exhausted jobs fail honestly.

const DIM = 768;

function unitVector(hotIndex: number): number[] {
  return Array.from({ length: DIM }, (_, i) => (i === hotIndex ? 1 : 0));
}

describe("durable processing queue against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  let demoUserId = "";
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();
    demoUserId = await ensureDemoUser();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ embedding: { values: unitVector(0) } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!client || !testDbUrl) return;
    try {
      await client.document.deleteMany({ where: { id: { in: docIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function makeKb(): Promise<string> {
    const clientRef = client as PrismaClient;
    const orgId = randomUUID();
    const projectId = randomUUID();
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Queue Org",
        slug: `queue-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: {
        id: projectId,
        name: "Queue Project",
        slug: `queue-proj-${randomUUID()}`,
        organizationId: orgId,
      },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Queue KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  async function makeTextDoc(status: "STORED" | "EMBEDDING" = "STORED") {
    const clientRef = client as PrismaClient;
    const kbId = await makeKb();
    const doc = await clientRef.document.create({
      data: {
        name: `queued-${randomUUID()}.txt`,
        fileType: "txt",
        size: 10,
        sourceType: "TEXT",
        status,
        knowledgeBaseId: kbId,
        uploadedById: demoUserId,
        metadata: { source: "text" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);
    return doc.id;
  }

  it("finishes work from the job row alone, without the original request", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();

    // This is exactly what a request leaves behind before it dies: a document
    // plus a PENDING job that carries the snapshot bytes.
    const { job, created } = await enqueueDocumentProcessing(docId, {
      reason: "text",
      payload: { content: "Durable processing keeps this content across restarts." },
    });
    assert.equal(created, true);
    assert.equal(job.status, "PENDING");
    const docAfterEnqueue = await clientRef.document.findUnique({ where: { id: docId }, select: { status: true } });
    assert.equal(docAfterEnqueue?.status, "STORED", "enqueue must not process inline");

    // A worker process that starts later claims and finishes the same job.
    const outcome = await runProcessingJobNow(job.id);
    assert.equal(outcome?.ok, true, `pipeline failed: ${outcome?.error}`);

    const doc = await clientRef.document.findUnique({ where: { id: docId }, select: { status: true } });
    assert.equal(doc?.status, "INDEXED");
    assert.ok((await clientRef.documentChunk.count({ where: { documentId: docId } })) > 0);

    const finished = await clientRef.processingJob.findUnique({ where: { id: job.id } });
    assert.equal(finished?.status, "COMPLETED");
    assert.equal(finished?.activeKey, null, "terminal jobs release the active slot");
  });

  it("joins a duplicate enqueue to the same active job", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();

    const first = await enqueueDocumentProcessing(docId, { reason: "upload" });
    const second = await enqueueDocumentProcessing(docId, { reason: "upload" });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.job.id, first.job.id);
    assert.equal(await clientRef.processingJob.count({ where: { documentId: docId } }), 1);

    // Cleanup so the claim test starts from a known queue state.
    await clientRef.processingJob.delete({ where: { id: first.job.id } });
  });

  it("claims atomically: one document job is only ever taken once", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();
    const { job } = await enqueueDocumentProcessing(docId, { reason: "upload" });

    const [a, b] = await Promise.all([
      claimProcessingJob(job.id, "worker-a"),
      claimProcessingJob(job.id, "worker-b"),
    ]);
    const winners = [a, b].filter((claimed) => claimed !== null);
    assert.equal(winners.length, 1, "exactly one claimant may win");
    assert.equal(winners[0]?.documentId, docId);
    const row = await clientRef.processingJob.findUnique({ where: { id: job.id } });
    assert.equal(row?.attempts, 1, "only the winning claim increments attempts");

    await clientRef.processingJob.delete({ where: { id: job.id } });
  });

  it("never hands the same job to two claimNext calls", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();
    const { job } = await enqueueDocumentProcessing(docId, {
      reason: "upload",
      // Oldest row in the queue, so the first claim is deterministic.
      runAfter: new Date(Date.now() - JOB_STALE_AFTER_MS),
    });

    const first = await claimNextProcessingJob("worker-a");
    assert.equal(first?.id, job.id);
    const second = await claimNextProcessingJob("worker-b");
    assert.notEqual(second?.id, job.id, "a RUNNING job must not be claimable again");

    await completeProcessingJob(job.id, "worker-a");
    await clientRef.processingJob.delete({ where: { id: job.id } });
  });

  it("requeues a crashed worker's job and retries it", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();
    const { job } = await enqueueDocumentProcessing(docId, {
      reason: "upload",
      payload: { content: "Content survives a crashed worker." },
    });
    const claimed = await claimProcessingJob(job.id, "worker-that-died");
    assert.ok(claimed);

    // Simulate the process disappearing without a heartbeat.
    await clientRef.processingJob.update({
      where: { id: job.id },
      data: { lockedAt: new Date(Date.now() - JOB_STALE_AFTER_MS - 60_000) },
    });

    const recovered = await recoverStaleProcessingJobs();
    assert.ok(recovered.requeued >= 1);

    const requeued = await clientRef.processingJob.findUnique({ where: { id: job.id } });
    assert.equal(requeued?.status, "PENDING");
    assert.equal(requeued?.lockedAt, null);
    assert.equal(requeued?.activeKey, docId, "the active slot is retained while retrying");

    const outcome = await runProcessingJobNow(job.id);
    assert.equal(outcome?.ok, true, `retry failed: ${outcome?.error}`);
    const doc = await clientRef.document.findUnique({ where: { id: docId }, select: { status: true } });
    assert.equal(doc?.status, "INDEXED");
  });

  it("fails a job that exhausted its attempts and marks the document ERROR", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();
    const { job } = await enqueueDocumentProcessing(docId, { reason: "upload", maxAttempts: 1 });
    assert.ok(await claimProcessingJob(job.id, "worker-doomed"));
    await clientRef.processingJob.update({
      where: { id: job.id },
      data: { lockedAt: new Date(Date.now() - JOB_STALE_AFTER_MS - 60_000) },
    });

    const recovered = await recoverStaleProcessingJobs();
    assert.ok(recovered.failed >= 1);

    const failed = await clientRef.processingJob.findUnique({ where: { id: job.id } });
    assert.equal(failed?.status, "FAILED");
    assert.equal(failed?.activeKey, null);
    assert.ok(failed?.lastError);

    const doc = await clientRef.document.findUnique({ where: { id: docId }, select: { status: true, metadata: true } });
    assert.equal(doc?.status, "ERROR");
    assert.match(String((doc?.metadata as Record<string, unknown>)?.error), /Retry the source/);

    // A terminal job releases the document so the user's Retry can enqueue again.
    const retry = await enqueueDocumentProcessing(docId, { reason: "reprocess" });
    assert.equal(retry.created, true);
    await clientRef.processingJob.delete({ where: { id: retry.job.id } });
  });

  it("treats a reported pipeline failure as terminal instead of retrying the same bytes", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc();
    const { job } = await enqueueDocumentProcessing(docId, { reason: "upload", maxAttempts: 3 });
    const claimed = await claimProcessingJob(job.id, "worker-a");
    assert.ok(claimed);

    const state = await failProcessingJob(claimed!, "worker-a", "No readable text was extracted", false);
    assert.equal(state, "failed");
    const row = await clientRef.processingJob.findUnique({ where: { id: job.id } });
    assert.equal(row?.status, "FAILED");
    assert.equal(row?.activeKey, null);
  });

  it("does not let embedding recovery overwrite a document with an active job", async (t) => {
    if (!testDbUrl) return t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
    const clientRef = client as PrismaClient;
    const docId = await makeTextDoc("EMBEDDING");
    await clientRef.document.update({
      where: { id: docId },
      data: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const { job } = await enqueueDocumentProcessing(docId, { reason: "upload" });

    const doc = await clientRef.document.findUnique({ where: { id: docId }, select: { knowledgeBaseId: true } });
    const recovered = await recoverStaleEmbeddingDocuments(
      doc!.knowledgeBaseId,
      new Date(Date.now() - 30 * 60 * 1000),
    );
    assert.equal(recovered, 0);
    const after = await clientRef.document.findUnique({ where: { id: docId }, select: { status: true } });
    assert.equal(after?.status, "EMBEDDING");

    await clientRef.processingJob.delete({ where: { id: job.id } });
  });
});
