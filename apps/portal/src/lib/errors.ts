import { logger } from "@/lib/logger";

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
