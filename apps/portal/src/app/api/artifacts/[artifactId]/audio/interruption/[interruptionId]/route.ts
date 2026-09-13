import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { getStorageProvider } from "@/lib/storage";
import { parseStoredInterruptions } from "@/lib/artifacts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

// Session-authenticated streaming handler for a single podcast interruption.
// The interruption history rides on the podcast's metadata; its audio is a
// separate authenticated asset served through the same storage flow as the
// episode so playback swaps assets without ever exposing a storage identity.
// Authorized via the artifact's own knowledge base — a foreign artifact or a
// foreign interruption id both resolve to 404, never a 403 that leaks them.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string; interruptionId: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`audio:${session.user.id}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  const { artifactId, interruptionId } = await params;
  if (!UUID_REGEX.test(artifactId) || !UUID_REGEX.test(interruptionId)) {
    return NextResponse.json({ error: "Invalid artifact or interruption ID" }, { status: 400 });
  }

  const artifact = await prisma.learningArtifact.findUnique({ where: { id: artifactId } });
  if (!artifact || artifact.type !== "PODCAST" || artifact.status !== "COMPLETED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canAccessKnowledgeBase(session.user.id, artifact.knowledgeBaseId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interruption = parseStoredInterruptions(artifact.metadata).find(
    (entry) => entry.id === interruptionId,
  );
  if (!interruption?.audio?.storageKey || !interruption?.audio?.format) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storage = getStorageProvider();
    const signedUrl = await storage.getSignedUrl(interruption.audio.storageKey);
    const upstream = await fetch(signedUrl, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Media upstream unavailable" }, { status: 502 });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Media upstream unavailable" }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": interruption.audio.format === "mp3" ? "audio/mpeg" : "audio/wav",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: "Internal server error", errorId: sanitized.errorId },
      { status: 500 },
    );
  }
}