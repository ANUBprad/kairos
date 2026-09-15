import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { getStorageProvider } from "@/lib/storage";
import { isValidEntityId } from "@/lib/validation";
import { mediaContentType, proxyMediaResponse } from "@/lib/audio/media-proxy";

interface PodcastMetadata {
  audio?: { storageKey?: unknown; format?: unknown; provider?: unknown; durationSeconds?: unknown } | null;
}

// Session-authenticated streaming handler for completed podcast audio. The
// browser only ever receives a same-origin audio response; the storage key
// stays server-side and is fetched through a short-lived signed URL. Authorized
// via the artifact's own knowledge base — a foreign artifact id resolves to
// 404, never a 403 that leaks its existence. The signed URL is handed to the
// shared media proxy, which forwards byte ranges to Cloudinary and streams the
// response instead of buffering the whole object.
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
    return await proxyMediaResponse({
      signedUrl,
      rangeHeader: request.headers.get("range"),
      contentType: mediaContentType(audio.format),
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}