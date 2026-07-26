import { NextRequest, NextResponse } from "next/server";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function generateRequestId(): string {
  return crypto.randomUUID();
}

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.githubusercontent.com https://*.googleusercontent.com https://images.unsplash.com; font-src 'self'; connect-src 'self' https://*.posthog.com; frame-ancestors 'none';",
    );
  }
}

function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Allow same-origin requests
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    // Allow if origin matches the host
    if (host && originUrl.host === host) return true;
    // Allow localhost in development
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

  addSecurityHeaders(response);

  // CSRF protection for state-changing methods
  if (STATE_CHANGING_METHODS.has(request.method)) {
    // Skip CSRF for API key-authenticated requests (V1 API routes)
    const isApiRoute = request.nextUrl.pathname.startsWith("/api/v1/");
    const hasApiKey = request.headers.get("x-api-key");

    if (isApiRoute && hasApiKey) {
      // API key routes use their own auth mechanism
    } else {
      // Server actions and non-API POST requests need origin validation
      const contentType = request.headers.get("content-type") ?? "";
      const isFormSubmission = contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded");

      // For form submissions (server actions), validate origin
      if (isFormSubmission || request.method !== "POST") {
        if (!validateOrigin(request)) {
          return NextResponse.json(
            { error: "CSRF validation failed" },
            { status: 403 },
          );
        }
      }

      // For JSON POST requests, check Origin header
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
