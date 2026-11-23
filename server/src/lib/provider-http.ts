/** Shared bounded-timeout fetch wrapper for external provider calls. */
export const PROVIDER_TIMEOUT_MS = 20000;

export function providerFetch(
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> {
    return globalThis.fetch(input, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
}
