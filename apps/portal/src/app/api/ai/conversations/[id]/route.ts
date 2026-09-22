import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  deleteConversation,
  updateConversationTitle,
} from "@/lib/ai/memory";
import { sanitizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getServerSession } from "@/lib/server/auth-utils";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { isValidEntityId } from "@/lib/validation";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const readRl = rateLimit(`conversation:read:${session.user.id}`, RATE_LIMITS.conversation);
    if (!readRl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(readRl, RATE_LIMITS.conversation) },
      );
    }

    const { id } = await params;

    if (!isValidEntityId(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const conversation = await getConversation(id);

    if (!conversation || conversation.userId !== session.user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.knowledgeBaseId && !(await canAccessKnowledgeBase(session.user.id, conversation.knowledgeBaseId))) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }

    const duration = Math.round(performance.now() - start);
    logger.info("Get conversation", { userId: session.user.id, duration });
    return NextResponse.json({ conversation });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("Get conversation failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const writeRl = rateLimit(`conversation:write:${session.user.id}`, RATE_LIMITS.conversation);
    if (!writeRl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(writeRl, RATE_LIMITS.conversation) },
      );
    }

    const { id } = await params;

    if (!isValidEntityId(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    await deleteConversation(id, session.user.id);

    const duration = Math.round(performance.now() - start);
    logger.info("Delete conversation", { userId: session.user.id, duration });
    return NextResponse.json({ success: true });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("Delete conversation failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const writeRl = rateLimit(`conversation:write:${session.user.id}`, RATE_LIMITS.conversation);
    if (!writeRl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(writeRl, RATE_LIMITS.conversation) },
      );
    }

    const { id } = await params;

    if (!isValidEntityId(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (title.length > 500) {
      return NextResponse.json({ error: "Title too long" }, { status: 400 });
    }

    await updateConversationTitle(id, title, session.user.id);

    const duration = Math.round(performance.now() - start);
    logger.info("Update conversation", { userId: session.user.id, duration });
    return NextResponse.json({ success: true });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("Update conversation failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
