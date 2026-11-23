export class InvalidByteRangeError extends Error {
    constructor(message = "Invalid byte range") {
        super(message);
        this.name = "InvalidByteRangeError";
    }
}

export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range: bytes=...` header.
 *
 * Returns `null` when no range header is present. Invalid, negative, reversed,
 * or wholly out-of-bounds ranges throw {@link InvalidByteRangeError} so the
 * caller can answer with HTTP 416 instead of streaming corrupt bytes.
 */
export function parseByteRange(
    rangeHeader: string | undefined,
    totalSize: number,
): ByteRange | null {
    if (!rangeHeader) return null;
    if (!Number.isSafeInteger(totalSize) || totalSize <= 0) {
        throw new InvalidByteRangeError("Resource has no byte range");
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) {
        throw new InvalidByteRangeError("Malformed byte range");
    }

    const startText = match[1];
    const endText = match[2];

    // Suffix form: bytes=-500 means the final 500 bytes.
    if (!startText) {
        const suffixLength = Number(endText);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
            throw new InvalidByteRangeError("Invalid suffix range");
        }
        const start = Math.max(0, totalSize - suffixLength);
        return { start, end: totalSize - 1 };
    }

    const start = Number(startText);
    if (!Number.isSafeInteger(start) || start < 0 || start >= totalSize) {
        throw new InvalidByteRangeError("Range start is out of bounds");
    }

    const end = endText ? Number(endText) : totalSize - 1;
    if (!Number.isSafeInteger(end) || end < start) {
        throw new InvalidByteRangeError("Range end is invalid");
    }

    return { start, end: Math.min(end, totalSize - 1) };
}
