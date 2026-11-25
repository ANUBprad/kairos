import type { Source } from "./types";

type RetryEligibleSource = Pick<
    Source,
    "status" | "metadata" | "refunded" | "canReprocess"
>;

/** The source ledger is the server's source of truth; metadata is a fallback. */
export function isSourceRefunded(source: RetryEligibleSource): boolean {
    const metadata = source.metadata ?? {};
    return (
        source.refunded === true ||
        metadata.refunded === true ||
        typeof metadata.refundedAt === "string"
    );
}

/**
 * Mirrors the backend reprocess guard. A refunded source needs a fresh paid
 * import, so the ordinary Retry action must never be offered for it.
 */
export function canRetrySource(source: RetryEligibleSource): boolean {
    if (source.status !== "FAILED" || isSourceRefunded(source)) return false;
    return source.canReprocess !== false;
}
