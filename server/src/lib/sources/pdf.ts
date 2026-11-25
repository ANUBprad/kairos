import { extractText, getDocumentProxy } from "unpdf";
import { ValidationError } from "../../types/app-error.js";
import { getSignedCloudinaryDownloadUrl } from "../cloudinary.js";
import { safeFetchBuffer } from "../safe-fetch.js";


export type PdfExtractResult = {
    text: string;
    pages: string[];
    pageCount: number;
};

export type PdfExtractionErrorCode =
    | "CORRUPT"
    | "ENCRYPTED"
    | "NO_TEXT";

/** Safe, client-facing PDF failures are validation errors with a stable code. */
export class PdfExtractionError extends ValidationError {
    constructor(
        public readonly code: PdfExtractionErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "PdfExtractionError";
    }
}

/** Classifies library failures without exposing provider internals to clients. */
export function classifyPdfExtractionError(error: unknown): PdfExtractionError {
    const message = error instanceof Error ? error.message : String(error);

    if (/password|encrypted/i.test(message)) {
        return new PdfExtractionError(
            "ENCRYPTED",
            "Encrypted PDFs are not supported. Upload a version without a password.",
        );
    }
    if (/no text|could not extract|empty page/i.test(message)) {
        return new PdfExtractionError(
            "NO_TEXT",
            "No text could be extracted from the PDF. Scanned or image-only PDFs are not supported.",
        );
    }
    return new PdfExtractionError(
        "CORRUPT",
        "The uploaded file is not a readable PDF.",
    );
}


/**
 * Downloads a binary PDF file from a remote HTTP/HTTPS URL into an ArrayBuffer.
 *
 * @param url - Remote PDF asset URL
 * @returns Promise resolving to ArrayBuffer of PDF bytes
 * @throws {Error} When network request fails
 */
async function downloadPdf(url: string) {
    const { buffer } = await safeFetchBuffer(url, {
        maxBytes: 25 * 1024 * 1024,
        timeoutMs: 20_000,
        allowedContentTypes: ["application/pdf", "application/octet-stream", "binary/octet-stream"],
    });
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
}

/**
 * Parses and extracts text content from an in-memory PDF binary buffer using `unpdf`.
 *
 * @param buffer - ArrayBuffer or Node Buffer containing PDF file data
 * @returns Object with concatenated text, array of page-level strings, and total page count
 * @throws {Error} When text cannot be extracted or document contains no readable text
 */
export async function extractPdfFromBuffer(
    buffer: ArrayBuffer | Buffer,
): Promise<PdfExtractResult> {
    const arrayBuffer =
        buffer instanceof Buffer
            ? (buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength,
            ) as ArrayBuffer)
            : buffer;

    let extracted: Awaited<ReturnType<typeof extractText>>;
    try {
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        extracted = await extractText(pdf, { mergePages: false });
    } catch (error) {
        throw classifyPdfExtractionError(error);
    }

    const rawPages = Array.isArray(extracted.text)
        ? extracted.text.map((page) => String(page ?? "").trim())
        : [String(extracted.text ?? "").trim()];
    const reportedCount = Number(extracted.totalPages);
    const pageCount =
        Number.isInteger(reportedCount) && reportedCount > 0
            ? reportedCount
            : rawPages.length;
    // Keep blank pages in place. Chunk metadata uses the array index as the
    // physical 1-based page number, so filtering empties would renumber pages.
    const pages = rawPages.slice(0, pageCount);
    while (pages.length < pageCount) {
        pages.push("");
    }

    const joined = pages.filter(Boolean).join("\n\n");
    if (!joined || pageCount === 0) {
        throw classifyPdfExtractionError(
            new Error("No text could be extracted from the PDF"),
        );
    }

    return {
        text: joined,
        pages,
        pageCount,
    };
}

/**
 * Returns true for Cloudinary delivery failures that can be caused by a private
 * asset. Parse failures and 5xx responses are not retried with a signed URL.
 */
export function shouldRetryPdfDownloadWithSignedUrl(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return /Remote fetch failed \((401|403|404)\)/.test(error.message);
}

/**
 * Downloads a PDF file from Cloudinary (supporting private signed URL fallbacks) and extracts its textual content.
 *
 * @param input - Object containing fileUrl, optional publicId, and resourceType
 * @returns Promise resolving to parsed PDF text and page arrays
 * @throws {Error} If download fails or authentication is required but missing
 */
export async function extractPdfFromCloudinary(input: {
    fileUrl: string;
    publicId?: string;
    resourceType?: "raw" | "image";
}): Promise<PdfExtractResult> {
    try {
        const buffer = await downloadPdf(input.fileUrl);
        return await extractPdfFromBuffer(buffer);
    } catch (error) {
        if (
            !shouldRetryPdfDownloadWithSignedUrl(error) ||
            !input.publicId
        ) {
            throw error;
        }

        const signedUrl = getSignedCloudinaryDownloadUrl(
            input.publicId,
            input.resourceType ?? "raw",
        );

        if (!signedUrl) {
            throw new Error(
                "PDF download requires authentication. Add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to server/.env, or re-upload the PDF.",
            );
        }

        const buffer = await downloadPdf(signedUrl);
        return extractPdfFromBuffer(buffer);
    }
}