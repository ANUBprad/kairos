import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`settings:${session.user.id}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  const config: Record<string, { available: boolean; models: string[] }> = {
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      models: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
      ],
    },
    gemini: {
      available: !!process.env.GEMINI_API_KEY,
      models: [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
      ],
    },
  };

  return NextResponse.json({
    providers: config,
    defaultProvider: process.env.AI_PROVIDER || "openai",
  });
}
