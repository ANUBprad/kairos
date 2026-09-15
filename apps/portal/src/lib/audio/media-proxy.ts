import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/errors";

// Shared byte-range media proxy for authenticated podcast audio. Both the
// episode route and the interruption route hand this their signed Cloudinary
// URL, the browser's Range header, and the known audio type; the helper is the
// only place that talks to storage and shapes the response. Browser Range
// requests are forwarded verbatim to Cloudinary (which is the authoritative
// source of byte semantics), the upstream body is streamed instead of buffered,
// and only an allowlist of safe headers ever reaches the client.
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export const MEDIA_UPSTREAM_TIMEOUT_MS = 15_000;

export type MediaContentType = "audio/mpeg" | "audio/wav";

const ALLOWED_UPSTREAM_HEADERS = [
  "content-range",
  "content-length",
  "etag",
  "last-modified",
  "accept-ranges",
] as const;

// The media MIME type is the format the server persisted at generation time,
// never anything the browser or the upstream can influence.
export function mediaContentType(format: string | undefined): MediaContentType {
  return format === "mp3" ? "audio/mpeg" : "audio/wav";
}

// Trust-boundary gate: only a single numeric "bytes=" range may be forwarded
// to storage. Multipart ranges (commas), other units, and garbage are rejected
// so an attacker-controlled Range header is never passed through unchecked.
// A forwarded range that turns out to be unsatisfiable is 416'd by the
// upstream and mirrored as-is; every rejected header simply means the full
// resource is served instead.
export function isForwardableRange(rangeHeader: string | null): boolean {
  if (typeof rangeHeader !== "string") return false;
  if (rangeHeader.includes(",") || /\s/.test(rangeHeader)) return false;
  if (/^bytes=(\d{1,18})-(\d{1,18})?$/.test(rangeHeader)) return true;
  return /^bytes=-(\d{1,18})$/.test(rangeHeader);
}

function parseContentLength(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function mediaUnavailable(): NextResponse {
  return NextResponse.json({ error: "Media upstream unavailable" }, { status: 502 });
}

export interface MediaProxyParams {
  signedUrl: string;
  rangeHeader: string | null;
  contentType: MediaContentType;
}

export async function proxyMediaResponse(params: MediaProxyParams): Promise<NextResponse> {
  const init: RequestInit = {
    cache: "no-store",
    headers: isForwardableRange(params.rangeHeader) ? { Range: params.rangeHeader as string } : undefined,
    signal: AbortSignal.timeout(MEDIA_UPSTREAM_TIMEOUT_MS),
  };

  let upstream: Response;
  try {
    upstream = await fetch(params.signedUrl, init);
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: "Internal server error", errorId: sanitized.errorId },
      { status: 500 },
    );
  }

  if (upstream.status === 416) {
    return mirrorMediaResponse(416, null, upstream, params.contentType);
  }
  if (!upstream.ok) {
    void upstream.body?.cancel();
    return mediaUnavailable();
  }

  const contentLength = parseContentLength(upstream.headers.get("content-length"));
  if (contentLength === 0 || (contentLength !== null && contentLength > MAX_AUDIO_BYTES)) {
    void upstream.body?.cancel();
    return mediaUnavailable();
  }
  if (upstream.body === null) {
    return mediaUnavailable();
  }

  return mirrorMediaResponse(upstream.status === 206 ? 206 : 200, upstream.body, upstream, params.contentType);
}

// Mirrors the upstream media response with only allowlisted headers. Content-
// Range/Content-Length/ETag/Last-Modified come from Cloudinary with its
// authoritative byte math — we never recompute range sizes ourselves, so we
// can never report the total file size as a range length. Content-Type and
// Cache-Control are always set by us; accept-ranges advertises our support.
function mirrorMediaResponse(
  status: number,
  body: BodyInit | null,
  upstream: Response,
  contentType: MediaContentType,
): NextResponse {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  });
  for (const name of ALLOWED_UPSTREAM_HEADERS) {
    if (status === 416 && name === "content-length") continue;
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new NextResponse(body, { status, headers });
}