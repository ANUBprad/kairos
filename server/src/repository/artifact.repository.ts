import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const artifactSelect = {
    id: true,
    workspaceId: true,
    type: true,
    title: true,
    content: true,
    sourceIds: true,
    status: true,
    metadata: true,
    refundedAt: true,
    createdAt: true,
    updatedAt: true,
} as const;

export type ArtifactRecord = Prisma.LearningArtifactGetPayload<{
    select: typeof artifactSelect;
}>;

export type CreateArtifactData = {
    id?: string;
    workspaceId: string;
    type: ArtifactRecord["type"];
    title: string;
    sourceIds: string[];
    status?: ArtifactRecord["status"];
    metadata?: Prisma.InputJsonValue;
};

/** A transaction client can stand in for the global client for all writes. */
type ArtifactWriter = Prisma.TransactionClient;

function writer(tx?: ArtifactWriter): ArtifactWriter {
    return tx ?? (prisma as unknown as ArtifactWriter);
}

/**
 * Queries all learning artifacts in a workspace, ordered by newest first.
 *
 * @param workspaceId - Workspace identifier
 * @returns Promise resolving to list of artifact records
 */
export function findArtifactsByWorkspaceId(workspaceId: string) {
    return prisma.learningArtifact.findMany({
        where: { workspaceId },
        select: artifactSelect,
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Queries an artifact scoped by artifactId and workspaceId.
 *
 * @param artifactId - Unique identifier of the artifact
 * @param workspaceId - Workspace identifier
 * @returns Promise resolving to matching artifact record or null
 */
export function findArtifactByIdAndWorkspaceId(
    artifactId: string,
    workspaceId: string,
) {
    return prisma.learningArtifact.findFirst({
        where: { id: artifactId, workspaceId },
        select: artifactSelect,
    });
}

/**
 * Inserts a new learning artifact record (in PENDING status) into PostgreSQL.
 *
 * @param data - Artifact parameters (workspaceId, type, title, sourceIds, status, metadata)
 * @returns Promise resolving to created artifact record
 */
export function createArtifactRecord(
    data: CreateArtifactData,
    tx?: ArtifactWriter,
) {
    return writer(tx).learningArtifact.create({
        data: {
            ...(data.id ? { id: data.id } : {}),
            workspaceId: data.workspaceId,
            type: data.type,
            title: data.title,
            sourceIds: data.sourceIds,
            status: data.status ?? "PENDING",
            metadata: data.metadata,
        },
        select: artifactSelect,
    });
}

/**
 * Updates properties (title, generated JSON content, status, metadata) of an artifact record.
 *
 * @param artifactId - Unique identifier of the artifact
 * @param data - Update payload
 * @returns Promise resolving to updated artifact record
 */
export function updateArtifactRecord(
    artifactId: string,
    data: {
        title?: string;
        type?: ArtifactRecord["type"];
        content?: Prisma.InputJsonValue;
        status?: ArtifactRecord["status"];
        metadata?: Prisma.InputJsonValue;
        refundedAt?: Date | null;
    },
) {
    return prisma.learningArtifact.update({
        where: { id: artifactId },
        data,
        select: artifactSelect,
    });
}

/**
 * Deletes an artifact record by ID from PostgreSQL.
 *
 * @param artifactId - Unique identifier of the artifact to delete
 */
export async function deleteArtifactRecord(artifactId: string) {
    await prisma.learningArtifact.delete({
        where: { id: artifactId },
    });
}

/**
 * Queries an artifact by its unique ID.
 *
 * @param artifactId - Unique identifier of the artifact
 * @returns Promise resolving to matching artifact record or null
 */
export function findArtifactById(artifactId: string) {
    return prisma.learningArtifact.findUnique({
        where: { id: artifactId },
        select: artifactSelect,
    });
}

/**
 * Artifact processing state transitions are compare-and-swap operations: the
 * caller only succeeds when its `WHERE` clause still matches in the database.
 * A second worker or a stale sweep can never overwrite a live lease or a READY
 * artifact because none of these helpers performs a find-then-update.
 */

export interface CompleteArtifactData {
    title?: string;
    content?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    type?: ArtifactRecord["type"];
}

/** PENDING/FAILED -> PROCESSING, claiming an exclusive, expiring lease. */
export async function claimArtifactForProcessing(
    artifactId: string,
    leaseToken: string,
    leaseMs: number,
    tx?: ArtifactWriter,
): Promise<boolean> {
    const now = new Date();
    const claimed = await writer(tx).learningArtifact.updateMany({
        where: {
            id: artifactId,
            status: { in: ["PENDING", "FAILED"] },
            OR: [
                { leaseToken: null },
                { leaseExpiresAt: null },
                { leaseExpiresAt: { lt: now } },
            ],
        },
        data: {
            status: "PROCESSING",
            leaseToken,
            leaseExpiresAt: new Date(now.getTime() + leaseMs),
            metadata: { processingError: null },
        },
    });
    return claimed.count === 1;
}

/** PROCESSING (with the matching lease) -> READY. */
export async function completeArtifactProcessing(
    artifactId: string,
    leaseToken: string,
    data: CompleteArtifactData,
    tx?: ArtifactWriter,
): Promise<boolean> {
    const completed = await writer(tx).learningArtifact.updateMany({
        where: { id: artifactId, status: "PROCESSING", leaseToken },
        data: {
            ...data,
            status: "READY",
            leaseToken: null,
            leaseExpiresAt: null,
        },
    });
    return completed.count === 1;
}

export interface MarkArtifactFailedOptions {
    tx?: ArtifactWriter;
    metadata?: Prisma.InputJsonValue;
    refundedAt?: Date | null;
}

/**
 * PENDING/PROCESSING -> FAILED, but never for a READY artifact and never while
 * another worker holds a valid (unexpired) lease. `leaseToken === null` is used
 * by the stale sweep, which may only take over expired/unleased rows.
 */
export async function markArtifactFailedIfEligible(
    artifactId: string,
    leaseToken: string | null,
    message: string,
    options: MarkArtifactFailedOptions = {},
): Promise<boolean> {
    const now = new Date();
    const leaseConditions: Prisma.LearningArtifactWhereInput[] = [
        { leaseToken: null },
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
    ];
    if (leaseToken) {
        leaseConditions.push({ leaseToken });
    }

    const failed = await writer(options.tx).learningArtifact.updateMany({
        where: {
            id: artifactId,
            status: { in: ["PENDING", "PROCESSING"] },
            OR: leaseConditions,
        },
        data: {
            status: "FAILED",
            leaseToken: null,
            leaseExpiresAt: null,
            ...(options.refundedAt !== undefined
                ? { refundedAt: options.refundedAt }
                : {}),
            metadata:
                options.metadata ??
                ({ processingError: message } as Prisma.InputJsonValue),
        },
    });
    return failed.count === 1;
}

/** FAILED -> PENDING for an explicit retry, without charging again. */
export async function markArtifactPendingForRetry(
    artifactId: string,
    tx?: ArtifactWriter,
): Promise<boolean> {
    const retried = await writer(tx).learningArtifact.updateMany({
        where: { id: artifactId, status: "FAILED" },
        data: {
            status: "PENDING",
            leaseToken: null,
            leaseExpiresAt: null,
            metadata: {
                processingError: null,
                retriedAt: new Date().toISOString(),
            },
        },
    });
    return retried.count === 1;
}

export function findArtifactForWorker(artifactId: string) {
    return prisma.learningArtifact.findUnique({
        where: { id: artifactId },
        select: artifactSelect,
    });
}

const STALE_ARTIFACT_MS = 30 * 60 * 1000;

/**
 * Finds workspace artifacts stuck in PENDING/PROCESSING after a timeout whose
 * lease is absent or expired. A live lease is never swept while its worker is
 * still running. Callers must use markArtifactFailed so refunds stay idempotent.
 */
export async function findStaleArtifactIdsForWorkspace(
    workspaceId: string,
): Promise<string[]> {
    const staleBefore = new Date(Date.now() - STALE_ARTIFACT_MS);
    const now = new Date();
    const stale = await prisma.learningArtifact.findMany({
        where: {
            workspaceId,
            status: { in: ["PENDING", "PROCESSING"] },
            updatedAt: { lt: staleBefore },
            OR: [
                { leaseToken: null },
                { leaseExpiresAt: null },
                { leaseExpiresAt: { lt: now } },
            ],
        },
        select: { id: true },
    });
    return stale.map((artifact) => artifact.id);
}