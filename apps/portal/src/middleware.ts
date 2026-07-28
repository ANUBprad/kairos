import { NextRequest, NextResponse } from "next/server";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function generateRequestId(): string {
  return crypto.randomUUID();
}

function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host === host) return true;
    if (
      process.env.NODE_ENV !== "production" &&
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const requestId = generateRequestId();

  response.headers.set("x-request-id", requestId);
  response.headers.set("x-response-time", Date.now().toString());

  if (STATE_CHANGING_METHODS.has(request.method)) {
    const isApiRoute = request.nextUrl.pathname.startsWith("/api/v1/");
    const hasApiKey = request.headers.get("x-api-key");

    if (isApiRoute && hasApiKey) {
      // API key routes use their own auth mechanism
    } else {
      const contentType = request.headers.get("content-type") ?? "";
      const isFormSubmission = contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded");

      if (isFormSubmission || request.method !== "POST") {
        if (!validateOrigin(request)) {
          return NextResponse.json(
            { error: "CSRF validation failed" },
            { status: 403 },
          );
        }
      }

      if (request.method === "POST" && contentType.includes("application/json")) {
        if (!validateOrigin(request)) {
          return NextResponse.json(
            { error: "CSRF validation failed" },
            { status: 403 },
          );
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/app", "/api/:path*"],
};
