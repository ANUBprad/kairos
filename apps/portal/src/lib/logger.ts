const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "api_key",
  "apiKey",
  "api_secret",
  "apiSecret",
  "authorization",
  "cookie",
  "session",
  "credential",
  "private_key",
  "privateKey",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "database_url",
  "databaseUrl",
  "betther_auth_secret",
  "betterAuthSecret",
  "supabase_service_role_key",
  "supabaseServiceRoleKey",
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g;
const DB_URL_REGEX = /postgresql:\/\/[^@]*@[^/]*/g;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    let redacted = value;
    redacted = redacted.replace(EMAIL_REGEX, "***@***.***");
    redacted = redacted.replace(JWT_REGEX, "***.***.***");
    redacted = redacted.replace(DB_URL_REGEX, (match) => {
      const atIndex = match.indexOf("@");
      if (atIndex === -1) return "***";
      return match.substring(0, Math.min(8, atIndex)) + "***@" + match.substring(atIndex + 1);
    });
    return redacted;
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redactObject(value as Record<string, unknown>);
    } else if (typeof value === "string") {
      redacted[key] = redactValue(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  route?: string;
  duration?: number;
  status?: number;
  env?: string;
  context?: string;
  [key: string]: unknown;
}

const ENVIRONMENT = process.env.NODE_ENV ?? "development";

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function createEntry(
  level: LogLevel,
  message: string,
  extra?: Record<string, unknown>,
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: ENVIRONMENT,
  };

  if (extra) {
    const redacted = redactObject(extra);
    Object.assign(entry, redacted);
  }

  return entry;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
}

let _globalContext: LogContext = {};

export function setLogContext(ctx: LogContext) {
  _globalContext = { ..._globalContext, ...ctx };
}

export function getLogContext(): LogContext {
  return { ..._globalContext };
}

export function clearLogContext() {
  _globalContext = {};
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>) {
    const entry = createEntry("debug", message, {
      ..._globalContext,
      ...extra,
    });
    // eslint-disable-next-line no-console
    console.debug(formatLog(entry));
  },

  info(message: string, extra?: Record<string, unknown>) {
    const entry = createEntry("info", message, {
      ..._globalContext,
      ...extra,
    });
    // eslint-disable-next-line no-console
    console.log(formatLog(entry));
  },

  warn(message: string, extra?: Record<string, unknown>) {
    const entry = createEntry("warn", message, {
      ..._globalContext,
      ...extra,
    });
    console.warn(formatLog(entry));
  },

  error(message: string, extra?: Record<string, unknown>) {
    const entry = createEntry("error", message, {
      ..._globalContext,
      ...extra,
    });
    console.error(formatLog(entry));
  },

  audit(action: string, extra?: Record<string, unknown>) {
    const entry = createEntry("audit", `AUDIT: ${action}`, {
      ..._globalContext,
      ...extra,
    });
    // eslint-disable-next-line no-console
    console.log(formatLog(entry));
  },

  child(context: LogContext) {
    const merged = { ..._globalContext, ...context };
    return {
      debug: (msg: string, extra?: Record<string, unknown>) =>
        logger.debug(msg, { ...merged, ...extra }),
      info: (msg: string, extra?: Record<string, unknown>) =>
        logger.info(msg, { ...merged, ...extra }),
      warn: (msg: string, extra?: Record<string, unknown>) =>
        logger.warn(msg, { ...merged, ...extra }),
      error: (msg: string, extra?: Record<string, unknown>) =>
        logger.error(msg, { ...merged, ...extra }),
      audit: (msg: string, extra?: Record<string, unknown>) =>
        logger.audit(msg, { ...merged, ...extra }),
    };
  },
};
