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
  console.error(JSON.stringify({
    level: "error",
    context,
    message,
    ...extra,
    ...(stack ? { stack: stack.split("\n").slice(0, 5).join("\n") } : {}),
  }));
}

export function sanitizeError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    if (error.message.includes("not found") || error.message.includes("Not found")) {
      return { code: "NOT_FOUND", message: "Resource not found" };
    }
    if (error.message.includes("authenticated") || error.message.includes("unauthorized")) {
      return { code: "UNAUTHORIZED", message: "Not authenticated" };
    }
    if (error.message.includes("forbidden") || error.message.includes("permission")) {
      return { code: "FORBIDDEN", message: "Insufficient permissions" };
    }
    return { code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
}
