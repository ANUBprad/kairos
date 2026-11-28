import { createHash, randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { uploadImageToCloudinary, uploadPdfToCloudinary } from "../lib/cloudinary.js";
import { extractTextFromImageBuffer } from "../lib/sources/image-ocr.js";
import {
    normalizeWebsiteUrl,
    scrapeWebsite,
    WEBSITE_MAX_MARKDOWN_CHARS,
    WEBSITE_MAX_TITLE_CHARS,
} from "../lib/sources/firecrawl.js";
import { buildFaviconUrl } from "../lib/sources/favicon.js";
import {
    extractPdfFromBuffer,
    ocrScannedPdf,
    PDF_MAX_PAGES,
    PDF_MAX_TEXT_CHARS,
    PDF_MAX_UPLOAD_BYTES,
    type PdfExtractionDeps,
    type PdfExtractResult,
    type PdfOcr,
} from "../lib/sources/pdf.js";
import { assertSafePublicHttpUrl } from "../lib/safe-fetch.js";
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

type SourceIdentity =
    | { field: "metadata"; metadataKey: string; metadataValue: string }
    | { field: "url"; url: string };

/**
 * Derives the stable identity of an imported source. TEXT/MARKDOWN sources are
 * intentionally user-created documents and may legitimately repeat, so they
 * are not deduplicated here.
 */
export function sourceIdentityFor(data: CreateSourceData): SourceIdentity | null {
    if (data.type === "GITHUB_REPO") {
        return data.url?.trim()
            ? { field: "url", url: data.url.trim() }
            : null;
    }

    const metadata = data.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }
    const record = metadata as Record<string, unknown>;
    const metadataValue = (key: string): string | null => {
        const value = record[key];
        return typeof value === "string" && value.trim() ? value.trim() : null;
    };

    for (const key of [
        "websiteIdentity",
        "contentHash",
        "videoId",
        "driveFileId",
        "notionPageId",
        "publicId",
    ]) {
        const value = metadataValue(key);
        if (value) return { field: "metadata", metadataKey: key, metadataValue: value };
    }
    return null;
}

/**
 * Serializes concurrent imports of the same workspace/type/identity and
 * rechecks inside the transaction. This closes the check-then-create race that
 * would otherwise create two sources and charge twice.
 */
export async function findActiveDuplicateInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateSourceData,
): Promise<SourceRecord | null> {
    const identity = sourceIdentityFor(data);
    if (!identity) return null;

    const client = tx as unknown as {
        $executeRaw?: (
            strings: TemplateStringsArray,
            ...values: unknown[]
        ) => Promise<number>;
        source?: {
            findFirst?: (
                args: Prisma.SourceFindFirstArgs,
            ) => Promise<SourceRecord | null>;
        };
    };
    const lockKey =
        `source-import:${data.workspaceId}:${data.type}:` +
        (identity.field === "url"
            ? `url:${identity.url}`
            : `${identity.metadataKey}:${identity.metadataValue}`);
    if (typeof client.$executeRaw === "function") {
        const executeRaw = client.$executeRaw.bind(client);
        await executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    }

    const findFirst = client.source?.findFirst;
    if (typeof findFirst !== "function") return null;
    const where: Prisma.SourceWhereInput = {
        workspaceId: data.workspaceId,
        type: data.type,
        status: { in: ["PENDING", "PROCESSING", "READY"] },
        ...(identity.field === "url"
            ? { url: identity.url }
            : { metadata: { path: [identity.metadataKey], equals: identity.metadataValue } }),
    };
    return findFirst.call(client.source, {
        where,
        select: sourceSelect,
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Atomic source ingestion: row + debit + outbox job. Exported so failure
 * windows can be exercised with a fake transaction client.
 */
export async function insertSourceCreationInTransaction(
    tx: Prisma.TransactionClient,
    input: SourceCreationTxInput,
): Promise<SourceRecord> {
    const duplicate = await findActiveDuplicateInTransaction(tx, input.data);
    if (duplicate) return duplicate;

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

    // A concurrent import may have won the identity lock. In that case the
    // existing source is returned with no new charge and no new job to dispatch.
    if (source.id !== sourceId) return source;

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

/** Dependencies are injectable so duplicate-import and failure paths can be tested offline. */
export interface WebsiteImportDeps {
    getWorkspace?: typeof getWorkspaceByIdForUser;
    findActiveSource?: typeof findActiveSourceByMetadataKey;
    assertQuota?: typeof assertCanCreateSource;
    scrape?: typeof scrapeWebsite;
    assertSafeUrl?: typeof assertSafePublicHttpUrl;
    createSource?: typeof createAndProcessSource;
}

type ResolvedWebsiteImportDeps = {
    getWorkspace: typeof getWorkspaceByIdForUser;
    findActiveSource: typeof findActiveSourceByMetadataKey;
    assertQuota: typeof assertCanCreateSource;
    scrape: typeof scrapeWebsite;
    assertSafeUrl: typeof assertSafePublicHttpUrl;
    createSource: typeof createAndProcessSource;
};

function resolveWebsiteImportDeps(
    deps?: WebsiteImportDeps,
): ResolvedWebsiteImportDeps {
    return {
        getWorkspace: deps?.getWorkspace ?? getWorkspaceByIdForUser,
        findActiveSource:
            deps?.findActiveSource ?? findActiveSourceByMetadataKey,
        assertQuota: deps?.assertQuota ?? assertCanCreateSource,
        scrape: deps?.scrape ?? scrapeWebsite,
        assertSafeUrl: deps?.assertSafeUrl ?? assertSafePublicHttpUrl,
        createSource: deps?.createSource ?? createAndProcessSource,
    };
}

/**
 * Scrapes a public website via Firecrawl and ingests its bounded markdown as a
 * workspace source. Repeated imports of the same normalised URL reuse the
 * active source instead of charging credits again.
 */
export async function importWebsiteSource(
    workspaceId: string,
    userId: string,
    input: ImportWebsiteInput,
    deps?: WebsiteImportDeps,
) {
    const resolved = resolveWebsiteImportDeps(deps);
    await resolved.getWorkspace(workspaceId, userId);

    const identity = normalizeWebsiteUrl(input.url);
    if (!identity) {
        throw new ValidationError("Enter a valid public http(s) URL");
    }

    const existing = await resolved.findActiveSource(
        workspaceId,
        "WEBSITE",
        "websiteIdentity",
        identity,
    );
    if (existing) {
        return existing;
    }

    await resolved.assertQuota(userId);
    const scraped = await resolved.scrape(input.url);

    // A 200 response is not a successful import: only bounded, non-empty
    // extracted content may be persisted and later marked READY.
    const content =
        typeof scraped?.markdown === "string" ? scraped.markdown.trim() : "";
    if (!content) {
        throw new ValidationError(
            "This page has no readable text to import. It may require JavaScript or block automated access.",
        );
    }
    if (content.length > WEBSITE_MAX_MARKDOWN_CHARS) {
        throw new ValidationError(
            "This page contains too much text to import. Try a smaller page.",
        );
    }

    // A provider-reported canonical URL after redirects must pass the same
    // public-URL checks as the submitted URL. Never persist an unsafe URL.
    let sourceUrl = identity;
    if (typeof scraped?.sourceUrl === "string" && scraped.sourceUrl.trim()) {
        try {
            sourceUrl = (
                await resolved.assertSafeUrl(scraped.sourceUrl.trim())
            ).toString();
        } catch {
            throw new ValidationError(
                "The scraper returned an unsafe redirect URL. Try a different public URL.",
            );
        }
    }
    const faviconUrl = buildFaviconUrl(sourceUrl);

    return resolved.createSource(
        {
            workspaceId,
            type: "WEBSITE",
            title: (
                input.title?.trim() ||
                (typeof scraped?.title === "string" ? scraped.title : "") ||
                identity
            ).slice(0, WEBSITE_MAX_TITLE_CHARS),
            content,
            url: sourceUrl,
            status: "PENDING",
            metadata: {
                importedFrom: sourceUrl,
                websiteIdentity: identity,
                ...(faviconUrl ? { faviconUrl } : {}),
            },
        },
        userId,
    );
}

/** Dependencies are injectable so storage/parser failures can be tested offline. */
export interface PdfUploadDeps {
    getWorkspace?: typeof getWorkspaceByIdForUser;
    findActiveSource?: typeof findActiveSourceByMetadataKey;
    assertQuota?: typeof assertCanCreateSource;
    extractPdf?: (
        buffer: Buffer,
        deps?: PdfExtractionDeps,
    ) => Promise<PdfExtractResult>;
    uploadPdf?: typeof uploadPdfToCloudinary;
    createSource?: typeof createAndProcessSource;
    ocr?: PdfOcr;
}

type ResolvedPdfUploadDeps = {
    getWorkspace: typeof getWorkspaceByIdForUser;
    findActiveSource: typeof findActiveSourceByMetadataKey;
    assertQuota: typeof assertCanCreateSource;
    extractPdf: (
        buffer: Buffer,
        deps?: PdfExtractionDeps,
    ) => Promise<PdfExtractResult>;
    uploadPdf: typeof uploadPdfToCloudinary;
    createSource: typeof createAndProcessSource;
    ocr: PdfOcr;
};

function resolvePdfUploadDeps(deps?: PdfUploadDeps): ResolvedPdfUploadDeps {
    return {
        getWorkspace: deps?.getWorkspace ?? getWorkspaceByIdForUser,
        findActiveSource:
            deps?.findActiveSource ?? findActiveSourceByMetadataKey,
        assertQuota: deps?.assertQuota ?? assertCanCreateSource,
        extractPdf: deps?.extractPdf ?? extractPdfFromBuffer,
        uploadPdf: deps?.uploadPdf ?? uploadPdfToCloudinary,
        createSource: deps?.createSource ?? createAndProcessSource,
        ocr: deps?.ocr ?? ocrScannedPdf,
    };
}

/** Safe provider diagnostics: status codes and error names only, never bodies. */
function providerDiagnostic(error: unknown): Record<string, unknown> {
    const status =
        error && typeof error === "object" && "status" in error
            ? Number((error as { status?: unknown }).status)
            : undefined;
    const rawName = error instanceof Error ? error.name : "UnknownError";
    return {
        errorName: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(rawName)
            ? rawName
            : "ProviderError",
        status:
            typeof status === "number" && Number.isInteger(status)
                ? status
                : undefined,
    };
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
    deps?: PdfUploadDeps,
) {
    const resolved = resolvePdfUploadDeps(deps);
    await resolved.getWorkspace(workspaceId, userId);

    if (!Buffer.isBuffer(file?.buffer) || file.buffer.byteLength === 0) {
        throw new ValidationError("PDF file is empty");
    }
    if (!/\.pdf$/i.test(file.originalname ?? "")) {
        throw new ValidationError("Only PDF files are supported");
    }

    // Multer enforces this on the HTTP boundary; guard the service too so a
    // direct caller cannot bypass the upload cap.
    if (file.buffer.byteLength > PDF_MAX_UPLOAD_BYTES) {
        throw new ValidationError(
            "PDF is too large. The maximum upload size is 25 MB.",
        );
    }

    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await resolved.findActiveSource(
        workspaceId,
        "PDF",
        "contentHash",
        contentHash,
    );
    if (existing) {
        return existing;
    }

    await resolved.assertQuota(userId);

    // Fail closed before storage, charging, or job creation. A corrupt,
    // encrypted, or unreadable PDF must not become a charged source.
    const extracted = await resolved.extractPdf(file.buffer, {
        ocr: resolved.ocr,
    });
    const content = extracted.text.trim();
    if (!content) {
        throw new ValidationError("No text could be extracted from the PDF");
    }
    if (content.length > PDF_MAX_TEXT_CHARS) {
        throw new ValidationError(
            "PDF contains too much text to index. Split it into smaller documents.",
        );
    }
    if (
        !Number.isInteger(extracted.pageCount) ||
        extracted.pageCount < 1 ||
        extracted.pageCount > PDF_MAX_PAGES
    ) {
        throw new ValidationError(
            `PDF has too many pages. The maximum is ${PDF_MAX_PAGES} pages.`,
        );
    }

    // Storage is part of ingestion success: a PDF that cannot be stored must
    // never be reported as uploaded or charged for indexing.
    let upload: Awaited<ReturnType<ResolvedPdfUploadDeps["uploadPdf"]>> | undefined;
    try {
        upload = await resolved.uploadPdf(file.buffer, file.originalname);
    } catch (storageError) {
        logger.warn("PDF storage failed", providerDiagnostic(storageError));
        throw new ValidationError(
            "The PDF could not be stored. Please try again.",
            { code: "PDF_UPLOAD_FAILED" },
        );
    }
    if (!upload?.secureUrl || !upload?.publicId) {
        throw new ValidationError(
            "The PDF could not be stored. Please try again.",
            { code: "PDF_UPLOAD_FAILED" },
        );
    }

    return resolved.createSource(
        {
            workspaceId,
            type: "PDF",
            title: (title?.trim() || file.originalname.replace(/\.pdf$/i, "")).slice(
                0,
                WEBSITE_MAX_TITLE_CHARS,
            ),
            content,
            status: "PENDING",
            metadata: {
                fileUrl: upload.secureUrl,
                fileName: upload.originalFilename || file.originalname,
                fileSize: upload.bytes || file.buffer.byteLength,
                publicId: upload.publicId,
                resourceType: upload.resourceType,
                contentHash,
                pageCount: extracted.pageCount,
                pageTexts: extracted.pages,
                ...(extracted.ocrModel ? { ocrModel: extracted.ocrModel } : {}),
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