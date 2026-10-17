import { logger } from "@/lib/logger";
import { ProviderRequestError } from "@/lib/ai/errors";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Map a provider HTTP status to a non-leaky, actionable client message. The raw
 * provider body is never forwarded — only the category the caller can act on.
 */
function providerMessage(error: ProviderRequestError): { code: string; message: string } {
  if (error.status === 429) {
    return {
      code: "PROVIDER_RATE_LIMITED",
      message: "The AI provider is rate-limiting requests. Please try again in a moment.",
    };
  }
  if (error.status === 401 || error.status === 403) {
    return {
      code: "PROVIDER_AUTH",
      message: "The AI provider rejected the request. Check the provider credentials.",
    };
  }
  if (error.status >= 500) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "The AI provider is temporarily unavailable. Please try again.",
    };
  }
  return {
    code: "PROVIDER_ERROR",
    message: "The AI provider could not complete the request.",
  };
}

export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(context, {
    message,
    ...extra,
    ...(stack ? { stack: stack.split("\n").slice(0, 5).join("\n") } : {}),
  });
}

function generateErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeError(error: unknown): { code: string; message: string; errorId: string } {
  const errorId = generateErrorId();

  if (error instanceof ProviderRequestError) {
    // The raw provider body may carry quota ids, model names and account hints,
    // so it is logged server-side and never returned to the client.
    logger.error("Provider request failed", {
      status: error.status,
      message: error.message,
      errorId,
    });
    return { ...providerMessage(error), errorId };
  }

  if (error instanceof AppError) {
    logger.warn(`AppError [${error.code}]`, { message: error.message, errorId });
    return { code: error.code, message: error.message, errorId };
  }
  if (error instanceof Error) {
    if (error.message.includes("not found") || error.message.includes("Not found")) {
      return { code: "NOT_FOUND", message: "Resource not found", errorId };
    }
    if (error.message.includes("authenticated") || error.message.includes("unauthorized")) {
      return { code: "UNAUTHORIZED", message: "Not authenticated", errorId };
    }
    if (error.message.includes("forbidden") || error.message.includes("permission")) {
      return { code: "FORBIDDEN", message: "Insufficient permissions", errorId };
    }
    logger.error("Unhandled error", { message: error.message, stack: error.stack, errorId });
    return { code: "INTERNAL_ERROR", message: "An unexpected error occurred", errorId };
  }
  logger.error("Non-Error thrown", { value: String(error), errorId });
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred", errorId };
}
