import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/server/auth";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Anonymous session bootstrap — the entry point that makes the workspace usable
 * without an account. The /app layout redirects here once when a visitor has no
 * session; we mint an anonymous Better Auth user (isolated to its own
 * auto-provisioned organization), set the session cookie, and hand the visitor
 * back to /app. No account, no login screen, no shared identity.
 *
 * Rate-limited per IP by the same policy as the auth endpoint, so a public
 * entry point cannot be used to mass-create users.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const result = rateLimit(`session-bootstrap:${ip}`, RATE_LIMITS.auth);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(result, RATE_LIMITS.auth) },
    );
  }

  try {
    const issued = await auth.api.signInAnonymous({
      headers: request.headers,
      asResponse: true,
    });

    const response = NextResponse.redirect(new URL("/app", request.url));
    for (const cookie of issued.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (err) {
    logger.error("Anonymous session bootstrap failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail closed to the (public, account-optional) sign-in page rather than
    // looping back into /app with no session.
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
