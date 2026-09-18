import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { sanitizeError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { getStorageProvider } from "@/lib/storage";
import { isValidEntityId } from "@/lib/validation";
import { isForwardableRange } from "@/lib/audio/media-proxy";

const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_DOCUMENT_MEDIA_BYTES = 50 * 1024 * 1024;

const DOCUMENT_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
};

const FORWARDABLE_UPSTREAM_HEADERS = [
  "content-range",
  "content-length",
  "etag",
  "last-modified",
  "accept-ranges",
] as const;

function contentTypeFor(fileType: string | null): string {
  return (fileType ? DOCUMENT_CONTENT_TYPES[fileType] : undefined) ?? "application/octet-stream";
}

// Session-authenticated streaming route for a document's stored object. The
// browser only ever receives a same-origin response; the storage key is
// resolved from trusted DB state after the caller has been authorized against
// the document's own knowledge base, then fetched through a short-lived signed
// URL. A foreign or deleted document resolves to 404 (never 403) so callers
// cannot probe for object existence, and a client never supplies a storage key
// or URL — the key is derived server-side from the authorized document row.
export async function GET(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`document-media:${session.user.id}`, RATE_LIMITS.api);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.api) },
    );
  }

  const { docId } = await params;
  if (!isValidEntityId(docId)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: { id: true, knowledgeBaseId: true, storageKey: true, fileType: true },
  });
  if (!doc || !(await canAccessKnowledgeBase(session.user.id, doc.knowledgeBaseId)) || !doc.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const storage = getStorageProvider();
    const signedUrl = await storage.getSignedUrl(doc.storageKey);

    const init: RequestInit = {
      cache: "no-store",
      headers: isForwardableRange(request.headers.get("range"))
        ? { Range: request.headers.get("range") as string }
        : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    };

    let upstream: Response;
    try {
      upstream = await fetch(signedUrl, init);
    } catch (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: "Internal server error", errorId: sanitized.errorId },
        { status: 500 },
      );
    }

    if (upstream.status === 416) {
      return mirrorDocumentResponse(416, null, upstream, contentTypeFor(doc.fileType));
    }
    if (!upstream.ok) {
      void upstream.body?.cancel();
      return mediaUnavailable();
    }

    const contentLength = documentContentLength(upstream.headers.get("content-length"));
    if (contentLength === 0 || (contentLength !== null && contentLength > MAX_DOCUMENT_MEDIA_BYTES)) {
      void upstream.body?.cancel();
      return mediaUnavailable();
    }
    if (upstream.body === null) {
      return mediaUnavailable();
    }

    return mirrorDocumentResponse(
      upstream.status === 206 ? 206 : 200,
      upstream.body,
      upstream,
      contentTypeFor(doc.fileType),
    );
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json({ error: "Internal server error", errorId: sanitized.errorId }, { status: 500 });
  }
}

function documentContentLength(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function mediaUnavailable(): NextResponse {
  return NextResponse.json({ error: "Document upstream unavailable" }, { status: 502 });
}

function mirrorDocumentResponse(
  status: number,
  body: BodyInit | null,
  upstream: Response,
  contentType: string,
): NextResponse {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  });
  for (const name of FORWARDABLE_UPSTREAM_HEADERS) {
    if (status === 416 && name === "content-length") continue;
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new NextResponse(body, { status, headers });
}