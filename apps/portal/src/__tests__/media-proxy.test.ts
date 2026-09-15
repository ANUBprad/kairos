import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isForwardableRange,
  mediaContentType,
  proxyMediaResponse,
  MAX_AUDIO_BYTES,
} from "@/lib/audio/media-proxy";

const originalFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init?: RequestInit;
}

let fetchCalls: FetchCall[] = [];

function mockUpstream(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): typeof fetch {
  return async (input, init) => {
    fetchCalls.push({ url: String(input), init });
    return new Response(body, { status, headers });
  };
}

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("isForwardableRange (pure single-range gate)", () => {
  it("forwards the three RFC 7233 single-range forms", () => {
    assert.equal(isForwardableRange("bytes=0-999"), true);
    assert.equal(isForwardableRange("bytes=1000-"), true);
    assert.equal(isForwardableRange("bytes=-1000"), true);
  });

  it("accepts degenerate single-byte and full-file ranges", () => {
    assert.equal(isForwardableRange("bytes=0-0"), true);
    assert.equal(isForwardableRange("bytes=999-999"), true);
    assert.equal(isForwardableRange("bytes=0-"), true);
  });

  it("rejects null, empty, whitespace and oversized values", () => {
    assert.equal(isForwardableRange(null), false);
    assert.equal(isForwardableRange(""), false);
    assert.equal(isForwardableRange("bytes="), false);
    assert.equal(isForwardableRange("bytes=-"), false);
    assert.equal(isForwardableRange(" bytes=0-5"), false);
    assert.equal(isForwardableRange("bytes=0-5 "), false);
    assert.equal(isForwardableRange(`bytes=0-${"9".repeat(20)}`), false);
  });

  it("rejects multipart ranges, other units and garbage", () => {
    assert.equal(isForwardableRange("bytes=1-2,3-4"), false);
    assert.equal(isForwardableRange("bytes=0-1,2-"), false);
    assert.equal(isForwardableRange("items=0-1"), false);
    assert.equal(isForwardableRange("bytes=abc"), false);
    assert.equal(isForwardableRange("bytes=0-abc"), false);
    assert.equal(isForwardableRange("bytes=abc-def"), false);
  });

  it("forwards a syntactically valid but inverted range (the upstream owns 416s)", () => {
    assert.equal(isForwardableRange("bytes=999-100"), true);
  });

  it("keeps the 50MB ceiling constant intact", () => {
    assert.equal(MAX_AUDIO_BYTES, 50 * 1024 * 1024);
  });

  it("maps the persisted format to its media type", () => {
    assert.equal(mediaContentType("mp3"), "audio/mpeg");
    assert.equal(mediaContentType("wav"), "audio/wav");
    assert.equal(mediaContentType(undefined), "audio/wav");
  });
});

describe("proxyMediaResponse streaming behavior", () => {
  it("serves a full 200 when the client sends no Range", async () => {
    globalThis.fetch = mockUpstream(200, "whole fame", {
      "content-type": "audio/something",
      "content-length": "10",
      etag: '"abc"',
      "set-cookie": "p0wned=1",
      server: "cloudinary-1.0",
    });

    const res = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k?a=1",
      rangeHeader: null,
      contentType: "audio/wav",
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "audio/wav");
    assert.equal(res.headers.get("content-length"), "10");
    assert.equal(res.headers.get("etag"), '"abc"');
    assert.equal(res.headers.get("cache-control"), "private, max-age=3600");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal(await res.text(), "whole fame");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].init?.headers, undefined, "no Range header is forwarded without a range request");
    assert.equal(res.headers.get("set-cookie"), null, "never forwards storage/session headers");
    assert.equal(res.headers.get("server"), null);
  });

  it("forwards a start-end range and mirrors a 206 with the upstream's byte math", async () => {
    globalThis.fetch = mockUpstream(206, "a".repeat(1000), {
      "content-range": "bytes 0-999/5000",
      "content-length": "1000",
      etag: '"616e0e0a"',
    });

    const res = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k?a=1",
      rangeHeader: "bytes=0-999",
      contentType: "audio/mpeg",
    });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 0-999/5000");
    assert.equal(res.headers.get("content-length"), "1000", "range length, not total size");
    assert.equal(res.headers.get("etag"), '"616e0e0a"');
    assert.equal(res.headers.get("content-type"), "audio/mpeg");
    const body = await res.text();
    assert.equal(body.length, 1000);
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string> | undefined)?.Range,
      "bytes=0-999",
      "the validated range is forwarded upstream",
    );
  });

  it("forwards open-ended and suffix ranges unchanged", async () => {
    globalThis.fetch = mockUpstream(206, "tail", { "content-range": "bytes 1024-4999/5000", "content-length": "3976" });
    const open = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: "bytes=1024-",
      contentType: "audio/mpeg",
    });
    assert.equal(open.status, 206);
    assert.equal(open.headers.get("content-range"), "bytes 1024-4999/5000");
    assert.equal((fetchCalls[0].init?.headers as Record<string, string> | undefined)?.Range, "bytes=1024-");

    globalThis.fetch = mockUpstream(206, "tail100", { "content-range": "bytes 4900-4999/5000", "content-length": "100" });
    const suffix = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: "bytes=-100",
      contentType: "audio/mpeg",
    });
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers.get("content-range"), "bytes 4900-4999/5000");
    assert.equal(suffix.headers.get("content-length"), "100");
    assert.equal((fetchCalls[1].init?.headers as Record<string, string> | undefined)?.Range, "bytes=-100");
  });

  it("mirrors an upstream 416 (unsatisfiable/inverted range) including Content-Range, without a length", async () => {
    globalThis.fetch = mockUpstream(416, "bytes", { "content-range": "bytes */12345" });

    const res = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: "bytes=999-100",
      contentType: "audio/wav",
    });

    assert.equal(res.status, 416);
    assert.equal(res.headers.get("content-range"), "bytes */12345");
    assert.equal(res.headers.get("content-length"), null);
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    assert.equal((fetchCalls[0].init?.headers as Record<string, string> | undefined)?.Range, "bytes=999-100");
  });

  it("ignores malformed and multipart ranges by serving the full 200 without a Range to storage", async () => {
    for (const bad of ["bytes=abc", "bytes=1-2,3-4", "bytes="]) {
      fetchCalls = [];
      globalThis.fetch = mockUpstream(200, "full body", { "content-length": "9" });
      const res = await proxyMediaResponse({
        signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
        rangeHeader: bad,
        contentType: "audio/mpeg",
      });
      assert.equal(res.status, 200, `${bad} must fall back to the full resource`);
      assert.equal(await res.text(), "full body");
      assert.equal(
        (fetchCalls[0].init?.headers as Record<string, string> | undefined)?.Range,
        undefined,
        `${bad} must not be forwarded`,
      );
    }
  });

  it("maps upstream 404/5xx to a sanitized 502", async () => {
    for (const status of [404, 500, 403]) {
      globalThis.fetch = mockUpstream(status, "nope");
      const res = await proxyMediaResponse({
        signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
        rangeHeader: null,
        contentType: "audio/wav",
      });
      assert.equal(res.status, 502);
      assert.deepEqual(await res.json(), { error: "Media upstream unavailable" });
    }
  });

  it("rejects empty and oversized upstream content", async () => {
    globalThis.fetch = mockUpstream(200, "", { "content-length": "0" });
    const empty = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: null,
      contentType: "audio/wav",
    });
    assert.equal(empty.status, 502);

    globalThis.fetch = mockUpstream(200, "big", { "content-length": String(MAX_AUDIO_BYTES + 1) });
    const big = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: null,
      contentType: "audio/wav",
    });
    assert.equal(big.status, 502);

    globalThis.fetch = mockUpstream(206, "big range", { "content-length": String(MAX_AUDIO_BYTES + 1) });
    const bigRange = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: "bytes=0-999999999",
      contentType: "audio/wav",
    });
    assert.equal(bigRange.status, 502, "even a 206 response beyond the cap must be rejected");
  });

  it("surfaces an upstream transport failure as a sanitized 500 with an error id", async () => {
    globalThis.fetch = async () => {
      throw new Error("upstream boom");
    };
    const res = await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: null,
      contentType: "audio/wav",
    });
    assert.equal(res.status, 500);
    const body = await res.json() as { error: string; errorId: string };
    assert.equal(body.error, "Internal server error");
    assert.ok(typeof body.errorId === "string" && body.errorId.length > 0);
    assert.doesNotMatch(JSON.stringify(body), /res\.cloudinary\.com|authenticated|signature/, "no signed URL may leak");
  });

  it("guards every upstream fetch with a timeout signal", async () => {
    globalThis.fetch = mockUpstream(200, "guarded", { "content-length": "7" });
    await proxyMediaResponse({
      signedUrl: "https://res.cloudinary.com/x/raw/authenticated/k",
      rangeHeader: "bytes=0-6",
      contentType: "audio/wav",
    });
    const signal = fetchCalls[0].init?.signal;
    assert.ok(signal, "a timeout signal must be attached");
    assert.equal(signal?.aborted, false);
  });
});