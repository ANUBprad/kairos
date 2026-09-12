import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { Prisma } from "@prisma/client";

export const URL_MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
export const URL_FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const URL_MIN_CONTENT_CHARS = 40;
const USER_AGENT = "KairosIngest/1.0 (+https://kairos.dev; document ingestion bot)";
const ARTICLE_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml", "text/markdown"];

export type UrlSourceErrorCode =
  | "invalid_url"
  | "blocked"
  | "fetch"
  | "unsupported_content"
  | "too_large"
  | "timeout"
  | "no_content"
  | "too_many_redirects";

export class UrlSourceError extends Error {
  constructor(
    public readonly code: UrlSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UrlSourceError";
  }
}

export type ResolveHostFn = (hostname: string) => Promise<string[]>;

export interface HttpGetResult {
  status: number;
  headers: { get(name: string): string | null };
  body?: ReadableStream<Uint8Array>;
}

export interface HttpGetFn {
  (url: string, init: { signal: AbortSignal; headers: Record<string, string> }): Promise<HttpGetResult>;
}

export interface FetchUrlOptions {
  resolveHost?: ResolveHostFn;
  httpGet?: HttpGetFn;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((a) => a.address);
}

async function defaultHttpGet(url: string, init: { signal: AbortSignal; headers: Record<string, string> }): Promise<HttpGetResult> {
  const res = await fetch(url, { redirect: "manual", signal: init.signal, headers: init.headers });
  return { status: res.status, headers: res.headers, body: res.body ?? undefined };
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version !== 4 && version !== 6) return true; // malformed → fail closed
  if (version === 4) return isPrivateIpv4(ip.split(".").map(Number));
  return isPrivateIpv6(ip);
}

function isPrivateIpv4(nums: number[]): boolean {
  // Fail closed on malformed input: never treat an unparseable address as public.
  if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) return true;
  const [a, b, c] = nums;
  if (a === 0 || a === 10 || a === 127) return true; // "this network", RFC1918, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT (some cloud metadata)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata endpoints)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IANA special + TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIpv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  // IPv4-mapped/IPv4-compatible: ::ffff:a.b.c.d or ::a.b.c.d — evaluate the embedded IPv4.
  const lastColon = lower.lastIndexOf(":");
  const tail = lower.slice(lastColon + 1);
  if (tail.includes(".")) return isPrivateIpv4(tail.split(".").map(Number));

  const halves = lower.split("::");
  const left = halves.length === 2 && halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const groups = halves.length === 2 ? [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right] : lower.split(":");

  if (groups.length !== 8 || groups.some((g) => g === "" || !/^[0-9a-f]{1,4}$/.test(g))) return true; // fail closed

  const first = groups[0] ?? "";
  if (groups.every((g) => g === "0")) return true; // :: unspecified
  if (groups[7] === "1" && groups.slice(0, 7).every((g) => g === "0")) return true; // ::1 loopback
  if (first.startsWith("fc") || first.startsWith("fd")) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(first)) return true; // fe80::/10 link-local
  if (first.startsWith("ff")) return true; // ff00::/8 multicast
  if (groups[0] === "2001" && groups[1] === "db8") return true; // 2001:db8::/32 documentation
  if (groups[0] === "64" && groups[1] === "ff9b") return true; // NAT64 well-known prefix can bridge to private IPv4
  return false;
}

export function loadTarget(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlSourceError("invalid_url", "URL could not be parsed");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlSourceError("invalid_url", `Unsupported protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new UrlSourceError("invalid_url", "URLs with embedded credentials are not allowed");
  }
  if (!url.hostname) {
    throw new UrlSourceError("invalid_url", "URL has no host");
  }
  return url;
}

export async function assertPublicHost(hostname: string, resolveHost: ResolveHostFn = defaultResolveHost): Promise<void> {
  if (!hostname) throw new UrlSourceError("invalid_url", "URL has no host");
  if (isIP(hostname) !== 0) {
    if (isPrivateAddress(hostname)) {
      throw new UrlSourceError("blocked", `Address is not a public IP: ${hostname}`);
    }
    return;
  }
  let addresses: string[];
  try {
    addresses = await resolveHost(hostname);
  } catch {
    throw new UrlSourceError("blocked", `Could not resolve host: ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new UrlSourceError("blocked", `Host resolved to no addresses: ${hostname}`);
  }
  const privateAddr = addresses.find((addr) => isPrivateAddress(addr));
  if (privateAddr) {
    throw new UrlSourceError("blocked", `Host ${hostname} resolves to a non-public address (${privateAddr})`);
  }
  // ponytail: DNS validation and the subsequent TCP connect are a classic TOCTOU
  // window — a host can be re-resolved to a private address after this check.
  // Mitigating robustly means pinning the connection to the validated IP at the
  // socket level (upgrade path if attacker-controlled DNS ever becomes a concern).
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readBoundedText(body: ReadableStream<Uint8Array> | undefined, maxBytes: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new UrlSourceError("too_large", `Response exceeded ${maxBytes} byte limit`);
        }
        parts.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts).toString("utf8");
}

export async function fetchPage(
  rawUrl: string,
  opts: FetchUrlOptions = {},
): Promise<{ finalUrl: string; contentType: string; body: string }> {
  const {
    resolveHost = defaultResolveHost,
    httpGet = defaultHttpGet,
    timeoutMs = URL_FETCH_TIMEOUT_MS,
    maxResponseBytes = URL_MAX_RESPONSE_SIZE,
    maxRedirects = MAX_REDIRECTS,
  } = opts;

  const initial = loadTarget(rawUrl);
  await assertPublicHost(initial.hostname, resolveHost);

  let current = initial;
  for (let hop = 0; ; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: HttpGetResult;
    try {
      response = await httpGet(current.href, {
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.1",
          "accept-language": "en",
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new UrlSourceError("timeout", `Request timed out after ${timeoutMs}ms`);
      }
      throw new UrlSourceError("fetch", `Network error while fetching ${current.href}`);
    } finally {
      clearTimeout(timer);
    }

    if (isRedirectStatus(response.status)) {
      if (hop >= maxRedirects) {
        throw new UrlSourceError("too_many_redirects", `More than ${maxRedirects} redirects`);
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new UrlSourceError("fetch", "Redirect response had no Location header");
      }
      current = loadTarget(new URL(location, current).href);
      await assertPublicHost(current.hostname, resolveHost);
      continue;
    }

    if (response.status !== 200) {
      throw new UrlSourceError("fetch", `HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ARTICLE_CONTENT_TYPES.includes(contentType)) {
      throw new UrlSourceError("unsupported_content", `Unsupported content type: ${contentType}`);
    }

    const body = await readBoundedText(response.body, maxResponseBytes);
    return { finalUrl: current.href, contentType, body };
  }
}

// Boilerplate removal + title extraction.
//
// ponytail: this is a naive regex/stack heuristic, not a real HTML parser. It
// handles common article layouts but will occasionally keep or drop more than
// ideal. Upgrade path if fidelity matters: @mozilla/readability or a Python
// trafilatura counterpart.
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);

const ALWAYS_STRIP_TAGS = new Set([
  "script", "style", "noscript", "iframe", "object", "embed", "svg", "canvas",
  "nav", "footer", "aside", "form", "template", "select", "option", "button",
  "audio", "video", "source",
]);

const BOILERPLATE_TOKEN = /(?:^|[\s_"-])(?:advert|banner|breadcrumb|cookie|menu|modal|nav|popup|popover|promo|related|recommend|share|sidebar|social|toast)(?=[\s_"-]|$)/i;
const SR_ONLY_TOKEN = /\b(?:sr-only|visually-hidden|offscreen|screen-reader)\b/i;
const HIDDEN_ATTRIBUTE = /\b(?:hidden|aria-hidden)\b/;
const HIDDEN_STYLE = /style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|position\s*:\s*absolute)[^"]*"/i;

function isNoiseTag(tag: string, openTag: string): boolean {
  if (ALWAYS_STRIP_TAGS.has(tag)) return true;
  const lower = openTag.toLowerCase();
  if (HIDDEN_ATTRIBUTE.test(lower)) return true;
  if (HIDDEN_STYLE.test(lower)) return true;
  const attrs = openTag.match(/(?:class|id)="[^"]*"/gi);
  if (attrs && (BOILERPLATE_TOKEN.test(attrs.join(" ")) || SR_ONLY_TOKEN.test(attrs.join(" ")))) return true;
  return false;
}

function stripElements(html: string, shouldStrip: (tag: string, openTag: string) => boolean): string {
  const tokenRe = /<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g;
  const parts: string[] = [];
  let lastIndex = 0;
  const skipStack: string[] = [];
  for (const match of html.matchAll(tokenRe)) {
    const token = match[0];
    const index = match.index ?? 0;
    const closing = token[1] === "/";
    const rest = closing ? token.slice(2) : token.slice(1);
    const tagMatch = rest.match(/^[a-zA-Z][a-zA-Z0-9]*/);
    if (!tagMatch) continue;
    const tag = tagMatch[0].toLowerCase();
    const selfClosing = /\/>$/.test(token);

    if (skipStack.length > 0) {
      if (closing && skipStack[skipStack.length - 1] === tag) skipStack.pop();
      lastIndex = index + token.length;
      continue;
    }
    if (!closing && !selfClosing && !VOID_TAGS.has(tag) && shouldStrip(tag, token)) {
      skipStack.push(tag);
      lastIndex = index + token.length;
      continue;
    }
    parts.push(html.slice(lastIndex, index), token);
    lastIndex = index + token.length;
  }
  parts.push(html.slice(lastIndex));
  return parts.join("");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const n = parseInt(hex, 16);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "\uFFFD";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const n = Number(dec);
      return n >= 1 && n <= 0x10ffff ? String.fromCodePoint(n) : "\uFFFD";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&copy;/g, "\u00a9")
    .replace(/&amp;/g, "&");
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>/g, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/g, "\n\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/li>/g, "\n")
    .replace(/<br\b[^>]*\/?>/g, "\n")
    .replace(/<hr\b[^>]*\/?>/g, "\n\n")
    .replace(/<pre\b[^>]*>/g, "\n\n")
    .replace(/<\/pre>/g, "\n\n")
    .replace(/<code\b[^>]*>/g, "`")
    .replace(/<\/code>/g, "`")
    .replace(/<img\b[^>]*\/?>/g, "")
    .replace(/<\/?(?:p|div|article|section|blockquote|table|tr|ul|ol|figure)[^>]*>/g, "\n\n")
    .replace(/<\/?(?:td|th)[^>]*>/g, " ")
    .replace(/<[^>]+>/g, "");
}

function cleanMarkdown(text: string): string {
  return decodeEntities(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function extractArticle(html: string): { title: string; markdown: string } | null {
  const stripped = stripElements(html, isNoiseTag);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(stripped);
  const title = titleMatch
    ? decodeEntities(titleMatch[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 255)
    : "";

  const bodyHtml = stripped.replace(/<title[\s\S]*?<\/title>/gi, "");
  const markdown = cleanMarkdown(htmlToMarkdown(bodyHtml));
  if (markdown.length < URL_MIN_CONTENT_CHARS) return null;

  const topHeading = markdown.match(/^#{1,6}\s\S+/m);
  const finalTitle = title || (topHeading ? topHeading[0].replace(/^#+\s*/, "").trim().slice(0, 255) : "");
  const body = finalTitle && !topHeading ? `# ${finalTitle}\n\n${markdown}` : markdown;
  return { title: finalTitle, markdown: body };
}

export interface Article {
  url: string;
  title: string;
  markdown: string;
}

export async function fetchArticle(rawUrl: string, opts: FetchUrlOptions = {}): Promise<Article> {
  const page = await fetchPage(rawUrl, opts);
  const extracted = extractArticle(page.body);
  if (!extracted) {
    throw new UrlSourceError("no_content", "Page contained no readable article content");
  }
  return { url: page.finalUrl, title: extracted.title, markdown: extracted.markdown };
}

export function urlDocumentFileHash(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}

export function buildUrlDocumentData(params: {
  kbId: string;
  userId: string;
  name: string;
  sourceUrl: string;
  title: string;
  markdown: string;
}): Prisma.DocumentUncheckedCreateInput {
  const buffer = Buffer.from(params.markdown, "utf8");
  return {
    name: params.name,
    fileType: "txt",
    size: buffer.byteLength,
    fileHash: urlDocumentFileHash(params.markdown),
    sourceType: "URL",
    sourceUrl: params.sourceUrl,
    status: "STORED",
    storageProvider: null,
    storageKey: null,
    storageUrl: null,
    knowledgeBaseId: params.kbId,
    uploadedById: params.userId,
    metadata: { mimeType: "text/markdown", source: "url", title: params.title },
  };
}