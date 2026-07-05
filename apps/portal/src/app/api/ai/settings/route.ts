import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
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
