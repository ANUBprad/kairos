import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { rateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";

const handler = toNextJsHandler(auth);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const result = rateLimit(`auth:${ip}`, RATE_LIMITS.auth);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(result, RATE_LIMITS.auth) },
    );
  }

  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  let policy: keyof typeof RATE_LIMITS = "auth";
  const url = request.nextUrl.pathname;
  if (url.includes("/sign-in")) policy = "login";
  else if (url.includes("/sign-up")) policy = "signup";
  else if (url.includes("/forgot-password") || url.includes("/reset-password"))
    policy = "passwordReset";

  const result = rateLimit(`auth:${ip}:${policy}`, RATE_LIMITS[policy]);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(result, RATE_LIMITS[policy]) },
    );
  }

  return handler.POST(request);
}
