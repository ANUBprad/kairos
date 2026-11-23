import type { Prisma } from "../generated/prisma/client.js";
import prisma from "./db.js";
import { logger } from "./logger.js";
import { refundChargeInTransaction } from "../services/credit.services.js";
import { markArtifactFailedIfEligible } from "../repository/artifact.repository.js";

export type DurableJobType = "source.process" | "artifact.generate";

export interface DurableJobInput {
    /** Deterministic unique key, e.g. `artifact-generate:${artifactId}`. */
    key: string;
    type: DurableJobType;
    payload: Record<string, unknown>;
    maxAttempts?: number;
    availableAt?: Date;
}

export type DurableJobStatus = "PENDING" | "PROCESSING" | "DELIVERED" | "DEAD";

export interface DurableJobRow {
    key: string;
    type: string;
    payload: unknown;
    status: DurableJobStatus;
    attempts: number;
    maxAttempts: number;
    availableAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
    deliveredAt?: Date | null;
    lastError?: string | null;
}

/**
 * Structural view of the generated `durableJob` delegate. Keeping it local
 * avoids importing generated model types that only exist after `prisma generate`.
 */
interface DurableJobDelegate {
    createMany(args: {
        data: Array<Record<string, unknown>>;
        skipDuplicates?: boolean;
    }): Promise<{ count: number }>;
    findUnique(args: {
        where: { key: string };
        select?: Record<string, boolean>;
    }): Promise<DurableJobRow | null>;
    findMany(args: {
        where?: Record<string, unknown>;
        take?: number;
        orderBy?: Record<string, unknown>;
        select?: Record<string, boolean>;
    }): Promise<DurableJobRow[]>;
    updateMany(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
    }): Promise<{ count: number }>;
}

type DurableStore = Prisma.TransactionClient | typeof prisma;

// Indirection lets unit tests supply a fake store without a database.
let outboxStore: DurableStore = prisma;

/** Test-only hook: replaces the store used by dispatch/recovery helpers. */
export function setOutboxStoreForTests(store: DurableStore): void {
    outboxStore = store;
}

function store(): DurableStore {
    return outboxStore;
}

function durableJobs(db: DurableStore): DurableJobDelegate {
    return (db as unknown as { durableJob: DurableJobDelegate }).durableJob;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Durable job failed";
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function jsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
}

/** Inserts a job inside the caller's transaction; duplicate keys are no-ops. */
export async function insertDurableJob(
    tx: Prisma.TransactionClient,
    input: DurableJobInput,
): Promise<void> {
    await durableJobs(tx).createMany({
        data: [
            {
                key: input.key,
                type: input.type,
                payload: jsonValue(input.payload),
                status: "PENDING" as const,
                attempts: 0,
                maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
                availableAt: input.availableAt ?? new Date(),
            },
        ],
        skipDuplicates: true,
    });
}

/**
 * Requeues an existing job (used by explicit retries and source reprocessing).
 * Missing jobs are inserted so legacy rows gain durable processing as well.
 */
export async function requeueDurableJob(
    key: string,
    input?: Partial<DurableJobInput>,
): Promise<void> {
    if (input?.type && input.payload) {
        await durableJobs(store()).createMany({
            data: [
                {
                    key,
                    type: input.type,
                    payload: jsonValue(input.payload),
                    status: "PENDING" as const,
                    attempts: 0,
                    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
                    availableAt: input.availableAt ?? new Date(),
                },
            ],
            skipDuplicates: true,
        });
    }

    await durableJobs(store()).updateMany({
        // A delivered job represents finished, charged work. Only explicit
        // retries of incomplete/terminal jobs may rewind it.
        where: { key, status: { not: "DELIVERED" as const } },
        data: {
            status: "PENDING" as const,
            attempts: 0,
            availableAt: new Date(),
            deliveredAt: null,
            lastError: null,
            ...(input?.payload ? { payload: jsonValue(input.payload) } : {}),
        },
    });
}

/** PENDING -> PROCESSING, atomically, only when the job is due and retryable. */
export async function claimDurableJob(key: string): Promise<boolean> {
    const job = await durableJobs(store()).findUnique({
        where: { key },
        select: { maxAttempts: true },
    });
    if (!job) return false;

    const claimed = await durableJobs(store()).updateMany({
        where: {
            key,
            status: "PENDING" as const,
            availableAt: { lte: new Date() },
            attempts: { lt: job.maxAttempts },
        },
        data: { status: "PROCESSING" as const, lastError: null },
    });
    return claimed.count === 1;
}

/**
 * Terminal means "no further retries will happen": either the job is DEAD, or
 * it predates the outbox (no row). Retryable states must never trigger refunds.
 */
export async function isDurableJobTerminal(key: string): Promise<boolean> {
    const job = await durableJobs(store()).findUnique({
        where: { key },
        select: { status: true },
    });
    return !job || job.status === "DEAD";
}

/** PROCESSING -> DELIVERED. Repeating this call is harmless. */
export async function markDurableJobDelivered(key: string): Promise<void> {
    await durableJobs(store()).updateMany({
        where: { key, status: "PROCESSING" as const },
        data: {
            status: "DELIVERED" as const,
            deliveredAt: new Date(),
            lastError: null,
        },
    });
}

/** Best-effort idempotent compensation for a job that exhausted its retries. */
async function compensateDeadJob(job: DurableJobRow, error: unknown): Promise<void> {
    const payload = asRecord(job.payload);
    const message = errorMessage(error);
    const chargeIdempotencyKey =
        typeof payload.chargeIdempotencyKey === "string"
            ? payload.chargeIdempotencyKey
            : undefined;

    if (job.type === "artifact.generate") {
        const artifactId =
            typeof payload.artifactId === "string" ? payload.artifactId : "";
        if (!artifactId) return;

        const artifact = await store().learningArtifact.findUnique({
            where: { id: artifactId },
            select: { workspaceId: true, status: true, metadata: true, refundedAt: true },
        });
        // A READY artifact was successfully generated and must never be
        // failed or refunded, even if the outbox later reaches DEAD.
        if (!artifact || artifact.status === "READY") return;

        await store().$transaction(async (tx) => {
            const previousMetadata = asRecord(artifact.metadata);
            const changed = await markArtifactFailedIfEligible(
                artifactId,
                null,
                message,
                {
                    tx,
                    metadata: { ...previousMetadata, processingError: message },
                    refundedAt: artifact.refundedAt ?? null,
                },
            );
            // A worker may already have moved the artifact to FAILED (without
            // refunding, because its job was still retryable). That is still a
            // terminal outcome once this job is DEAD, so compensate it too.
            if (!changed && artifact.status !== "FAILED") return;

            const workspace = await tx.workspace.findUnique({
                where: { id: artifact.workspaceId },
                select: { userId: true },
            });
            if (!workspace?.userId) return;

            const refunded = await refundChargeInTransaction(tx, {
                chargeIdempotencyKey:
                    chargeIdempotencyKey ?? `artifact-charge:${artifactId}`,
                refundIdempotencyKey: `artifact-refund:${artifactId}`,
                expectedUserId: workspace.userId,
                reason: message,
            });
            if (refunded && !artifact.refundedAt) {
                await tx.learningArtifact.updateMany({
                    where: { id: artifactId, status: "FAILED" as const },
                    data: { refundedAt: new Date() },
                });
            }
        });
        return;
    }

    if (job.type === "source.process") {
        const sourceId =
            typeof payload.sourceId === "string" ? payload.sourceId : "";
        if (!sourceId) return;

        const source = await store().source.findUnique({
            where: { id: sourceId },
            select: { workspaceId: true, status: true, metadata: true },
        });
        if (!source || source.status === "READY") return;

        await store().$transaction(async (tx) => {
            const current = await tx.source.findUnique({
                where: { id: sourceId },
                select: { status: true },
            });
            if (!current || current.status === "READY") return;

            const changed = await tx.source.updateMany({
                where: { id: sourceId, status: { not: "READY" as const } },
                data: {
                    status: "FAILED" as const,
                    metadata: {
                        ...asRecord(source.metadata),
                        processingError: message,
                    },
                },
            });
            if (changed.count !== 1) return;

            const workspace = await tx.workspace.findUnique({
                where: { id: source.workspaceId },
                select: { userId: true },
            });
            if (!workspace?.userId) return;

            await refundChargeInTransaction(tx, {
                chargeIdempotencyKey:
                    chargeIdempotencyKey ?? `source-charge:${sourceId}`,
                refundIdempotencyKey: `source-refund:${sourceId}`,
                expectedUserId: workspace.userId,
                reason: message,
            });
        });
    }
}

/**
 * PROCESSING -> PENDING with exponential backoff, or -> DEAD at maxAttempts.
 * DEAD jobs compensate exactly once (refund + failed state) for artifact and
 * source jobs.
 */
export async function releaseDurableJob(
    key: string,
    error: unknown,
): Promise<"RETRY" | "DEAD" | null> {
    const job = await durableJobs(store()).findUnique({ where: { key } });
    if (!job || job.status !== "PROCESSING") return null;

    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;
    const message = errorMessage(error);
    const staleCondition = { status: "PROCESSING" as const };

    if (dead) {
        const updated = await durableJobs(store()).updateMany({
            where: { key, ...staleCondition },
            data: {
                status: "DEAD" as const,
                attempts,
                lastError: message,
            },
        });
        if (updated.count === 1) {
            await compensateDeadJob({ ...job, attempts, status: "DEAD", lastError: message }, error);
            return "DEAD";
        }
        return null;
    }

    const backoffMs = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    const updated = await durableJobs(store()).updateMany({
        where: { key, ...staleCondition },
        data: {
            status: "PENDING" as const,
            attempts,
            availableAt: new Date(Date.now() + backoffMs),
            lastError: message,
        },
    });
    return updated.count === 1 ? "RETRY" : null;
}

async function deliverToInngest(job: DurableJobRow): Promise<boolean> {
    const payload = asRecord(job.payload);
    const key = job.key;

    if (job.type === "artifact.generate") {
        const { enqueueArtifactGeneration } = await import("./events/artifact-events.js");
        return enqueueArtifactGeneration({
            artifactId: String(payload.artifactId ?? ""),
            workspaceId: String(payload.workspaceId ?? ""),
            jobKey: key,
        });
    }

    if (job.type === "source.process") {
        const { enqueueSourceProcessing } = await import("./events/source-events.js");
        return enqueueSourceProcessing({
            sourceId: String(payload.sourceId ?? ""),
            workspaceId: String(payload.workspaceId ?? ""),
            title: typeof payload.title === "string" ? payload.title : undefined,
            jobKey: key,
        });
    }

    throw new Error(`Unknown durable job type: ${job.type}`);
}

/** Local (no-Inngest) fallback. The outbox row is the source of truth. */
async function runLocalFallback(job: DurableJobRow): Promise<void> {
    const payload = asRecord(job.payload);
    if (job.type === "artifact.generate") {
        const { processArtifactById } = await import("../services/artifact.services.js");
        await processArtifactById(String(payload.artifactId ?? ""), job.key);
        return;
    }
    if (job.type === "source.process") {
        const { processSourceById } = await import("../services/source-processing-runner.js");
        await processSourceById(String(payload.sourceId ?? ""), job.key);
        return;
    }
    throw new Error(`Unknown durable job type: ${job.type}`);
}

/**
 * Claims and dispatches one job. Duplicate calls are safe: only one dispatcher
 * can claim a PENDING job, PROCESSING jobs are skipped, and terminal jobs are
 * considered handled.
 */
export async function dispatchDurableJob(key: string): Promise<boolean> {
    const job = await durableJobs(store()).findUnique({ where: { key } });
    if (!job) return false;
    if (job.status === "DELIVERED" || job.status === "DEAD") return true;
    if (job.status === "PROCESSING") return false;
    if (new Date(job.availableAt).getTime() > Date.now()) return false;

    if (!(await claimDurableJob(key))) return false;

    try {
        const accepted = await deliverToInngest(job);
        if (!accepted) {
            // Inngest is unavailable: run locally. The worker marks the job
            // DELIVERED only after its own atomic completion succeeds.
            await runLocalFallback(job);
        }
        // Event acceptance is NOT completion. A PROCESSING job stays
        // PROCESSING until the worker reports success with markDurableJobDelivered;
        // stale recovery can therefore reclaim a crashed worker's job.
        return true;
    } catch (error) {
        await releaseDurableJob(key, error);
        return false;
    }
}

/** Dispatches a bounded batch of due PENDING jobs. */
export async function dispatchDueDurableJobs(limit = 50): Promise<number> {
    const due = await durableJobs(store()).findMany({
        where: {
            status: "PENDING" as const,
            availableAt: { lte: new Date() },
        },
        take: limit,
        orderBy: { availableAt: "asc" },
        select: { key: true },
    });

    let dispatched = 0;
    for (const job of due) {
        if (await dispatchDurableJob(job.key)) dispatched += 1;
    }
    return dispatched;
}

/**
 * Startup/sweep recovery: stale PROCESSING jobs return to PENDING (or DEAD at
 * the attempt limit) and due jobs are dispatched again.
 */
export async function recoverAbandonedDurableJobs(limit = 50): Promise<number> {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
    const stale = await durableJobs(store()).findMany({
        where: {
            status: "PROCESSING" as const,
            updatedAt: { lt: staleBefore },
        },
        take: limit,
        orderBy: { updatedAt: "asc" },
    });

    for (const job of stale) {
        const attempts = job.attempts + 1;
        const dead = attempts >= job.maxAttempts;
        const claimed = await durableJobs(store()).updateMany({
            where: {
                key: job.key,
                status: "PROCESSING" as const,
                updatedAt: { lt: staleBefore },
            },
            data: dead
                ? {
                      status: "DEAD" as const,
                      attempts,
                      lastError: "Abandoned processing job",
                  }
                : {
                      status: "PENDING" as const,
                      attempts,
                      availableAt: new Date(),
                      lastError: "Recovered abandoned processing job",
                  },
        });
        if (claimed.count === 1 && dead) {
            await compensateDeadJob(
                {
                    ...job,
                    attempts,
                    status: "DEAD",
                    lastError: "Abandoned processing job",
                },
                "Abandoned processing job",
            );
        }
    }

    return dispatchDueDurableJobs(limit);
}

/** Exposed for tests/logging: the payload keys used by the workers. */
export const durableJobTypes: readonly DurableJobType[] = [
    "source.process",
    "artifact.generate",
] as const;

export function logDurableJobError(key: string, error: unknown): void {
    logger.error("Durable job dispatch failed", { key, err: error });
}
