import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { createConversation, listConversations } from "@/lib/ai/memory";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const start = performance.now();
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get("kbId");

    if (!kbId) {
      return NextResponse.json({ error: "kbId is required" }, { status: 400 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(kbId)) {
      return NextResponse.json({ error: "Invalid kbId format" }, { status: 400 });
    }

    const conversations = await listConversations(kbId, session.user.id);
    const duration = Math.round(performance.now() - start);
    logger.info("List conversations", { userId: session.user.id, count: conversations.length, duration });
    return NextResponse.json({ conversations });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("List conversations failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const start = performance.now();
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rl = rateLimit(`conversation:create:${session.user.id}`, RATE_LIMITS.chat);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.chat) },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const kbId = typeof body.kbId === "string" ? body.kbId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    const model = typeof body.model === "string" ? body.model : undefined;
    const provider = typeof body.provider === "string" ? body.provider : undefined;

    if (!kbId) {
      return NextResponse.json({ error: "kbId is required" }, { status: 400 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(kbId)) {
      return NextResponse.json({ error: "Invalid kbId format" }, { status: 400 });
    }

    if (title && title.length > 500) {
      return NextResponse.json({ error: "Title too long" }, { status: 400 });
    }

    const conversation = await createConversation(
      kbId,
      session.user.id,
      title,
      model,
      provider,
    );

    const duration = Math.round(performance.now() - start);
    logger.info("Create conversation", { userId: session.user.id, kbId, duration });
    return NextResponse.json({ conversation });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("Create conversation failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
