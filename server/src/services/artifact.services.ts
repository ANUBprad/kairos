import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";
import { enqueueArtifactGeneration } from "../lib/events/artifact-events.js";
import {
    createArtifactRecord,
    deleteArtifactRecord,
    findStaleArtifactIdsForWorkspace,
    findArtifactById,
    findArtifactByIdAndWorkspaceId,
    findArtifactsByWorkspaceId,
    updateArtifactRecord,
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
    chargeForArtifact,
    incrementArtifactCount,
} from "./usage.services.js";
import { refundChargeInTransaction } from "./credit.services.js";

import { generateArtifactTitleWithGemini } from "../lib/gemini.js";
import type { CreateArtifactInput } from "../validators/artifact.validator.js";

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
 * Persists a FAILED status and error message on an artifact row.
 */
export async function markArtifactFailed(artifactId: string, message: string) {
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

        const previousMetadata =
            artifact.metadata && typeof artifact.metadata === "object"
                ? (artifact.metadata as Record<string, unknown>)
                : {};

        const workspace = await tx.workspace.findUnique({
            where: { id: artifact.workspaceId },
            select: { userId: true },
        });

        // Only refund when a ledger row proves this specific artifact was
        // debited. Historical unmarked charges are intentionally left alone.
        const refunded = !artifact.refundedAt && workspace?.userId
            ? await refundChargeInTransaction(tx, {
                chargeIdempotencyKey: `artifact-charge:${artifactId}`,
                refundIdempotencyKey: `artifact-refund:${artifactId}`,
                expectedUserId: workspace.userId,
                reason: message,
            })
            : false;

        await tx.learningArtifact.update({
            where: { id: artifactId },
            data: {
                status: "FAILED",
                refundedAt:
                    artifact.refundedAt ?? (refunded ? new Date() : null),
                metadata: { ...previousMetadata, processingError: message },
            },
        });
    });
}

/**
 * Loads a single artifact after verifying workspace ownership.
 *
 * @param workspaceId - Workspace the artifact belongs to
 * @param artifactId - Artifact to fetch
 * @param userId - Authenticated user's id
 * @returns Artifact record with content when status is `READY`
 * @throws {NotFoundError} When the artifact does not exist in this workspace
 *
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

/**
 * Creates a pending artifact and enqueues background generation via Inngest.
 *
 * Validates that ready sources exist before creating the row. The actual AI
 * generation runs asynchronously in {@link processArtifactById}.
 *
 * @param workspaceId - Workspace to attach the artifact to
 * @param userId - Authenticated user's id
 * @param input - Artifact type, optional title, optional source id filter
 * @returns New artifact with status `PENDING`
 * @throws {ValidationError} When no ready sources are available
 *
 */
export async function createArtifactForWorkspace(
    workspaceId: string,
    userId: string,
    input: CreateArtifactInput,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateArtifact(userId, input.type);
    await assertCanCreateArtifactType(userId, input.type);

    // Do the expensive preparation before charging, so a failed Gemini or
    // context-gathering call never consumes credits.
    const context = await gatherSourceContext(
        workspaceId,
        input.sourceIds,
    );

    const title =
        input.title?.trim() ||
        (await generateArtifactTitleWithGemini(input.type, context.text));

    const artifact = await createArtifactRecord({
        workspaceId,
        type: input.type,
        title,
        sourceIds: context.sourceIds,
        status: "PENDING",
    });

    try {
        // The debit is keyed to the artifact row so failure paths can refund
        // exactly once without affecting historical unmarked debits.
        await chargeForArtifact(userId, artifact.id, input.type);

        // Increment lifetime artifact counter (deletions won't restore quota)
        await incrementArtifactCount(userId);

        const enqueued = await enqueueArtifactGeneration({
            artifactId: artifact.id,
            workspaceId,
        });

        if (!enqueued) {
            void processArtifactById(artifact.id).catch((err) => {
                logger.error("Direct artifact generation failed", { err });
            });
        }

        return artifact;
    } catch (error) {
        // Do not leave an unpaid artifact row behind if the debit itself fails.
        await deleteArtifactRecord(artifact.id).catch((cleanupError) => {
            logger.error("Failed to clean up uncharged artifact", {
                artifactId: artifact.id,
                err: cleanupError,
            });
        });
        throw error;
    }
}

/**
 * Deletes an artifact from the workspace.
 *
 * @param workspaceId - Workspace the artifact belongs to
 * @param artifactId - Artifact to delete
 * @param userId - Authenticated user's id
 * @returns Resolves when the artifact row is deleted
 * @throws {NotFoundError} When the artifact is not found
 *
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
 * Re-queues generation for a failed artifact without consuming usage quota again.
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

    const priorMetadata =
        (artifact.metadata as Record<string, unknown> | null) ?? {};

    await updateArtifactRecord(artifactId, {
        status: "PENDING",
        metadata: {
            ...priorMetadata,
            processingError: undefined,
            retriedAt: new Date().toISOString(),
        },
    });

    const enqueued = await enqueueArtifactGeneration({
        artifactId,
        workspaceId,
    });

    if (!enqueued) {
        void processArtifactById(artifactId).catch((err) => {
            logger.error("Direct artifact retry failed", { artifactId, err });
        });
    }

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
 * Runs the full artifact generation pipeline (used by Inngest worker).
 *
 * ```
 * status: PROCESSING
 *   → gatherSourceContext
 *   → generateArtifactContent
 *   → status: READY (or FAILED on error)
 * ```
 *
 * @param artifactId - Artifact to generate content for
 * @returns Updated artifact with `READY` status and generated content
 * @throws When the artifact is missing or generation fails (status set to `FAILED`)
 *
 *
 */
export async function processArtifactById(artifactId: string) {
    const artifact = await findArtifactById(artifactId);
    if (!artifact) {
        throw new Error("Artifact not found");
    }

    await updateArtifactRecord(artifactId, { status: "PROCESSING" });

    const artifactType =
        artifact.type === "DIAGRAM" ? "MINDMAP" : artifact.type;

    try {
        const context = await gatherSourceContext(
            artifact.workspaceId,
            artifact.sourceIds,
        );

        const content = await generateArtifactContent(
            artifactType,
            context.text,
        );

        // If title was a generic date fallback, refine it with specific topic/Gemini
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

        return updateArtifactRecord(artifactId, {
            title: finalTitle,
            type: artifactType,
            status: "READY",
            content: content as Prisma.InputJsonValue,
            metadata: {
                generatedAt: new Date().toISOString(),
                processingError: undefined,
            },
        });

    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Artifact generation failed";

        await markArtifactFailed(artifactId, message);

        throw error;
    }
}

export type { ArtifactRecord };