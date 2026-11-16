import { randomUUID } from "node:crypto";
import { Prisma, type ProcessingJob, type ProcessingJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processDocument, reconstructTextSourceBuffers, type ProcessOutcome, type StagedSwap } from "@/lib/ingestion/pipeline";

// A worker refreshes `lockedAt` every heartbeat; a job whose lock is older than
// this is treated as abandoned. Using a dedicated lock timestamp instead of
// Document.updatedAt means a slow but healthy pipeline is never misclassified.
export const JOB_STALE_AFTER_MS = 5 * 60 * 1000;
export const JOB_HEARTBEAT_MS = 30 * 1000;
export const DEFAULT_MAX_JOB_ATTEMPTS = 3;

const ACTIVE_JOB_STATUSES: ProcessingJobStatus[] = ["PENDING", "RUNNING"];

export interface ClaimedJob {
  id: string;
  documentId: string;
  attempts: number;
  maxAttempts: number;
  reason: string;
  payload: Prisma.JsonValue | null;
}

interface JobPayload {
  // Non-FILE sources (text/URL/YouTube) have no storage object to re-read on a
  // retry, so the first attempt's bytes travel with the job. URL/YouTube can
  // also be re-fetched by the pipeline if the payload is somehow unavailable.
  content?: string;
  staged?: StagedSwap;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Idempotent: the unique `activeKey` allows at most one PENDING/RUNNING job per
// document, so a double-click or a retried request returns the existing job
// instead of scheduling duplicate work.
export async function enqueueDocumentProcessing(
  documentId: string,
  options: {
    reason?: string;
    payload?: JobPayload;
    maxAttempts?: number;
    runAfter?: Date;
  } = {},
): Promise<{ job: ProcessingJob; created: boolean }> {
  try {
    const job = await prisma.processingJob.create({
      data: {
        documentId,
        activeKey: documentId,
        reason: options.reason ?? "upload",
        maxAttempts: options.maxAttempts ?? DEFAULT_MAX_JOB_ATTEMPTS,
        runAfter: options.runAfter,
        payload: (options.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    return { job, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.processingJob.findUnique({ where: { activeKey: documentId } });
    if (!existing) throw error;
    return { job: existing, created: false };
  }
}

const CLAIMED_JOB_SELECT = {
  id: true,
  documentId: true,
  attempts: true,
  maxAttempts: true,
  reason: true,
  payload: true,
} as const;

// Atomic claim for one specific job (used by the request that just enqueued it).
export async function claimProcessingJob(jobId: string, workerId: string): Promise<ClaimedJob | null> {
  const claimed = await prisma.processingJob.updateMany({
    where: { id: jobId, status: "PENDING", runAfter: { lte: new Date() } },
    data: {
      status: "RUNNING",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return null;
  return prisma.processingJob.findUnique({ where: { id: jobId }, select: CLAIMED_JOB_SELECT });
}

// Atomic claim across workers: FOR UPDATE SKIP LOCKED means two workers polling
// at the same instant can never take the same row.
export async function claimNextProcessingJob(workerId: string): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "ProcessingJob"
    SET status = 'RUNNING',
        "lockedAt" = now(),
        "lockedBy" = ${workerId},
        attempts = attempts + 1,
        "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "ProcessingJob"
      WHERE status = 'PENDING' AND "runAfter" <= now()
      ORDER BY "runAfter" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "documentId", attempts, "maxAttempts", reason, payload
  `;
  return rows[0] ?? null;
}

export async function heartbeatProcessingJob(jobId: string, workerId: string): Promise<void> {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: "RUNNING", lockedBy: workerId },
    data: { lockedAt: new Date() },
  });
}

export async function completeProcessingJob(jobId: string, workerId: string): Promise<void> {
  await prisma.processingJob.updateMany({
    where: { id: jobId, status: "RUNNING", lockedBy: workerId },
    data: {
      status: "COMPLETED",
      activeKey: null,
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
}

// A crashed worker is retried with exponential backoff until maxAttempts. A
// pipeline that reported a deterministic failure (unreadable file, no text) is
// terminal: retrying the same bytes would only delay the honest ERROR state.
// The activeKey is released only when the job is terminal, so a duplicate
// enqueue while retries are pending still joins the same job.
export async function failProcessingJob(
  job: Pick<ClaimedJob, "id" | "attempts" | "maxAttempts">,
  workerId: string,
  error: string,
  retryable = true,
): Promise<"retry" | "failed"> {
  const retry = retryable && job.attempts < job.maxAttempts;
  await prisma.processingJob.updateMany({
    where: { id: job.id, status: "RUNNING", lockedBy: workerId },
    data: retry
      ? {
          status: "PENDING",
          lockedAt: null,
          lockedBy: null,
          lastError: error,
          runAfter: new Date(Date.now() + Math.min(60_000, 1_000 * 2 ** job.attempts)),
        }
      : {
          status: "FAILED",
          activeKey: null,
          lockedAt: null,
          lockedBy: null,
          lastError: error,
          completedAt: new Date(),
        },
  });
  return retry ? "retry" : "failed";
}

async function executeClaimedJob(job: ClaimedJob, workerId: string): Promise<ProcessOutcome> {
  const heartbeat = setInterval(() => {
    heartbeatProcessingJob(job.id, workerId).catch((error) => {
      logger.warn("Processing job heartbeat failed", {
        jobId: job.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }, JOB_HEARTBEAT_MS);

  try {
    const doc = await prisma.document.findUnique({
      where: { id: job.documentId },
      select: { fileType: true, sourceType: true },
    });
    if (!doc) {
      await completeProcessingJob(job.id, workerId);
      return { ok: false, error: "Document not found" };
    }

    const payload = (job.payload ?? {}) as JobPayload;
    // FILE sources are re-read from storage; URL/YouTube/TEXT sources use the
    // snapshot carried by the job (or their stored chunks on a later retry).
    const buffer =
      doc.sourceType === "FILE"
        ? undefined
        : payload.content !== undefined
          ? Buffer.from(payload.content, "utf8")
          : (await reconstructTextSourceBuffers([job.documentId])).get(job.documentId);

    const outcome = await processDocument(job.documentId, doc.fileType, buffer, payload.staged);
    if (outcome.ok) {
      await completeProcessingJob(job.id, workerId);
    } else {
      const state = await failProcessingJob(job, workerId, outcome.error ?? "Processing failed", false);
      logger.warn("Processing job attempt failed", {
        jobId: job.id,
        documentId: job.documentId,
        attempt: job.attempts,
        state,
        error: outcome.error,
      });
    }
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failProcessingJob(job, workerId, message).catch(() => {});
    logger.error("Processing job crashed", { jobId: job.id, documentId: job.documentId, error: message });
    return { ok: false, error: message };
  } finally {
    clearInterval(heartbeat);
  }
}

// Runs the next available job once. Returns false when the queue is empty.
export async function runNextProcessingJob(workerId: string): Promise<boolean> {
  const job = await claimNextProcessingJob(workerId);
  if (!job) return false;
  await executeClaimedJob(job, workerId);
  return true;
}

// Request-side latency optimization: run the job we just enqueued. If this
// process dies mid-run the job stays RUNNING with an expiring lock, and the
// worker/recovery path retries it. Durability never depends on this call.
export async function runProcessingJobNow(jobId: string): Promise<ProcessOutcome | null> {
  const workerId = `inline-${process.pid}-${randomUUID()}`;
  const job = await claimProcessingJob(jobId, workerId);
  if (!job) return null;
  return executeClaimedJob(job, workerId);
}

// The single entry point used by server actions: persist the work, then try to
// finish it before responding. `null` means another worker/request already owns
// this document's job; the document row is then the source of truth.
export async function processDocumentDurably(
  documentId: string,
  options: {
    reason: string;
    buffer?: Buffer;
    staged?: StagedSwap;
    maxAttempts?: number;
  },
): Promise<ProcessOutcome | null> {
  const { job } = await enqueueDocumentProcessing(documentId, {
    reason: options.reason,
    maxAttempts: options.maxAttempts,
    payload: {
      content: options.buffer?.toString("utf8"),
      staged: options.staged,
    },
  });
  return runProcessingJobNow(job.id);
}

// Requeues abandoned jobs and fails the ones that exhausted their attempts.
// Called by the worker loop and by listDocuments so recovery does not require a
// user to open the app.
export async function recoverStaleProcessingJobs(now: Date = new Date()): Promise<{
  requeued: number;
  failed: number;
}> {
  const staleBefore = new Date(now.getTime() - JOB_STALE_AFTER_MS);

  const failed = await prisma.$queryRaw<{ documentId: string }[]>`
    UPDATE "ProcessingJob"
    SET status = 'FAILED',
        "activeKey" = NULL,
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "completedAt" = now(),
        "lastError" = COALESCE("lastError", 'Worker stopped before completion'),
        "updatedAt" = now()
    WHERE status = 'RUNNING'
      AND "lockedAt" < ${staleBefore}
      AND attempts >= "maxAttempts"
    RETURNING "documentId"
  `;

  if (failed.length > 0) {
    const documentIds = failed.map((row) => row.documentId);
    await prisma.$executeRaw`
      UPDATE "Document"
      SET status = 'ERROR',
          "updatedAt" = now(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'stage', 'worker',
            'error', 'Processing stopped before completion. Retry the source.',
            'lastProcessError', 'Processing stopped before completion. Retry the source.'
          )
      WHERE id IN (${Prisma.join(documentIds)})
    `;
  }

  const requeued = await prisma.$executeRaw`
    UPDATE "ProcessingJob"
    SET status = 'PENDING',
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "runAfter" = now(),
        "updatedAt" = now()
    WHERE status = 'RUNNING'
      AND "lockedAt" < ${staleBefore}
      AND attempts < "maxAttempts"
  `;

  return { requeued: Number(requeued), failed: failed.length };
}

export function activeJobStatuses(): ProcessingJobStatus[] {
  return [...ACTIVE_JOB_STATUSES];
}

// listDocuments polls every few seconds from every open tab, so the recovery
// scan is throttled per process instead of running on every call.
const RECOVERY_THROTTLE_MS = 30_000;
let nextRecoveryAt = 0;

export async function maybeRecoverStaleProcessingJobs(now: Date = new Date()): Promise<void> {
  if (Date.now() < nextRecoveryAt) return;
  nextRecoveryAt = Date.now() + RECOVERY_THROTTLE_MS;
  await recoverStaleProcessingJobs(now);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  recoveryIntervalMs?: number;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
}

// Long-running worker loop. Run one process per deployment replica; concurrency
// is bounded by the number of workers because each claims one job at a time.
export async function runProcessingWorker(options: WorkerOptions = {}): Promise<void> {
  const workerId = options.workerId ?? `worker-${process.pid}-${randomUUID()}`;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const recoveryIntervalMs = options.recoveryIntervalMs ?? 30_000;
  let nextRecoveryAt = 0;

  logger.info("Processing worker started", { workerId });

  while (!options.signal?.aborted) {
    try {
      if (Date.now() >= nextRecoveryAt) {
        const recovered = await recoverStaleProcessingJobs();
        if (recovered.requeued > 0 || recovered.failed > 0) {
          logger.info("Recovered stale processing jobs", { workerId, ...recovered });
        }
        nextRecoveryAt = Date.now() + recoveryIntervalMs;
      }

      const worked = await runNextProcessingJob(workerId);
      if (!worked) await sleep(pollIntervalMs);
    } catch (error) {
      options.onError?.(error);
      logger.error("Processing worker iteration failed", {
        workerId,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(pollIntervalMs);
    }
  }

  logger.info("Processing worker stopped", { workerId });
}
