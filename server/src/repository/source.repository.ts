import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";
import { ListSourcesQuery } from "../validators/source.validator.js";

export const sourceSelect = {
    id: true,
    workspaceId: true,
    type: true,
    title: true,
    content: true,
    url: true,
    status: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const;

export type CreateSourceData = {
    workspaceId: string;
    type: SourceRecord["type"];
    title: string;
    content?: string | null;
    url?: string | null;
    status?: SourceRecord["status"];
    metadata?: Prisma.InputJsonValue;
};

export type SourceRecord = Prisma.SourceGetPayload<{
    select: typeof sourceSelect;
}>;


/**
 * Inserts a new Source record in PostgreSQL.
 *
 * @param data - Source creation attributes (workspaceId, type, title, content, url, status, metadata)
 * @returns Promise resolving to the newly created source record
 */
export function createSourceRecord(data: CreateSourceData) {
    return prisma.source.create({
        data: {
            workspaceId: data.workspaceId,
            type: data.type,
            title: data.title,
            content: data.content ?? null,
            url: data.url ?? null,
            status: data.status ?? "PENDING",
            metadata: data.metadata,
        },
        select: sourceSelect,
    });
}

/**
 * Queries all sources belonging to a workspace with optional type, status, and keyword search filters.
 *
 * @param workspaceId - Workspace identifier
 * @param filters - Optional filters for type, status, or search query `q`
 * @returns Promise resolving to a list of matching source records
 */
export function findSourcesByWorkspaceId(
    workspaceId: string,
    filters: ListSourcesQuery = {},
) {
    const where: Prisma.SourceWhereInput = { workspaceId };

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.q) {
        where.OR = [
            { title: { contains: filters.q, mode: "insensitive" } },
            { content: { contains: filters.q, mode: "insensitive" } },
        ];
    }

    return prisma.source.findMany({
        where,
        select: sourceSelect,
        orderBy: { createdAt: "desc" },
        take: 200,
    });
}

/**
 * Queries a single source record scoped by sourceId and workspaceId.
 *
 * @param sourceId - Unique identifier of the source
 * @param workspaceId - Workspace identifier
 * @returns Promise resolving to matching source record or null
 */
export function findSourceByIdAndWorkspaceId(
    sourceId: string,
    workspaceId: string,
) {
    return prisma.source.findFirst({
        where: { id: sourceId, workspaceId },
        select: sourceSelect,
    });
}

/**
 * Finds a non-terminal source by an identity stored in metadata. This lets
 * repeated imports reuse an active source instead of charging and indexing a
 * duplicate; terminal FAILED sources remain re-importable.
 */
export function findActiveSourceByMetadataKey(
    workspaceId: string,
    type: SourceRecord["type"],
    metadataKey: string,
    metadataValue: string,
) {
    return prisma.source.findFirst({
        where: {
            workspaceId,
            type,
            status: { in: ["PENDING", "PROCESSING", "READY"] },
            metadata: { path: [metadataKey], equals: metadataValue },
        },
        select: sourceSelect,
        orderBy: { createdAt: "desc" },
    });
}

const sourceSummarySelect = {
    id: true,
    title: true,
    type: true,
    url: true,
} as const;

export type SourceSummary = Prisma.SourceGetPayload<{
    select: typeof sourceSummarySelect;
}>;

export function findSourceSummariesByWorkspaceIdAndIds(
    workspaceId: string,
    sourceIds: string[],
) {
    if (sourceIds.length === 0) {
        return Promise.resolve([] as SourceSummary[]);
    }

    // Retrieval and citation reconciliation must never expose an unindexed or
    // failed source, even if stale vectors or chunks still exist.
    return prisma.source.findMany({
        where: {
            workspaceId,
            status: "READY" as const,
            id: { in: sourceIds },
        },
        select: sourceSummarySelect,
        take: 200,
    });
}

/**
 * Deletes a source document from PostgreSQL by its unique ID.
 *
 * @param sourceId - Unique identifier of the source to delete
 */
export async function deleteSourceRecord(sourceId: string) {
    await prisma.source.delete({
        where: { id: sourceId },
    });
}

/**
 * Queries a single source record by its unique ID.
 *
 * @param sourceId - Unique identifier of the source
 * @returns Promise resolving to matching source record or null
 */
export function findSourceById(sourceId: string) {
    return prisma.source.findUnique({
        where: { id: sourceId },
        select: sourceSelect,
    });
}

/**
 * Updates properties (content, status, metadata) of an existing source in PostgreSQL.
 *
 * @param sourceId - Unique identifier of the source to update
 * @param data - Partial update payload
 * @returns Promise resolving to the updated source record
 */
export function updateSourceRecord(
    sourceId: string,
    data: {
        content?: string | null;
        status?: SourceRecord["status"];
        metadata?: Prisma.InputJsonValue;
    },
) {
    return prisma.source.update({
        where: { id: sourceId },
        data,
        select: sourceSelect,
    });
}

/**
 * Conditional completion: only a source still in PROCESSING may become READY.
 * A stale worker cannot overwrite a newer FAILED/READY state.
 */
export async function markSourceReadyIfProcessing(
    sourceId: string,
    metadata: Prisma.InputJsonValue,
): Promise<SourceRecord | null> {
    const changed = await prisma.source.updateMany({
        where: { id: sourceId, status: "PROCESSING" },
        data: { status: "READY", metadata },
    });
    if (changed.count !== 1) return null;
    return prisma.source.findUnique({
        where: { id: sourceId },
        select: sourceSelect,
    });
}
