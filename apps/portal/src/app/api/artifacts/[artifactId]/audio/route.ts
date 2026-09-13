import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { getStorageProvider } from "@/lib/storage";
import { isValidEntityId } from "@/lib/validation";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

interface PodcastMetadata {
  audio?: { storageKey?: unknown; format?: unknown; provider?: unknown; durationSeconds?: unknown } | null;
}

// Session-authenticated streaming handler for completed podcast audio. The
// browser only ever receives a same-origin audio response; the storage key
// stays server-side and is fetched through a short-lived signed URL. Authorized
// via the artifact's own knowledge base — a foreign artifact id resolves to
// 404, never a 403 that leaks its existence.
export async function GET(request: NextRequest, { params }: { params: Promise<{ artifactId: string }> }) {
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

  const { artifactId } = await params;
  if (!isValidEntityId(artifactId)) {
    return NextResponse.json({ error: "Invalid artifact ID" }, { status: 400 });
  }

  const artifact = await prisma.learningArtifact.findUnique({ where: { id: artifactId } });
  if (!artifact || artifact.type !== "PODCAST" || artifact.status !== "COMPLETED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canAccessKnowledgeBase(session.user.id, artifact.knowledgeBaseId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const audio = (artifact.metadata as PodcastMetadata | null)?.audio as Partial<{
    provider: string;
    storageProvider: string;
    storageKey: string;
    format: "wav" | "mp3";
    durationSeconds: number | null;
  }> | null;
  if (!audio?.storageKey || !audio?.format) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storage = getStorageProvider();
    const signedUrl = await storage.getSignedUrl(audio.storageKey);
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
        "Content-Type": audio.format === "mp3" ? "audio/mpeg" : "audio/wav",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}