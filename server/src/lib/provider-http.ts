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
    return globalThis.fetch(input, {
        ...init,
        signal: AbortSignal.any(signals),
    });
}
