/** An HTTP failure from an AI provider, carrying enough to decide on a retry. */
export class ProviderRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Parse a `Retry-After` header value (delta-seconds or an HTTP-date) into
 * milliseconds. Returns undefined when the header is absent or unparseable.
 */
export function parseRetryAfter(
  value: string | null | undefined,
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
