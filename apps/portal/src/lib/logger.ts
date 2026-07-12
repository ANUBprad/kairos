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

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "debug",
      message,
      timestamp: new Date().toISOString(),
      ...(extra ? redactObject(extra) : {}),
    };
    // eslint-disable-next-line no-console
    console.debug(formatLog(entry));
  },

  info(message: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...(extra ? redactObject(extra) : {}),
    };
    // eslint-disable-next-line no-console
    console.log(formatLog(entry));
  },

  warn(message: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...(extra ? redactObject(extra) : {}),
    };
    console.warn(formatLog(entry));
  },

  error(message: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...(extra ? redactObject(extra) : {}),
    };
    console.error(formatLog(entry));
  },

  audit(action: string, extra?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "info",
      message: `AUDIT: ${action}`,
      timestamp: new Date().toISOString(),
      ...(extra ? redactObject(extra) : {}),
    };
    // eslint-disable-next-line no-console
    console.log(formatLog(entry));
  },
};
