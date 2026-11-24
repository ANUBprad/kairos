import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import prisma from "./db.js";
import { logger } from "./logger.js";
import {
    getRequestId,
    normalizeRequestId,
    runWithRequestId,
} from "./observability/request-context.js";
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

/** Lease issued atomically when a PENDING job is claimed. */
export interface DurableJobLease {
    token: string;
    expiresAt: Date;
}

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
    leaseToken?: string | null;
    leaseExpiresAt?: Date | null;
    heartbeatAt?: Date | null;
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
/** Attempt lease lifetime. Recovery only reclaims after this window expires. */
const JOB_LEASE_MS = 15 * 60 * 1000;
/** Heartbeats renew the lease well inside the recovery window. */
const DEFAULT_HEARTBEAT_MS = 60_000;
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
    // Preserve the originating request id when a job is reissued from a worker;
    // otherwise capture the active HTTP request id at enqueue time.
    const payload = { ...input.payload };
    const requestId = normalizeRequestId(payload.requestId) ?? getRequestId();
    if (requestId) payload.requestId = requestId;

    await durableJobs(tx).createMany({
        data: [
            {
                key: input.key,
                type: input.type,
                payload: jsonValue(payload),
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
 *
 * A PROCESSING job is never rewound: its lease holder is still alive and a
 * second pipeline would race on chunks, vectors and artifact state. DELIVERED
 * jobs are also immutable. Only PENDING/DEAD jobs may be requeued.
 */
export async function requeueDurableJob(
    key: string,
    input?: Partial<DurableJobInput>,
): Promise<boolean> {
    const payload = input?.payload ? { ...input.payload } : undefined;
    const requestId = normalizeRequestId(payload?.requestId) ?? getRequestId();
    if (payload && requestId) payload.requestId = requestId;

    if (input?.type && payload) {
        await durableJobs(store()).createMany({
            data: [
                {
                    key,
                    type: input.type,
                    payload: jsonValue(payload),
                    status: "PENDING" as const,
                    attempts: 0,
                    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
                    availableAt: input.availableAt ?? new Date(),
                },
            ],
            skipDuplicates: true,
        });
    }

    const updated = await durableJobs(store()).updateMany({
        // PROCESSING work is live and DELIVERED work is charged and finished.
        // Only PENDING/DEAD jobs may be rewound by an explicit retry.
        where: { key, status: { in: ["PENDING", "DEAD"] as const } },
        data: {
            status: "PENDING" as const,
            attempts: 0,
            availableAt: new Date(),
            deliveredAt: null,
            lastError: null,
            leaseToken: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
            ...(payload ? { payload: jsonValue(payload) } : {}),
        },
    });
    if (updated.count === 0) {
        logger.warn("Durable job requeue refused", { key });
    }
    return updated.count === 1;
}

/**
 * PENDING -> PROCESSING, atomically, only when the job is due, retryable and
 * not protected by a live lease. Returns the attempt lease token on success.
 */
export async function claimDurableJob(key: string): Promise<DurableJobLease | null> {
    const job = await durableJobs(store()).findUnique({
        where: { key },
        select: { maxAttempts: true },
    });
    if (!job) return null;

    const now = new Date();
    const token = randomUUID();
    const expiresAt = new Date(now.getTime() + JOB_LEASE_MS);
    const claimed = await durableJobs(store()).updateMany({
        where: {
            key,
            status: "PENDING" as const,
            availableAt: { lte: now },
            attempts: { lt: job.maxAttempts },
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
        },
        data: {
            status: "PROCESSING" as const,
            lastError: null,
            leaseToken: token,
            leaseExpiresAt: expiresAt,
            heartbeatAt: now,
        },
    });
    return claimed.count === 1 ? { token, expiresAt } : null;
}

/** Renews an attempt lease. Recovery cannot reclaim a heartbeated job. */
export async function touchDurableJob(key: string, token: string): Promise<boolean> {
    const now = new Date();
    const updated = await durableJobs(store()).updateMany({
        where: {
            key,
            status: "PROCESSING" as const,
            leaseToken: token,
            leaseExpiresAt: { gt: now },
        },
        data: {
            heartbeatAt: now,
            leaseExpiresAt: new Date(now.getTime() + JOB_LEASE_MS),
            updatedAt: now,
        },
    });
    return updated.count === 1;
}

/** Starts a bounded, unref'd heartbeat timer; returns its cleanup function. */
export function startDurableJobHeartbeat(
    key: string,
    token: string,
    intervalMs: number = DEFAULT_HEARTBEAT_MS,
): () => void {
    if (!Number.isInteger(intervalMs) || intervalMs < 1000) {
        throw new Error("Heartbeat interval must be at least 1000 ms");
    }
    const timer = setInterval(() => {
        void touchDurableJob(key, token).catch((error: unknown) => {
            logger.warn("Durable job heartbeat failed", {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
}

/** Keeps an attempt lease alive for the duration of a worker execution. */
export async function withDurableJobHeartbeat<T>(
    key: string | undefined,
    token: string | undefined,
    work: () => Promise<T>,
): Promise<T> {
    if (!key || !token) return work();
    const stop = startDurableJobHeartbeat(key, token);
    try {
        return await work();
    } finally {
        stop();
    }
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

/**
 * PROCESSING -> DELIVERED. A lease token, when supplied, prevents a stale
 * worker from completing a job that recovery already handed to a new worker.
 */
export async function markDurableJobDelivered(
    key: string,
    token?: string,
): Promise<boolean> {
    const updated = await durableJobs(store()).updateMany({
        where: {
            key,
            status: "PROCESSING" as const,
            ...(token ? { leaseToken: token } : {}),
        },
        data: {
            status: "DELIVERED" as const,
            deliveredAt: new Date(),
            lastError: null,
            leaseToken: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
        },
    });
    return updated.count === 1;
}

/** Best-effort idempotent compensation for a job that exhausted its retries. */
async function compensateDeadJobInner(job: DurableJobRow, error: unknown): Promise<void> {
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

function compensateDeadJob(job: DurableJobRow, error: unknown): Promise<void> {
    // Compensation can run from a sweeper long after the HTTP request ended;
    // the originating id stored on the job keeps its ledger/log trail linked.
    return runWithRequestId(
        normalizeRequestId(asRecord(job.payload).requestId),
        () => compensateDeadJobInner(job, error),
    );
}

/**
 * PROCESSING -> PENDING with exponential backoff, or -> DEAD at maxAttempts.
 * DEAD jobs compensate exactly once (refund + failed state) for artifact and
 * source jobs.
 */
export async function releaseDurableJob(
    key: string,
    error: unknown,
    token?: string,
): Promise<"RETRY" | "DEAD" | null> {
    const job = await durableJobs(store()).findUnique({ where: { key } });
    if (!job || job.status !== "PROCESSING") return null;
    // A stale worker must not release a job that recovery reissued.
    if (token && job.leaseToken && job.leaseToken !== token) return null;

    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;
    const message = errorMessage(error);
    const staleCondition = {
        status: "PROCESSING" as const,
        ...(token ? { leaseToken: token } : {}),
    };
    const clearLease = {
        leaseToken: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
    };

    if (dead) {
        const updated = await durableJobs(store()).updateMany({
            where: { key, ...staleCondition },
            data: {
                status: "DEAD" as const,
                attempts,
                lastError: message,
                ...clearLease,
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
            ...clearLease,
        },
    });
    return updated.count === 1 ? "RETRY" : null;
}

async function deliverToInngest(job: DurableJobRow, leaseToken: string): Promise<boolean> {
    const payload = asRecord(job.payload);
    const key = job.key;
    // A fresh event id per claim (the lease token is a UUID) prevents Inngest
    // deduplication from suppressing a legitimate retry. An attempt number is
    // not sufficient: an explicit requeue resets attempts to 0 and could reuse
    // the id of a previous failed cycle.
    const eventId = `${key}:lease-${leaseToken}`;

    if (job.type === "artifact.generate") {
        const { enqueueArtifactGeneration } = await import("./events/artifact-events.js");
        return enqueueArtifactGeneration({
            artifactId: String(payload.artifactId ?? ""),
            workspaceId: String(payload.workspaceId ?? ""),
            jobKey: key,
            leaseToken,
            eventId,
            requestId: normalizeRequestId(payload.requestId),
        });
    }

    if (job.type === "source.process") {
        const { enqueueSourceProcessing } = await import("./events/source-events.js");
        return enqueueSourceProcessing({
            sourceId: String(payload.sourceId ?? ""),
            workspaceId: String(payload.workspaceId ?? ""),
            title: typeof payload.title === "string" ? payload.title : undefined,
            jobKey: key,
            leaseToken,
            eventId,
            requestId: normalizeRequestId(payload.requestId),
        });
    }

    throw new Error(`Unknown durable job type: ${job.type}`);
}

/** Local (no-Inngest) fallback. The outbox row is the source of truth. */
function runLocalFallback(job: DurableJobRow, leaseToken: string): Promise<void> {
    const payload = asRecord(job.payload);
    return runWithRequestId(normalizeRequestId(payload.requestId), async () => {
        if (job.type === "artifact.generate") {
            const { processArtifactById } = await import("../services/artifact.services.js");
            await processArtifactById(
                String(payload.artifactId ?? ""),
                job.key,
                leaseToken,
            );
            return;
        }
        if (job.type === "source.process") {
            const { processSourceById } = await import("../services/source-processing-runner.js");
            await processSourceById(
                String(payload.sourceId ?? ""),
                job.key,
                leaseToken,
            );
            return;
        }
        throw new Error(`Unknown durable job type: ${job.type}`);
    });
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

    const lease = await claimDurableJob(key);
    if (!lease) return false;

    return runWithRequestId(normalizeRequestId(asRecord(job.payload).requestId), async () => {
        try {
            const accepted = await deliverToInngest(job, lease.token);
            if (!accepted) {
                // Inngest is unavailable: run locally. The worker marks the job
                // DELIVERED only after its own atomic completion succeeds.
                await runLocalFallback(job, lease.token);
            }
            // Event acceptance is NOT completion. A PROCESSING job stays
            // PROCESSING until the worker reports success with markDurableJobDelivered.
            // Its lease prevents stale recovery from reclaiming live work.
            return true;
        } catch (error) {
            await releaseDurableJob(key, error, lease.token);
            return false;
        }
    });
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
export async function recoverAbandonedDurableJobs(
    limit = 50,
    dispatchRecovered = true,
): Promise<number> {
    const now = new Date();
    // Leased jobs are stale only after their lease expires. Legacy rows with
    // no lease keep the original updatedAt fallback so they are never stuck.
    const staleBefore = new Date(now.getTime() - JOB_LEASE_MS);
    const staleWhere = {
        status: "PROCESSING" as const,
        OR: [
            { leaseExpiresAt: { lt: now } },
            { leaseExpiresAt: null, updatedAt: { lt: staleBefore } },
        ],
    };
    const stale = await durableJobs(store()).findMany({
        where: staleWhere,
        take: limit,
        orderBy: { updatedAt: "asc" },
    });

    const clearLease = {
        leaseToken: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
    };

    for (const job of stale) {
        const payload = asRecord(job.payload);
        const sourceId =
            job.type === "source.process" && typeof payload.sourceId === "string"
                ? payload.sourceId
                : undefined;
        const artifactId =
            job.type === "artifact.generate" && typeof payload.artifactId === "string"
                ? payload.artifactId
                : undefined;

        // A resource that is already READY completed its pipeline before the
        // worker crashed. Settle the job instead of rebuilding it: reprocessing
        // would duplicate chunks/vectors, and treating it as abandonable would
        // refund a successful generation after the lease cycles ran out.
        let alreadyReady = false;
        if (sourceId) {
            const source = await store().source.findUnique({
                where: { id: sourceId },
                select: { status: true },
            });
            alreadyReady = source?.status === "READY";
        } else if (artifactId) {
            const artifact = await store().learningArtifact.findUnique({
                where: { id: artifactId },
                select: { status: true },
            });
            alreadyReady = artifact?.status === "READY";
        }

        const attempts = job.attempts + 1;
        const dead = !alreadyReady && attempts >= job.maxAttempts;
        const accepted = await store().$transaction(async (tx) => {
            const changed = await durableJobs(tx).updateMany({
                where: { key: job.key, ...staleWhere },
                data: dead
                    ? {
                          status: "DEAD" as const,
                          attempts,
                          lastError: "Abandoned processing job",
                          ...clearLease,
                      }
                    : alreadyReady
                      ? {
                            status: "DELIVERED" as const,
                            deliveredAt: now,
                            lastError: null,
                            ...clearLease,
                        }
                      : {
                            status: "PENDING" as const,
                            attempts,
                            availableAt: now,
                            lastError: "Recovered abandoned processing job",
                            ...clearLease,
                        },
            });
            if (changed.count !== 1) return false;

            if (sourceId && !alreadyReady && !dead) {
                // The crashed worker left the source claimed. Releasing that
                // claim atomically with the job is what lets the reissued job's
                // strict `PENDING|FAILED -> PROCESSING` worker claim succeed.
                await tx.source.updateMany({
                    where: { id: sourceId, status: "PROCESSING" as const },
                    data: { status: "PENDING" as const },
                });
            }
            return true;
        });
        if (!accepted) continue;

        if (dead) {
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

    return dispatchRecovered ? dispatchDueDurableJobs(limit) : 0;
}

/** Exposed for tests/logging: the payload keys used by the workers. */
export const durableJobTypes: readonly DurableJobType[] = [
    "source.process",
    "artifact.generate",
] as const;

export function logDurableJobError(key: string, error: unknown): void {
    logger.error("Durable job dispatch failed", { key, err: error });
}
