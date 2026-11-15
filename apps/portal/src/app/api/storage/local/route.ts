import { readFile, stat } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { localStoragePath, verifyLocalStorageSignature } from "@/lib/storage/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

function rangeFor(value: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return "invalid";
  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;
  if (!Number.isFinite(start)) {
    const suffix = end;
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else if (!Number.isFinite(end)) {
    end = size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return "invalid";
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || "";
  const expires = Number(request.nextUrl.searchParams.get("expires"));
  const signature = request.nextUrl.searchParams.get("signature") || "";

  if (!key || !signature || !verifyLocalStorageSignature(key, expires, signature)) {
    return NextResponse.json({ error: "Invalid or expired storage URL" }, { status: 401 });
  }

  try {
    const filePath = localStoragePath(key);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile() || fileInfo.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "Stored file unavailable" }, { status: 404 });
    }

    const range = rangeFor(request.headers.get("range"), fileInfo.size);
    if (range === "invalid") {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileInfo.size}`, "Accept-Ranges": "bytes" },
      });
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? fileInfo.size - 1;
    const data = await readFile(filePath);
    const body = new Uint8Array(data.subarray(start, end + 1));
    const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const headers = new Headers({
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    });
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${fileInfo.size}`);
    return new NextResponse(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Stored file not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to read stored file" }, { status: 500 });
  }
}
