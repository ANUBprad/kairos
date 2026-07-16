import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  deleteConversation,
  updateConversationTitle,
} from "@/lib/ai/memory";
import { sanitizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { DEMO_USER_ID } from "@/lib/server/demo-user";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const conversation = await getConversation(id);

    if (!conversation || conversation.userId !== DEMO_USER_ID) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const duration = Math.round(performance.now() - start);
    logger.info("Get conversation", { userId: DEMO_USER_ID, duration });
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
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    await deleteConversation(id, DEMO_USER_ID);

    const duration = Math.round(performance.now() - start);
    logger.info("Delete conversation", { userId: DEMO_USER_ID, duration });
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
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
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

    await updateConversationTitle(id, title, DEMO_USER_ID);

    const duration = Math.round(performance.now() - start);
    logger.info("Update conversation", { userId: DEMO_USER_ID, duration });
    return NextResponse.json({ success: true });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    logger.error("Update conversation failed", { duration, error: err instanceof Error ? err.message : "unknown" });
    const { message } = sanitizeError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
