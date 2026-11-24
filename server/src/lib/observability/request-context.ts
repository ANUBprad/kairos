import { AsyncLocalStorage } from "node:async_hooks";

/** Compact identifiers only; never allow header injection or log forging. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const storage = new AsyncLocalStorage<string>();

/** Validates a supplied correlation id before it enters headers, logs or events. */
export function normalizeRequestId(value: unknown): string | undefined {
    return typeof value === "string" && VALID_REQUEST_ID.test(value)
        ? value
        : undefined;
}

/** Returns the active request id, if any. Invalid stored values are ignored. */
export function getRequestId(): string | undefined {
    return normalizeRequestId(storage.getStore());
}

/**
 * Runs work with a validated request id. Async resources created inside `fn`
 * inherit the id, so logs and event payloads remain correlated across awaits.
 */
export function runWithRequestId<T>(value: unknown, fn: () => T): T {
    const id = normalizeRequestId(value);
    return id ? storage.run(id, fn) : fn();
}
