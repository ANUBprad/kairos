import { createHash, randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { uploadImageToCloudinary, uploadPdfToCloudinary } from "../lib/cloudinary.js";
import { extractTextFromImageBuffer } from "../lib/sources/image-ocr.js";
import { scrapeWebsite } from "../lib/sources/firecrawl.js";
import { buildFaviconUrl } from "../lib/sources/favicon.js";
import { extractPdfFromBuffer } from "../lib/sources/pdf.js";
import prisma from "../lib/db.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
    dispatchDurableJob,
    insertDurableJob,
    logDurableJobError,
    requeueDurableJob,
} from "../lib/outbox.js";
import {
    deleteSourceVectors,
    isIgnorablePineconeDeleteError,
} from "../lib/pinecone.js";
import { fetchYoutubeTranscript } from "../lib/sources/youtube.js";
import { parseYouTubeVideoUrl } from "../lib/sources/youtube-url.js";
import {
    deleteSourceRecord,
    findActiveSourceByMetadataKey,
    findSourceByIdAndWorkspaceId,
    findSourcesByWorkspaceId,
    markSourcePendingIfFailed,
    sourceSelect,
    type CreateSourceData,
    type SourceRecord,
} from "../repository/source.repository.js";
import { NotFoundError, ValidationError } from "../types/app-error.js";
import { CreateSourceInput, ImportWebsiteInput, ImportYoutubeInput, ListSourcesQuery } from "../validators/source.validator.js";
import { getWorkspaceByIdForUser } from "./workspace.services.js";
import {
    CREDIT_COSTS,
    debitCreditsInTransaction,
} from "./credit.services.js";
import {
    assertCanCreateSource,
    assertQuotaInTransaction,
} from "./usage.services.js";

/**
 * Verifies that the given user has read/write access to the specified workspace.
 *
 * @param workspaceId - Workspace identifier to verify
 * @param userId - Authenticated user's identifier
 * @throws {NotFoundError} When workspace does not exist or user lacks access
 */
async function assertWorkspaceAccess(workspaceId: string, userId: string) {
    await getWorkspaceByIdForUser(workspaceId, userId);
}

export interface SourceCreationTxInput {
    sourceId: string;
    userId: string;
    data: CreateSourceData;
    chargeIdempotencyKey: string;
    jobKey: string;
}

/**
 * Atomic source ingestion: row + debit + outbox job. Exported so failure
 * windows can be exercised with a fake transaction client.
 */
export async function insertSourceCreationInTransaction(
    tx: Prisma.TransactionClient,
    input: SourceCreationTxInput,
): Promise<SourceRecord> {
    await assertQuotaInTransaction(tx, input.userId, "sources");

    const source = await tx.source.create({
        data: {
            id: input.sourceId,
            workspaceId: input.data.workspaceId,
            type: input.data.type,
            title: input.data.title,
            content: input.data.content ?? null,
            url: input.data.url ?? null,
            status: input.data.status ?? "PENDING",
            metadata: input.data.metadata,
        },
        select: sourceSelect,
    });

    await debitCreditsInTransaction(tx, {
        userId: input.userId,
        amount: CREDIT_COSTS.SOURCE_UPLOAD,
        type: "SOURCE_UPLOAD",
        description: "Uploaded a source document",
        metadata: { sourceId: input.sourceId },
        idempotencyKey: input.chargeIdempotencyKey,
    });

    await insertDurableJob(tx, {
        key: input.jobKey,
        type: "source.process",
        payload: {
            sourceId: input.sourceId,
            workspaceId: source.workspaceId,
            title: source.title,
            sourceType: source.type,
            chargeIdempotencyKey: input.chargeIdempotencyKey,
        },
    });

    return source;
}

/**
 * Persists a source and its durable processing job in one transaction, then
 * dispatches after commit. Enqueue/fallback failures can never leave a charged
 * source whose processing job was lost.
 */
export async function createAndProcessSource(
    data: CreateSourceData,
    userId: string,
) {
    const sourceId = randomUUID();
    const jobKey = `source.process:${sourceId}`;
    const chargeIdempotencyKey = `source-charge:${sourceId}`;

    const source = await prisma.$transaction((tx) =>
        insertSourceCreationInTransaction(tx, {
            sourceId,
            userId,
            data,
            chargeIdempotencyKey,
            jobKey,
        }),
    );

    void dispatchDurableJob(jobKey).catch((error) => {
        logDurableJobError(jobKey, error);
    });

    return source;
}

const SOURCE_REFUND_KEY_PREFIX = "source-refund:";

export type SourceRetryState = {
    refunded: boolean;
    canReprocess: boolean;
};

export type SourceWithRetryState = SourceRecord & SourceRetryState;

type JobDispatcher = (jobKey: string) => Promise<boolean>;

/**
 * Adds ledger-derived retry state to source API responses. The ledger, not a
 * mutable metadata flag, is the source of truth for whether a refund happened.
 */
export function applySourceRetryState<T extends SourceRecord>(
    sources: T[],
    refundedIds: ReadonlySet<string>,
): Array<T & SourceRetryState> {
    return sources.map((source) => {
        const refunded = refundedIds.has(source.id);
        return {
            ...source,
            refunded,
            canReprocess:
                !refunded &&
                source.status !== "PROCESSING" &&
                source.status !== "READY",
        };
    });
}

async function decorateSourcesWithRetryState(
    sources: SourceRecord[],
): Promise<SourceWithRetryState[]> {
    if (sources.length === 0) return [];

    const refunds = await prisma.creditTransaction.findMany({
        where: {
            idempotencyKey: {
                in: sources.map(
                    (source) => `${SOURCE_REFUND_KEY_PREFIX}${source.id}`,
                ),
            },
        },
        select: { idempotencyKey: true },
    });
    const refundedIds = new Set(
        refunds
            .map((row) => row.idempotencyKey)
            .filter(
                (key): key is string =>
                    typeof key === "string" &&
                    key.startsWith(SOURCE_REFUND_KEY_PREFIX),
            )
            .map((key) => key.slice(SOURCE_REFUND_KEY_PREFIX.length)),
    );

    return applySourceRetryState(sources, refundedIds);
}

/**
 * A source whose terminal failure was refunded must be imported again so a new
 * charge is recorded. Reusing its original charge key would be free work.
 */
async function wasSourceRefunded(sourceId: string): Promise<boolean> {
    const refund = await prisma.creditTransaction.findUnique({
        where: {
            idempotencyKey: `${SOURCE_REFUND_KEY_PREFIX}${sourceId}`,
        },
        select: { id: true },
    });
    return refund !== null;
}

/**
 * Reuses the durable job for a re-processing request (no new charge).
 * Returns the job key only when the job was really rewound; a live or already
 * delivered job must not be reported as successfully requeued.
 */
async function requeueSourceProcessing(
    source: SourceRecord,
): Promise<string | null> {
    const jobKey = `source.process:${source.id}`;
    const requeued = await requeueDurableJob(jobKey, {
        key: jobKey,
        type: "source.process",
        payload: {
            sourceId: source.id,
            workspaceId: source.workspaceId,
            title: source.title,
            sourceType: source.type,
            chargeIdempotencyKey: `source-charge:${source.id}`,
        },
    });
    return requeued ? jobKey : null;
}

function dispatchSourceProcessingJob(
    jobKey: string,
    dispatch: JobDispatcher = dispatchDurableJob,
): void {
    void dispatch(jobKey).catch((error) => {
        logDurableJobError(jobKey, error);
    });
}

/**
 * Lists all sources belonging to a workspace with optional filters (e.g. status, type).
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param filters - Optional query parameters to filter sources
 * @returns Array of source records matching the query
 */
export async function listSourcesForWorkspace(
    workspaceId: string,
    userId: string,
    filters: ListSourcesQuery = {},
): Promise<SourceWithRetryState[]> {
    await assertWorkspaceAccess(workspaceId, userId);
    return decorateSourcesWithRetryState(
        await findSourcesByWorkspaceId(workspaceId, filters),
    );
}

/**
 * Fetches a single source by ID within the scope of a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param sourceId - Source document identifier
 * @param userId - Authenticated user's identifier
 * @returns The requested source record
 * @throws {NotFoundError} If the source does not exist in the specified workspace
 */
export async function getSourceForWorkspace(
    workspaceId: string,
    sourceId: string,
    userId: string,
): Promise<SourceWithRetryState> {
    await assertWorkspaceAccess(workspaceId, userId);

    const source = await findSourceByIdAndWorkspaceId(sourceId, workspaceId);

    if (!source) {
        throw new NotFoundError("Source not found");
    }

    const [decorated] = await decorateSourcesWithRetryState([source]);
    return decorated!;
}

/**
 * Deletes a single source document and its associated chunks from a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param sourceId - Source document identifier to delete
 * @param userId - Authenticated user's identifier
 */
export async function deleteSourceForWorkspace(
    workspaceId: string,
    sourceId: string,
    userId: string,
) {
    await getSourceForWorkspace(workspaceId, sourceId, userId);
    try {
        await deleteSourceVectors(workspaceId, sourceId);
    } catch (err) {
        if (!isIgnorablePineconeDeleteError(err)) {
            logger.warn("Failed to delete Pinecone vectors for source", {
                sourceId,
                err,
            });
        }
    }
    await deleteSourceRecord(sourceId);
}

/**
 * Deletes multiple sources in batch from a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param sourceIds - Array of source document identifiers to delete
 */
export async function bulkDeleteSourcesForWorkspace(
    workspaceId: string,
    userId: string,
    sourceIds: string[],
) {
    await assertWorkspaceAccess(workspaceId, userId);

    for (const sourceId of sourceIds) {
        await deleteSourceForWorkspace(workspaceId, sourceId, userId);
    }
}

/**
 * Ingests a raw text or markdown document into a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param input - Payload containing source title, type, and text content
 * @returns The created and enqueued source record
 */
export async function createTextOrMarkdownSource(
    workspaceId: string,
    userId: string,
    input: CreateSourceInput,
) {
    await assertWorkspaceAccess(workspaceId, userId);
    await assertCanCreateSource(userId);

    return createAndProcessSource(
        {
            workspaceId,
            type: input.type,
            title: input.title,
            content: input.content,
            status: "PENDING",
        },
        userId,
    );
}

/**
 * Scrapes a public website via Firecrawl and ingests its markdown content as a workspace source.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param input - Payload containing target URL and optional custom title
 * @returns The created and enqueued source record
 */
export async function importWebsiteSource(
    workspaceId: string,
    userId: string,
    input: ImportWebsiteInput,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateSource(userId);

    const scraped = await scrapeWebsite(input.url);
    const faviconUrl = buildFaviconUrl(scraped.sourceUrl);

    return createAndProcessSource(
        {
            workspaceId,
            type: "WEBSITE",
            title: input.title || scraped.title || input.url,
            content: scraped.markdown,
            url: scraped.sourceUrl,
            status: "PENDING",
            metadata: {
                importedFrom: scraped.sourceUrl,
                ...(faviconUrl ? { faviconUrl } : {}),
            },
        },
        userId,
    );
}

/**
 * Uploads a PDF file to Cloudinary, extracts its textual content and page count, and creates a source record.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param file - Multer uploaded file containing buffer and original name
 * @param title - Optional custom title for the PDF source
 * @returns The created and enqueued source record
 */
export async function uploadPdfSource(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    title?: string,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);

    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await findActiveSourceByMetadataKey(
        workspaceId,
        "PDF",
        "contentHash",
        contentHash,
    );
    if (existing) {
        return existing;
    }

    await assertCanCreateSource(userId);

    // Fail closed before Cloudinary upload, charging, or job creation. A
    // corrupt, encrypted, or image-only PDF must not become a charged source.
    const extracted = await extractPdfFromBuffer(file.buffer);

    let uploadMetadata: Record<string, unknown> = {};
    try {
        const upload = await uploadPdfToCloudinary(
            file.buffer,
            file.originalname,
        );
        uploadMetadata = {
            fileUrl: upload.secureUrl,
            fileName: upload.originalFilename,
            fileSize: upload.bytes,
            publicId: upload.publicId,
            resourceType: upload.resourceType,
        };
    } catch (cloudErr) {
        logger.warn("Cloudinary upload skipped or failed (PDF will still be indexed locally)", { err: cloudErr });
        uploadMetadata = {
            fileName: file.originalname,
            fileSize: file.size,
        };
    }

    return createAndProcessSource(
        {
            workspaceId,
            type: "PDF",
            title: title?.trim() || file.originalname.replace(/\.pdf$/i, ""),
            content: extracted.text,
            status: "PENDING",
            metadata: {
                ...uploadMetadata,
                contentHash,
                pageCount: extracted.pageCount,
                pageTexts: extracted.pages,
            },
        },
        userId,
    );
}

/**
 * Uploads an image to Cloudinary, runs vision OCR, and creates an IMAGE source for RAG.
 */
export async function uploadImageSource(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    title?: string,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateSource(userId);

    let content: string | null = null;
    let ocrModel: string | undefined;

    try {
        const ocr = await extractTextFromImageBuffer(
            file.buffer,
            file.mimetype,
        );
        content = ocr.text;
        ocrModel = ocr.model;
    } catch (parseErr) {
        logger.warn("Image OCR at upload notice", { err: parseErr });
    }

    let uploadMetadata: Record<string, unknown> = {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
    };

    try {
        const upload = await uploadImageToCloudinary(
            file.buffer,
            file.originalname,
            file.mimetype,
        );
        uploadMetadata = {
            ...uploadMetadata,
            fileUrl: upload.secureUrl,
            publicId: upload.publicId,
            resourceType: upload.resourceType,
        };
    } catch (cloudErr) {
        logger.warn("Cloudinary image upload skipped or failed", { err: cloudErr });
        if (!content) {
            throw cloudErr;
        }
    }

    const fileUrl =
        typeof uploadMetadata.fileUrl === "string"
            ? uploadMetadata.fileUrl
            : undefined;

    return createAndProcessSource(
        {
            workspaceId,
            type: "IMAGE",
            title:
                title?.trim() ||
                file.originalname.replace(/\.[^/.]+$/, "") ||
                "Image",
            content,
            url: fileUrl,
            status: "PENDING",
            metadata: {
                ...uploadMetadata,
                ...(ocrModel ? { ocrModel } : {}),
            },
        },
        userId,
    );
}

/**
 * Extracts transcripts and video metadata from a YouTube video URL and ingests it as a workspace source.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param input - Payload containing YouTube URL and optional custom title
 * @returns The created and enqueued source record
 */
export async function importYoutubeSource(
    workspaceId: string,
    userId: string,
    input: ImportYoutubeInput,
) {
    await getWorkspaceByIdForUser(workspaceId, userId);

    const parsed = parseYouTubeVideoUrl(input.url);
    if (!parsed) {
        throw new ValidationError("Enter a valid YouTube URL");
    }

    const existing = await findActiveSourceByMetadataKey(
        workspaceId,
        "YOUTUBE",
        "videoId",
        parsed.videoId,
    );
    if (existing) {
        return existing;
    }

    await assertCanCreateSource(userId);
    const transcript = await fetchYoutubeTranscript(input.url);

    return createAndProcessSource(
        {
            workspaceId,
            type: "YOUTUBE",
            title:
                input.title?.trim() ||
                transcript.title ||
                `YouTube: ${transcript.videoId}`,
            content: transcript.content,
            url: transcript.canonicalUrl,
            status: "PENDING",
            metadata: {
                videoId: transcript.videoId,
                canonicalUrl: transcript.canonicalUrl,
                videoTitle: transcript.title,
                ...(transcript.author ? { videoAuthor: transcript.author } : {}),
                ...(transcript.lengthSeconds !== undefined
                    ? { videoDurationSeconds: transcript.lengthSeconds }
                    : {}),
                ...(transcript.language ? { language: transcript.language } : {}),
                captionSource: transcript.captionSource,
                ...(transcript.segments.length > 0
                    ? { transcriptSegments: transcript.segments }
                    : {}),
            },
        },
        userId,
    );
}

/**
 * Ingests external web search results as a permanent website source in a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param input - Web source parameters containing title, content, and original URL
 * @returns The created and enqueued source record
 */
export async function importWebSearchSource(
    workspaceId: string,
    userId: string,
    input: { title: string; content: string; url: string },
) {
    await getWorkspaceByIdForUser(workspaceId, userId);
    await assertCanCreateSource(userId);

    const faviconUrl = buildFaviconUrl(input.url);

    return createAndProcessSource(
        {
            workspaceId,
            type: "WEBSITE",
            title: input.title,
            content: input.content,
            url: input.url,
            status: "PENDING",
            metadata: {
                importedFrom: input.url,
                isWebSearch: true,
                ...(faviconUrl ? { faviconUrl } : {}),
            },
        },
        userId,
    );
}

/**
 * Triggers re-processing (re-extraction, re-chunking, and re-indexing) for a single source.
 *
 * @param workspaceId - Target workspace identifier
 * @param sourceId - Source identifier to reprocess
 * @param userId - Authenticated user's identifier
 * @returns Status confirmation object `{ reprocessed: true }`
 */
export async function reprocessSourceForWorkspace(
    workspaceId: string,
    sourceId: string,
    userId: string,
    dispatch: JobDispatcher = dispatchDurableJob,
) {
    const source = await getSourceForWorkspace(workspaceId, sourceId, userId);

    if (source.refunded || (await wasSourceRefunded(sourceId))) {
        throw new ValidationError(
            "This source was refunded after a terminal failure. Import it again to be charged and processed.",
        );
    }

    if (source.status === "PROCESSING" || source.status === "READY") {
        throw new ValidationError(
            "This source is already processing or ready and cannot be reprocessed.",
        );
    }

    // Requeue first: a refused job must not leave the source rewound to PENDING
    // with no worker behind it. The conditional status update below is safe if
    // the reissued job is claimed before this call resumes.
    const jobKey = await requeueSourceProcessing(source);
    if (!jobKey) {
        throw new ValidationError(
            "This source has a live or already completed processing job and cannot be reprocessed.",
        );
    }

    if (source.status === "FAILED") {
        const priorMetadata =
            (source.metadata as Record<string, unknown> | null) ?? {};
        await markSourcePendingIfFailed(sourceId, {
            ...priorMetadata,
            processingError: undefined,
            retriedAt: new Date().toISOString(),
        });
    }

    dispatchSourceProcessingJob(jobKey, dispatch);
    return { reprocessed: true };
}

/**
 * Triggers re-processing for all or a filtered subset of sources in a workspace.
 *
 * @param workspaceId - Target workspace identifier
 * @param userId - Authenticated user's identifier
 * @param sourceIds - Optional array of source IDs to restrict re-processing
 * @returns Count of sources submitted for re-processing
 */
export async function reprocessSourcesForWorkspace(
    workspaceId: string,
    userId: string,
    sourceIds?: string[],
    dispatch: JobDispatcher = dispatchDurableJob,
) {
    await assertWorkspaceAccess(workspaceId, userId);

    const sources = await decorateSourcesWithRetryState(
        await findSourcesByWorkspaceId(workspaceId),
    );
    const targetSources = sourceIds?.length
        ? sources.filter((s) => sourceIds.includes(s.id))
        : sources;

    let requeued = 0;
    for (const source of targetSources) {
        // Skip compensated sources; they must be re-imported with a new charge.
        if (source.refunded || (await wasSourceRefunded(source.id))) continue;
        // Never rewind a live pipeline or overwrite finished work.
        if (source.status === "PROCESSING" || source.status === "READY") continue;

        const jobKey = await requeueSourceProcessing(source);
        if (!jobKey) continue;

        if (source.status === "FAILED") {
            const priorMetadata =
                (source.metadata as Record<string, unknown> | null) ?? {};
            await markSourcePendingIfFailed(source.id, {
                ...priorMetadata,
                processingError: undefined,
                retriedAt: new Date().toISOString(),
            });
        }

        dispatchSourceProcessingJob(jobKey, dispatch);
        requeued += 1;
    }

    return { reprocessed: requeued };
}

/**
 * Fetches all indexed text chunks and token metadata associated with a specific source.
 *
 * @param workspaceId - Target workspace identifier
 * @param sourceId - Source identifier to retrieve chunks for
 * @param userId - Authenticated user's identifier
 * @returns Object containing sourceId, workspaceId, chunks list, and chunk count
 */
export async function getSourceChunksForWorkspace(
    workspaceId: string,
    sourceId: string,
    userId: string,
) {
    await getSourceForWorkspace(workspaceId, sourceId, userId);
    // API responses are bounded; internal indexing paths intentionally read
    // the full chunk set.
    const chunks = await (await import("../repository/source-chunk.repository.js")).findChunksBySourceId(sourceId, 2000);
    return {
        sourceId,
        workspaceId,
        chunks,
        count: chunks.length,
    };
}