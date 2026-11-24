import { getRequestId } from "./observability/request-context.js";

/** Shared bounded-timeout fetch wrapper for external provider calls. */
export const PROVIDER_TIMEOUT_MS = 20000;

export function providerFetch(
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> {
    // Combining signals keeps the hard timeout even when a caller supplies its
    // own signal (e.g. a request-abort signal), instead of silently dropping it.
    const signals: AbortSignal[] = [AbortSignal.timeout(PROVIDER_TIMEOUT_MS)];
    if (init?.signal) signals.push(init.signal);

    // Correlation is safe to forward: it is a compact validated id and never a
    // credential. An explicit caller header still wins.
    const headers = new Headers(init?.headers);
    const requestId = getRequestId();
    if (requestId && !headers.has("x-request-id")) {
        headers.set("x-request-id", requestId);
    }

    return globalThis.fetch(input, {
        ...init,
        headers,
        signal: AbortSignal.any(signals),
    });
}
