import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { createConversation, listConversations } from "@/lib/ai/memory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kbId = searchParams.get("kbId");

  if (!kbId) {
    return NextResponse.json({ error: "kbId is required" }, { status: 400 });
  }

  const conversations = await listConversations(kbId, session.user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { kbId, title, model, provider } = body;

  if (!kbId) {
    return NextResponse.json({ error: "kbId is required" }, { status: 400 });
  }

  const conversation = await createConversation(
    kbId,
    session.user.id,
    title,
    model,
    provider,
  );

  return NextResponse.json({ conversation });
}
