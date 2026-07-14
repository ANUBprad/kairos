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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app")) {
    if (!getSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/signup") {
    if (getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/app", "/login", "/signup"],
};
