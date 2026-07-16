import { NextRequest, NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("x-request-id", crypto.randomUUID());
  response.headers.set("x-response-time", Date.now().toString());

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/app", "/api/:path*"],
};
