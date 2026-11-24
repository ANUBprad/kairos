import { getRequestId } from "./observability/request-context.js";

type LogLevel = "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(secret|token|password|passwd|api[-_]?key|authorization|cookie|credential|signature|private[-_]?key|session|otp|card|cvv)/i;
const BEARER = /(bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{16,}|rzp_(?:test|live)_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/g;
const MAX_STRING_LENGTH = 2000;

/** Recursively redacts sensitive fields and bounds string sizes before logging. */
export function redactForLog(value: unknown, depth = 0): unknown {
    if (depth > 6) return "[TRUNCATED]";
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
        const masked = value
            .replace(BEARER, `$1${REDACTED}`)
            .replace(SENSITIVE_VALUE, REDACTED);
        return masked.length > MAX_STRING_LENGTH
            ? `${masked.slice(0, MAX_STRING_LENGTH)}…[truncated]`
            : masked;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactForLog(value.message, depth + 1),
            // Stack traces may embed URLs with credentials or provider tokens.
            stack: value.stack ? "[stack omitted]" : undefined,
        };
    }
    if (Array.isArray(value)) {
        return value.slice(0, 100).map((item) => redactForLog(item, depth + 1));
    }
    if (typeof value === "object") {
        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            output[key] = SENSITIVE_KEY.test(key)
                ? REDACTED
                : redactForLog(item, depth + 1);
        }
        return output;
    }
    return String(value);
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const requestId = getRequestId();
    const payload = {
        level,
        // Messages are free-form and may contain a provider error string with
        // an embedded key; redact them exactly like metadata values.
        message: redactForLog(message) as string,
        time: new Date().toISOString(),
        ...(meta ? (redactForLog(meta) as Record<string, unknown>) : {}),
        // The active context is authoritative; a caller cannot overwrite the
        // correlation id of a request/worker trace.
        ...(requestId ? { requestId } : {}),
    };
    let line: string;
    try {
        line = JSON.stringify(payload);
    } catch {
        line = JSON.stringify({ level, message, time: payload.time });
    }

    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

export const logger = {
    info: (message: string, meta?: Record<string, unknown>) =>
        write("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
        write("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
        write("error", message, meta),
};
