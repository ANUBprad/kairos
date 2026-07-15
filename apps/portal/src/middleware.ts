import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_CANDIDATES = [
  "__Secure-kairos.session_token",
  "kairos.session_token",
  "better-auth.session_token",
];

function getSessionCookie(request: NextRequest): string | undefined {
  for (const name of SESSION_COOKIE_CANDIDATES) {
    const cookie = request.cookies.get(name);
    if (cookie?.value) return cookie.value;
  }
  return undefined;
}

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${random}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();
  const start = performance.now();

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  if (pathname.startsWith("/app")) {
    if (!getSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/login" || pathname === "/signup") {
    if (getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  const duration = Math.round(performance.now() - start);
  response.headers.set("x-response-time", `${duration}ms`);

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/app", "/login", "/signup", "/forgot-password"],
};
