import { extractText, getDocumentProxy } from "unpdf";
import { ValidationError } from "../../types/app-error.js";
import { GEMINI_OCR_MODEL, OCR_PROVIDER } from "../ai-config.js";
import { getSignedCloudinaryDownloadUrl } from "../cloudinary.js";
import { providerFetch } from "../provider-http.js";
import { safeFetchBuffer } from "../safe-fetch.js";


export type PdfExtractResult = {
    text: string;
    pages: string[];
    pageCount: number;
    /** Set when a scanned PDF was transcribed by the configured vision provider. */
    ocrModel?: string;
};

/**
 * Scanned-page OCR is injectable so ingestion can be tested without a live
 * provider. The production implementation reuses the configured Gemini OCR
 * provider and model (the same OCR path used for images).
 */
export type PdfOcr = (buffer: Buffer) => Promise<{ text: string; model?: string }>;

export interface PdfExtractionDeps {
    ocr?: PdfOcr;
}

/** Upload and indexing limits keep a single source from monopolising storage or embedding work. */
export const PDF_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const PDF_MAX_PAGES = 400;
export const PDF_MAX_TEXT_CHARS = 500_000;

export type PdfExtractionErrorCode =
    | "CORRUPT"
    | "ENCRYPTED"
    | "NO_TEXT"
    | "OCR_FAILED"
    | "TOO_LARGE";

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

const PDF_OCR_INSTRUCTIONS =
    "Transcribe all readable text from this PDF into plain text. Preserve headings, lists and page order. Do not wrap the answer in code fences.";

/**
 * Gemini accepts PDF bytes inline, so a scanned PDF can use the same configured
 * OCR provider as images without rasterising pages on the server. Provider
 * response bodies are never logged or reflected to the caller.
 */
export async function ocrScannedPdf(
    buffer: Buffer,
): Promise<{ text: string; model: string }> {
    if (OCR_PROVIDER !== "gemini") {
        throw new PdfExtractionError(
            "OCR_FAILED",
            "Scanned PDF OCR requires OCR_PROVIDER=gemini. Upload a PDF with readable text instead.",
        );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new PdfExtractionError(
            "OCR_FAILED",
            "This PDF has no readable text. Configure GEMINI_API_KEY and OCR_PROVIDER=gemini to enable scanned-PDF OCR, or upload a text PDF.",
        );
    }

    let response: Awaited<ReturnType<typeof providerFetch>>;
    try {
        response = await providerFetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_OCR_MODEL)}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: PDF_OCR_INSTRUCTIONS },
                                {
                                    inline_data: {
                                        mime_type: "application/pdf",
                                        data: buffer.toString("base64"),
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
                }),
            },
        );
    } catch {
        throw new PdfExtractionError(
            "OCR_FAILED",
            "Scanned PDF OCR is temporarily unavailable. Please try again.",
        );
    }

    if (!response.ok) {
        throw new PdfExtractionError(
            "OCR_FAILED",
            response.status === 429 || response.status === 503
                ? "The OCR provider is rate limiting requests. Please try again shortly."
                : "The OCR provider could not read this scanned PDF. Try a text-based PDF instead.",
        );
    }

    let text = "";
    try {
        const payload = (await response.json()) as {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };
        text = (payload.candidates?.[0]?.content?.parts ?? [])
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("\n")
            .trim();
    } catch {
        throw new PdfExtractionError(
            "OCR_FAILED",
            "The OCR provider returned an unreadable response. Please try again.",
        );
    }

    if (!text) {
        throw new PdfExtractionError(
            "NO_TEXT",
            "No text could be extracted from this scanned PDF.",
        );
    }
    if (text.length > PDF_MAX_TEXT_CHARS) {
        throw new PdfExtractionError(
            "TOO_LARGE",
            "PDF contains too much text to index. Split it into smaller documents.",
        );
    }

    return { text, model: GEMINI_OCR_MODEL };
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
    deps: PdfExtractionDeps = {},
): Promise<PdfExtractResult> {
    if (buffer.byteLength > PDF_MAX_UPLOAD_BYTES) {
        throw new PdfExtractionError(
            "TOO_LARGE",
            "PDF is too large. The maximum upload size is 25 MB.",
        );
    }

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

    if (pages.length > PDF_MAX_PAGES) {
        throw new PdfExtractionError(
            "TOO_LARGE",
            `PDF has too many pages. The maximum is ${PDF_MAX_PAGES} pages.`,
        );
    }

    const totalChars = pages.reduce((sum, page) => sum + page.length, 0);
    if (totalChars > PDF_MAX_TEXT_CHARS) {
        throw new PdfExtractionError(
            "TOO_LARGE",
            "PDF contains too much text to index. Split it into smaller documents.",
        );
    }

    const joined = pages.filter(Boolean).join("\n\n");
    if (!joined || pageCount === 0) {
        if (!deps.ocr) {
            throw new PdfExtractionError(
                "NO_TEXT",
                "No text could be extracted from the PDF. Scanned or image-only PDFs need OCR.",
            );
        }

        // A scanned PDF produces an empty text layer. The explicitly injected
        // OCR provider is the only path allowed to make a live provider call.
        let ocrText: string;
        let ocrModel: string | undefined;
        try {
            const result = await deps.ocr(
                Buffer.isBuffer(buffer)
                    ? buffer
                    : Buffer.from(new Uint8Array(arrayBuffer)),
            );
            ocrText = result.text.trim();
            ocrModel = result.model;
        } catch (error) {
            if (error instanceof PdfExtractionError) throw error;
            throw new PdfExtractionError(
                "OCR_FAILED",
                "Scanned PDF OCR failed. Try again or upload a text-based PDF.",
            );
        }
        if (!ocrText) {
            throw new PdfExtractionError(
                "NO_TEXT",
                "No text could be extracted from the scanned PDF.",
            );
        }
        if (ocrText.length > PDF_MAX_TEXT_CHARS) {
            throw new PdfExtractionError(
                "TOO_LARGE",
                "PDF contains too much text to index. Split it into smaller documents.",
            );
        }

        return {
            text: ocrText,
            pages: [ocrText],
            pageCount,
            ...(ocrModel ? { ocrModel } : {}),
        };
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
}, deps: PdfExtractionDeps = {}): Promise<PdfExtractResult> {
    try {
        const buffer = await downloadPdf(input.fileUrl);
        return await extractPdfFromBuffer(buffer, deps);
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
        return extractPdfFromBuffer(buffer, deps);
    }
}