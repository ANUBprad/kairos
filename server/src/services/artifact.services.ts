import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";
import {
    dispatchDurableJob,
    insertDurableJob,
    isDurableJobTerminal,
    logDurableJobError,
    markDurableJobDelivered,
    releaseDurableJob,
    requeueDurableJob,
    withDurableJobHeartbeat,
} from "../lib/outbox.js";
import {
    deleteArtifactRecord,
    findStaleArtifactIdsForWorkspace,
    findArtifactById,
    findArtifactByIdAndWorkspaceId,
    findArtifactsByWorkspaceId,
    createArtifactRecord,
    claimArtifactForProcessing,
    completeArtifactProcessing,
    markArtifactFailedIfEligible,
    markArtifactPendingForRetry,
    renewArtifactLease,
    type ArtifactRecord,
} from "../repository/artifact.repository.js";
import { NotFoundError, ValidationError } from "../types/app-error.js";
import { logger } from "../lib/logger.js";
import {
    gatherSourceContext,
    generateArtifactContent,
} from "./artifact-generation.services.js";
import { getWorkspaceByIdForUser } from "./workspace.services.js";
import {
    assertCanCreateArtifact,
    assertCanCreateArtifactType,
    assertQuotaInTransaction,
    consumeArtifactQuotaInTransaction,
    getArtifactCharge,
} from "./usage.services.js";
import {
    debitCreditsInTransaction,
    refundChargeInTransaction,
} from "./credit.services.js";

import { generateArtifactTitleWithGemini } from "../lib/gemini.js";
import type { CreateArtifactInput } from "../validators/artifact.validator.js";

const ARTIFACT_LEASE_MS = 15 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

/** Maps legacy DB enum values to the types the API and client expect. */
function normalizeArtifactRecord(artifact: ArtifactRecord): ArtifactRecord {
    if (artifact.type !== "DIAGRAM") {
        return artifact;
    }
    return { ...artifact, type: "MINDMAP" };
}

/**
 * Lists all learning artifacts in a workspace.
 *
 * @param workspaceId - Workspace to list artifacts from
 * @param userId - Authenticated user's id
 * @returns Artifact records ordered by creation time
 *
 */
export async function listArtifactsForWorkspace(
    workspaceId: string,
    userId: string,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    const staleArtifactIds =
        await findStaleArtifactIdsForWorkspace(workspaceId);
    for (const staleArtifactId of staleArtifactIds) {
        await markArtifactFailed(
            staleArtifactId,
            "Generation timed out or was interrupted. Try generating again.",
        );
    }
    const artifacts = await findArtifactsByWorkspaceId(workspaceId);
    return artifacts.map(normalizeArtifactRecord);
}

/**
 * Persists a FAILED status and error message only when the compare-and-swap
 * transition succeeds. A READY artifact and a refunded artifact are never
 * touched again, so repeated failure reports cannot double-refund.
 */
export async function markArtifactFailed(
    artifactId: string,
    message: string,
    leaseToken: string | null = null,
) {
    // Compensation is strictly terminal: a job that will be retried must keep
    // its charge. The durable outbox refunds exactly once when it reaches DEAD.
    const terminal = await isDurableJobTerminal(`artifact-generate:${artifactId}`);
    await prisma.$transaction(async (tx) => {
        const artifact = await tx.learningArtifact.findUnique({
            where: { id: artifactId },
            select: {
                workspaceId: true,
                status: true,
                refundedAt: true,
                metadata: true,
            },
        });

        // A READY artifact must never be refunded; an already-refunded one is a retry.
        if (!artifact || artifact.status === "READY") return;

        const previousMetadata = asRecord(artifact.metadata);
        const transitioned = await markArtifactFailedIfEligible(
            artifactId,
            leaseToken,
            message,
            {
                tx,
                metadata: { ...previousMetadata, processingError: message },
                refundedAt: artifact.refundedAt ?? null,
            },
        );
        if (!transitioned || artifact.refundedAt) return;
        if (!terminal) return;

        const workspace = await tx.workspace.findUnique({
            where: { id: artifact.workspaceId },
            select: { userId: true },
        });

        // Only refund when a ledger row proves this specific artifact was
        // debited. Historical unmarked charges are intentionally left alone.
        if (!workspace?.userId) return;
        const refunded = await refundChargeInTransaction(tx, {
            chargeIdempotencyKey: `artifact-charge:${artifactId}`,
            refundIdempotencyKey: `artifact-refund:${artifactId}`,
            expectedUserId: workspace.userId,
            reason: message,
        });
        if (refunded) {
            await tx.learningArtifact.updateMany({
                where: { id: artifactId, status: "FAILED" as const },
                data: { refundedAt: new Date() },
            });
        }
    });
}

/**
 * Loads a single artifact after verifying workspace ownership.
 */
export async function getArtifactForWorkspace(
    workspaceId: string,
    artifactId: string,
    userId: string,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);

    const artifact = await findArtifactByIdAndWorkspaceId(
        artifactId,
        workspaceId,
    );

    if (!artifact) {
        throw new NotFoundError("Artifact not found");
    }

    return normalizeArtifactRecord(artifact);
}

export interface ArtifactCreationTxInput {
    artifactId: string;
    workspaceId: string;
    userId: string;
    type: CreateArtifactInput["type"];
    title: string;
    sourceIds: string[];
    chargeIdempotencyKey: string;
    jobKey: string;
}

/**
 * The atomic artifact creation unit of work: row + debit + quota consumption +
 * outbox job. Exported so failure windows can be tested with a fake tx.
 */
export async function insertArtifactCreationInTransaction(
    tx: Prisma.TransactionClient,
    input: ArtifactCreationTxInput,
): Promise<ArtifactRecord> {
    await assertQuotaInTransaction(tx, input.userId, "artifacts");

    const artifact = await createArtifactRecord(
        {
            id: input.artifactId,
            workspaceId: input.workspaceId,
            type: input.type,
            title: input.title,
            sourceIds: input.sourceIds,
            status: "PENDING",
        },
        tx,
    );

    const charge = getArtifactCharge(input.type);
    await debitCreditsInTransaction(tx, {
        userId: input.userId,
        amount: charge.cost,
        type: charge.type,
        description: charge.description,
        metadata: { artifactId: input.artifactId },
        idempotencyKey: input.chargeIdempotencyKey,
    });

    await consumeArtifactQuotaInTransaction(tx, input.userId);

    await insertDurableJob(tx, {
        key: input.jobKey,
        type: "artifact.generate",
        payload: {
            artifactId: input.artifactId,
            workspaceId: input.workspaceId,
            chargeIdempotencyKey: input.chargeIdempotencyKey,
            type: input.type,
        },
    });

    return artifact;
}

/**
 * Creates a pending artifact and durably enqueues background generation.
 *
 * The expensive preparation happens before charging; the row, ledger entry,
 * lifetime counter and outbox job commit together, so an enqueue failure never
 * leaves a charged artifact with no way to be generated or refunded.
 */
export async function createArtifactForWorkspace(
    workspaceId: string,
    userId: string,
    input: CreateArtifactInput,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateArtifact(userId, input.type);
    await assertCanCreateArtifactType(userId, input.type);

    const context = await gatherSourceContext(
        workspaceId,
        input.sourceIds,
    );

    const title =
        input.title?.trim() ||
        (await generateArtifactTitleWithGemini(input.type, context.text));

    const artifactId = randomUUID();
    const chargeIdempotencyKey = `artifact-charge:${artifactId}`;
    const jobKey = `artifact-generate:${artifactId}`;

    const artifact = await prisma.$transaction((tx) =>
        insertArtifactCreationInTransaction(tx, {
            artifactId,
            workspaceId,
            userId,
            type: input.type,
            title,
            sourceIds: context.sourceIds,
            chargeIdempotencyKey,
            jobKey,
        }),
    );

    // Never await dispatch in the request path; the outbox row is durable.
    void dispatchDurableJob(jobKey).catch((error) => {
        logDurableJobError(jobKey, error);
    });

    return artifact;
}

/**
 * Deletes an artifact from the workspace.
 */
export async function deleteArtifactForWorkspace(
    workspaceId: string,
    artifactId: string,
    userId: string,
) {
    await getArtifactForWorkspace(workspaceId, artifactId, userId);
    await deleteArtifactRecord(artifactId);
}

/**
 * Re-queues generation for a failed artifact without consuming usage quota or
 * charging again.
 */
export async function retryArtifactForWorkspace(
    workspaceId: string,
    artifactId: string,
    userId: string,
) {
    const artifact = await getArtifactForWorkspace(
        workspaceId,
        artifactId,
        userId,
    );

    if (artifact.status !== "FAILED") {
        throw new ValidationError("Only failed artifacts can be retried");
    }
    // A terminal failure was already compensated. Reusing the original charge
    // key would let a refunded artifact be regenerated for free.
    if (artifact.refundedAt) {
        throw new ValidationError(
            "This artifact was refunded after a terminal failure. Create a new artifact instead.",
        );
    }

    const transitioned = await markArtifactPendingForRetry(artifactId);
    if (!transitioned) {
        throw new ValidationError("Artifact changed state; retry is not allowed");
    }

    const jobKey = `artifact-generate:${artifactId}`;
    const requeued = await requeueDurableJob(jobKey, {
        key: jobKey,
        type: "artifact.generate",
        payload: {
            artifactId,
            workspaceId,
            chargeIdempotencyKey: `artifact-charge:${artifactId}`,
            type: artifact.type,
        },
    });
    if (!requeued) {
        throw new ValidationError(
            "This artifact has a live or already completed generation job and cannot be retried.",
        );
    }
    void dispatchDurableJob(jobKey).catch((error) => {
        logDurableJobError(jobKey, error);
    });

    const updated = await findArtifactByIdAndWorkspaceId(
        artifactId,
        workspaceId,
    );

    if (!updated) {
        throw new NotFoundError("Artifact not found");
    }

    return normalizeArtifactRecord(updated);
}

/**
 * Runs the full artifact generation pipeline (used by Inngest workers and the
 * local outbox fallback). A lease guarantees only one worker can generate a
 * given artifact at a time.
 */
export async function processArtifactById(
    artifactId: string,
    jobKey?: string,
    jobLeaseToken?: string,
) {
    // The job heartbeat covers the whole execution, including the initial
    // lookup and artifact claim. Otherwise a long claim/recovery race could
    // expire the job lease before the generation work even starts.
    return withDurableJobHeartbeat(jobKey, jobLeaseToken, async () => {
        const artifact = await findArtifactById(artifactId);
        if (!artifact) {
            const error = new Error("Artifact not found");
            if (jobKey) await releaseDurableJob(jobKey, error, jobLeaseToken);
            throw error;
        }

        if (artifact.status === "READY") {
            if (jobKey) await markDurableJobDelivered(jobKey, jobLeaseToken);
            return artifact;
        }

        const leaseToken = randomUUID();
        const claimed = await claimArtifactForProcessing(
            artifactId,
            leaseToken,
            ARTIFACT_LEASE_MS,
        );
        if (!claimed) {
            // Another worker owns a live lease. Leave the job in its current
            // state so the active holder can report completion; marking it
            // DELIVERED here would silently lose an in-flight job.
            return (await findArtifactById(artifactId)) ?? artifact;
        }

        const artifactType =
            artifact.type === "DIAGRAM" ? "MINDMAP" : artifact.type;

        try {
            const context = await gatherSourceContext(
                artifact.workspaceId,
                artifact.sourceIds,
            );

            // Long-running generation must keep both leases alive; otherwise a
            // recovery sweep could hand the work to a second worker.
            if (!(await renewArtifactLease(artifactId, leaseToken, ARTIFACT_LEASE_MS))) {
                throw new Error("Artifact lease was lost before generation");
            }

            const content = await generateArtifactContent(
                artifactType,
                context.text,
            );

            let finalTitle = artifact.title;
            if (finalTitle.includes(" · ")) {
                if (artifactType === "PODCAST" && (content as Record<string, unknown>)?.topic) {
                    finalTitle = String((content as Record<string, unknown>).topic);
                } else {
                    finalTitle = await generateArtifactTitleWithGemini(
                        artifactType,
                        context.text,
                        artifact.title,
                    );
                }
            }

            const completed = await completeArtifactProcessing(
                artifactId,
                leaseToken,
                {
                    title: finalTitle,
                    type: artifactType,
                    content: content as Prisma.InputJsonValue,
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        processingError: null,
                    },
                },
            );
            if (!completed) {
                throw new Error("Artifact lease was lost before completion");
            }

            if (jobKey) await markDurableJobDelivered(jobKey, jobLeaseToken);
            return (await findArtifactById(artifactId)) ?? artifact;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Artifact generation failed";

            if (jobKey) await releaseDurableJob(jobKey, error, jobLeaseToken);
            await markArtifactFailed(artifactId, message, leaseToken);

            logger.error("Artifact generation failed", { artifactId, err: error });
            throw error;
        }
    });
}

export type { ArtifactRecord };
