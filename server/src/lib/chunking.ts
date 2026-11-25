import { CHUNK_OVERLAP, CHUNK_SIZE } from "./ai-config.js";
import {
    layoutBlockChunkLimit,
    segmentIntoLayoutBlocks,
} from "./chunking/layout.js";

export type TextChunk = {
    index: number;
    content: string;
    metadata?: Record<string, unknown>;
};

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * Splits raw text into clean chunk strings using recursive hierarchical separators (\n\n, \n, sentence, word).
 *
 * @param text - Raw source text to split
 * @param chunkSize - Maximum character length per chunk
 * @param chunkOverlap - Character overlap between consecutive chunks
 * @returns Array of chunk text strings
 */
function splitText(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= chunkSize) return [trimmed];

    let separator = "";
    for (const s of SEPARATORS) {
        if (s === "") {
            separator = "";
            break;
        }
        if (trimmed.includes(s)) {
            separator = s;
            break;
        }
    }

    const docs: string[] = [];

    if (separator) {
        const splits = trimmed.split(separator).filter(Boolean);
        let currentDoc: string[] = [];
        let currentLen = 0;

        for (const piece of splits) {
            const pieceLen = piece.length;
            const sepLen = currentDoc.length > 0 ? separator.length : 0;

            if (currentLen + sepLen + pieceLen > chunkSize && currentDoc.length > 0) {
                const joined = currentDoc.join(separator).trim();
                if (joined) docs.push(joined);
                currentDoc = [];
                currentLen = 0;
            }

            if (pieceLen > chunkSize) {
                if (currentDoc.length > 0) {
                    const joined = currentDoc.join(separator).trim();
                    if (joined) docs.push(joined);
                    currentDoc = [];
                    currentLen = 0;
                }
                const subChunks = splitText(piece, chunkSize, chunkOverlap);
                docs.push(...subChunks);
            } else {
                currentDoc.push(piece);
                currentLen += pieceLen + (currentDoc.length > 1 ? separator.length : 0);
            }
        }

        if (currentDoc.length > 0) {
            const joined = currentDoc.join(separator).trim();
            if (joined) docs.push(joined);
        }
    } else {
        const step = Math.max(1, chunkSize - chunkOverlap);
        for (let i = 0; i < trimmed.length; i += step) {
            const slice = trimmed.slice(i, i + chunkSize).trim();
            if (slice) docs.push(slice);
        }
    }

    return docs.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Splits plain text into indexed and token-aware `TextChunk` records with metadata.
 *
 * @param text - Text content to chunk
 * @param options - Configurable chunkSize (default 1000), chunkOverlap (default 100), and custom metadata
 * @returns Array of sequential TextChunk objects
 */
function chunkTextWithLayout(
    text: string,
    options: {
        chunkSize?: number;
        chunkOverlap?: number;
        metadata?: Record<string, unknown>;
    } = {},
): TextChunk[] {
    const chunkOverlap = options.chunkOverlap ?? CHUNK_OVERLAP;
    const baseMetadata = options.metadata ?? {};
    const blocks = segmentIntoLayoutBlocks(text);
    const parts: { content: string; metadata: Record<string, unknown> }[] = [];

    for (const block of blocks) {
        const limit = layoutBlockChunkLimit(block);
        const slices = splitText(block.content, limit, chunkOverlap);
        for (const slice of slices) {
            parts.push({
                content: slice,
                metadata: {
                    ...baseMetadata,
                    contentType: block.type,
                },
            });
        }
    }

    return parts.map((part, index) => ({
        index,
        content: part.content,
        metadata: part.metadata,
    }));
}

export function chunkText(
    text: string,
    options: {
        chunkSize?: number;
        chunkOverlap?: number;
        metadata?: Record<string, unknown>;
    } = {},
): TextChunk[] {
    return chunkTextWithLayout(text, options);
}

/**
 * Splits a multi-page document (e.g. PDF) into chunks while preserving 1-based page numbers in metadata.
 *
 * @param pages - Array of extracted page text strings
 * @param options - Configurable chunkSize and chunkOverlap
 * @returns Array of sequential TextChunk objects tagged with page numbers
 */
export type TranscriptChunkSegment = {
    text: string;
    offset: number;
    duration?: number;
    lang?: string;
};

function formatTranscriptTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Groups timestamped transcript segments into chunks without losing the start
 * time needed for deep links and citation labels.
 */
export function chunkTimestampedTranscript(
    segments: TranscriptChunkSegment[],
    options: {
        videoId: string;
        videoUrl: string;
        chunkSize?: number;
        overlapSegments?: number;
    },
): TextChunk[] {
    const limit = options.chunkSize ?? CHUNK_SIZE;
    const overlap = Math.max(0, options.overlapSegments ?? 1);
    const cleaned = segments
        .map((segment) => ({
            text: segment.text.trim(),
            offset: Math.max(0, Math.floor(segment.offset)),
            duration: Math.max(0, Math.floor(segment.duration ?? 0)),
            lang: segment.lang ?? "und",
        }))
        .filter((segment) => segment.text.length > 0);

    const result: TextChunk[] = [];
    let start = 0;

    while (start < cleaned.length) {
        let end = start;
        let length = 0;

        while (end < cleaned.length) {
            const piece = `[${formatTranscriptTime(cleaned[end]!.offset)}] ${cleaned[end]!.text}`;
            const nextLength = length === 0 ? piece.length : length + 1 + piece.length;
            if (nextLength > limit && end > start) break;
            length = nextLength;
            end += 1;
        }

        const group = cleaned.slice(start, end);
        const first = group[0]!;
        const last = group[group.length - 1]!;
        const startSeconds = first.offset;
        const deepLink = `${options.videoUrl}${options.videoUrl.includes("?") ? "&" : "?"}t=${startSeconds}s`;

        result.push({
            index: result.length,
            content: group
                .map(
                    (segment) =>
                        `[${formatTranscriptTime(segment.offset)}] ${segment.text}`,
                )
                .join("\n"),
            metadata: {
                contentType: "transcript",
                videoId: options.videoId,
                timestamp: formatTranscriptTime(startSeconds),
                startSeconds,
                endSeconds: last.offset + last.duration,
                lang: first.lang,
                url: deepLink,
            },
        });

        if (end >= cleaned.length) break;
        start = Math.max(start + 1, end - overlap);
    }

    return result;
}

export function chunkPages(
    pages: string[],
    options: {
        chunkSize?: number;
        chunkOverlap?: number;
    } = {},
): TextChunk[] {
    const chunks: TextChunk[] = [];
    let index = 0;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageText = pages[pageIndex]?.trim();
        if (!pageText) {
            continue;
        }

        const pageChunks = chunkTextWithLayout(pageText, {
            ...options,
            metadata: { page: pageIndex + 1 },
        });

        for (const chunk of pageChunks) {
            chunks.push({
                index,
                content: chunk.content,
                metadata: chunk.metadata,
            });
            index += 1;
        }
    }

    return chunks;
}