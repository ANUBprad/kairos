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

/**
 * Normalise an arbitrary provider failure into a {@link ProviderRequestError}
 * when it carries an HTTP status (the OpenAI SDK throws its own error classes).
 * Errors without a status — timeouts, socket failures, aborts — are returned
 * unchanged so their original type and semantics are preserved.
 */
export function toProviderRequestError(err: unknown): unknown {
  if (err instanceof ProviderRequestError) return err;
  const status = (err as { status?: unknown }).status;
  if (typeof status !== "number") return err;
  const headers = (err as { headers?: { get?: (name: string) => string | null } })
    .headers;
  const retryAfterMs =
    headers && typeof headers.get === "function"
      ? parseRetryAfter(headers.get("retry-after"))
      : undefined;
  const message = err instanceof Error ? err.message : "AI provider request failed";
  return new ProviderRequestError(message, status, retryAfterMs);
}
