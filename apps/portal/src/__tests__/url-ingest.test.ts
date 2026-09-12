import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertPublicHost,
  buildUrlDocumentData,
  extractArticle,
  fetchArticle,
  isPrivateAddress,
  loadTarget,
  urlDocumentFileHash,
  UrlSourceError,
  type HttpGetResult,
  type ResolveHostFn,
} from "@/lib/ingestion/url";

// Deterministic, network-free tests. Every request path is driven through an
// injected resolver + transport so no public website or DNS is ever touched.

const STUB_DNS: ResolveHostFn = async (host) => {
  const map: Record<string, string[]> = {
    "example.com": ["93.184.216.34"],
    "a.example": ["8.8.8.8"],
    "b.example": ["1.1.1.1"],
    "mixed.example": ["8.8.8.8", "127.0.0.1"],
    "blocked.example": ["10.0.0.5"],
    "localhost": ["127.0.0.1"],
  };
  const addrs = map[host];
  if (!addrs) throw new Error(`no such host: ${host}`);
  return addrs;
};

function htmlResponse(body: string, status = 200, contentType = "text/html; charset=utf-8"): HttpGetResult {
  const encoder = new TextEncoder();
  return {
    status,
    headers: {
      get: (name) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

function redirectResponse(location: string | null, status = 302): HttpGetResult {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "location" ? location : null) },
    body: undefined,
  };
}

const ARTICLE_HTML = `<!DOCTYPE html>
<html><head><title>Kairos Launch</title></head>
<body>
<nav><ul><li>Home</li><li>Pricing</li></ul></nav>
<div id="sidebar"><p>Subscribe to our newsletter now</p></div>
<article>
<h1>Kairos Launches</h1>
<p>We shipped the first version of the product today.</p>
<script>console.log("evil teaser injection")</script>
<ul><li>Fast</li><li>Secure</li></ul>
</article>
<footer><p>&copy; 2026 Kairos</p></footer>
</body></html>`;

function isCode(code: string) {
  return (err: unknown) => err instanceof UrlSourceError && err.code === code;
}

describe("URL validation", () => {
  it("accepts https and http targets", () => {
    assert.equal(loadTarget("https://example.com/article").protocol, "https:");
    assert.equal(loadTarget("http://example.com").protocol, "http:");
  });

  it("rejects non-http(s) schemes", () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com",
      "data:text/html;base64,PGI+",
      "javascript:alert(1)",
      "chrome://settings",
    ]) {
      assert.throws(() => loadTarget(url), isCode("invalid_url"));
    }
  });

  it("rejects malformed URLs and empty hosts", () => {
    for (const url of ["not a url", "http://", "//example.com", "https://"]) {
      assert.throws(() => loadTarget(url), isCode("invalid_url"));
    }
  });

  it("rejects URLs with embedded credentials", () => {
    assert.throws(() => loadTarget("https://user:pass@example.com"), isCode("invalid_url"));
  });

  it("classifies private/reserved IPv4 ranges as non-public", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "127.8.8.8",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
    }
  });

  it("classifies public addresses and non-private edges as public", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "93.184.216.34",
      "100.63.0.1",
      "169.253.0.1",
      "172.32.0.1",
      "192.169.0.1",
      "223.1.1.1",
    ]) {
      assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
    }
  });

  it("classifies private IPv6 (loopback, ULA, link-local, mapped) as non-public", () => {
    for (const ip of [
      "::",
      "::1",
      "fe80::1",
      "fc00::1",
      "fd00::1",
      "ff02::1",
      "2001:db8::1",
      "::ffff:192.168.1.1",
      "::ffff:127.0.0.1",
    ]) {
      assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
    }
  });

  it("accepts public IPv6", () => {
    assert.equal(isPrivateAddress("2606:4700::1111"), false);
    assert.equal(isPrivateAddress("2001:4860:4860::8888"), false);
    assert.equal(isPrivateAddress("::ffff:8.8.8.8"), false);
  });

  it("blocks hostnames that resolve to private or mixed addresses", async () => {
    await assert.rejects(assertPublicHost("localhost", STUB_DNS), isCode("blocked"));
    await assert.rejects(assertPublicHost("blocked.example", STUB_DNS), isCode("blocked"));
    await assert.rejects(assertPublicHost("mixed.example", STUB_DNS), isCode("blocked"));
    await assert.rejects(assertPublicHost("missing.example", STUB_DNS), isCode("blocked"));
    await assert.rejects(assertPublicHost("127.0.0.1"), isCode("blocked"));
  });

  it("accepts hostnames that resolve to public addresses only", async () => {
    await assert.doesNotReject(assertPublicHost("example.com", STUB_DNS));
  });
});

describe("Redirect handling", () => {
  it("follows a public -> public redirect and canonicalizes the final URL", async () => {
    let hop = 0;
    const httpGet = async (): Promise<HttpGetResult> =>
      hop++ === 0 ? redirectResponse("https://example.com/final") : htmlResponse(ARTICLE_HTML);
    const article = await fetchArticle("https://a.example/start", { resolveHost: STUB_DNS, httpGet });
    assert.equal(article.url, "https://example.com/final");
    assert.equal(article.title, "Kairos Launch");
  });

  it("rejects a redirect into a private address space", async () => {
    const httpGet = async (): Promise<HttpGetResult> => redirectResponse("http://internal.local/secret");
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet }),
      isCode("blocked"),
    );
  });

  it("rejects an excessive redirect chain", async () => {
    const httpGet = async (url: string): Promise<HttpGetResult> => redirectResponse(url);
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet }),
      isCode("too_many_redirects"),
    );
  });

  it("rejects a redirect without a Location header", async () => {
    const httpGet = async (): Promise<HttpGetResult> => redirectResponse(null);
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet }),
      isCode("fetch"),
    );
  });
});

describe("Fetch behaviour", () => {
  it("rejects non-2xx responses", async () => {
    const httpGet = async (): Promise<HttpGetResult> => htmlResponse("", 404);
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet }),
      isCode("fetch"),
    );
  });

  it("rejects unsupported content types", async () => {
    const httpGet = async (): Promise<HttpGetResult> => htmlResponse("GIF89a", 200, "image/gif");
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet }),
      isCode("unsupported_content"),
    );
  });

  it("rejects responses over the size cap", async () => {
    const httpGet = async (): Promise<HttpGetResult> => htmlResponse("x".repeat(500));
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet, maxResponseBytes: 100 }),
      isCode("too_large"),
    );
  });

  it("reports a timeout when the transport hangs", async () => {
    const hanging = (_url: string, init: { signal: AbortSignal }): Promise<HttpGetResult> =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    await assert.rejects(
      fetchArticle("https://example.com/x", { resolveHost: STUB_DNS, httpGet: hanging, timeoutMs: 20 }),
      isCode("timeout"),
    );
  });
});

describe("Article extraction", () => {
  it("extracts title, headings, paragraphs and lists while dropping boilerplate", () => {
    const result = extractArticle(ARTICLE_HTML);
    assert.notEqual(result, null);
    assert.equal(result?.title, "Kairos Launch");
    const md = result?.markdown ?? "";
    assert.match(md, /# Kairos Launches/);
    assert.match(md, /We shipped the first version of the product today\./);
    assert.match(md, /- Fast/);
    assert.match(md, /- Secure/);
    for (const noise of ["Pricing", "newsletter", "console.log", "evil teaser", "2026 Kairos"]) {
      assert.equal(md.includes(noise), false, `markdown should not contain "${noise}"`);
    }
  });

  it("returns null for boilerplate-only pages", () => {
    const page = `<html><body><nav><ul><li>Home</li><li>Pricing</li></ul></nav>
<div class="cookie-banner">Accept cookies</div></body></html>`;
    assert.equal(extractArticle(page), null);
  });

  it("returns null for empty pages", () => {
    assert.equal(extractArticle("<html><head><title>x</title></head><body></body></html>"), null);
  });
});

describe("URL document shape", () => {
  const markdown = "# Kairos Launches\n\nBody text of the article.";

  it("builds a URL-source document with null storage fields", () => {
    const data = buildUrlDocumentData({
      kbId: "kb_1",
      userId: "u_1",
      name: "Kairos Launch",
      sourceUrl: "https://example.com/article",
      title: "Kairos Launch",
      markdown,
    });
    assert.equal(data.sourceType, "URL");
    assert.equal(data.sourceUrl, "https://example.com/article");
    assert.equal(data.fileType, "txt");
    assert.equal(data.status, "STORED");
    assert.equal(data.size, Buffer.byteLength(markdown, "utf8"));
    assert.equal(data.storageProvider, null);
    assert.equal(data.storageKey, null);
    assert.equal(data.storageUrl, null);
    assert.equal(data.knowledgeBaseId, "kb_1");
    assert.equal(data.uploadedById, "u_1");
  });

  it("hashes content deterministically for duplicate detection", () => {
    const a = buildUrlDocumentData({ kbId: "k", userId: "u", name: "n", sourceUrl: "u1", title: "t", markdown });
    const b = buildUrlDocumentData({ kbId: "k", userId: "u", name: "n", sourceUrl: "u2", title: "t", markdown });
    assert.equal(a.fileHash, b.fileHash);
    assert.equal(a.fileHash, urlDocumentFileHash(markdown));
    assert.notEqual(a.fileHash, urlDocumentFileHash(markdown + "!"));
  });
});