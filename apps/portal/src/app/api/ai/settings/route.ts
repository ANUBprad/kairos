import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
