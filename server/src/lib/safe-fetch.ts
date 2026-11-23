import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { ValidationError } from "../types/app-error.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface LookupRecord {
  address: string;
  family: number;
}

export type SafeLookup = (
  hostname: string,
  options: { all: true },
) => Promise<LookupRecord[]>;

export interface SocketLike {
  remoteAddress?: string;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  destroy?(error?: Error): void;
}

export interface ReadResult {
  done: boolean;
  value?: Uint8Array;
}

export interface BodyReader {
  read(): Promise<ReadResult>;
  cancel(): Promise<void>;
}

export interface HeaderLike {
  get(name: string): string | null;
}

export interface ResponseLike {
  status: number;
  headers: HeaderLike;
  body?: { getReader(): BodyReader } | null;
  socket?: SocketLike;
}

export interface RequestLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  destroy(error?: Error): void;
  end(): void;
}

type PinnedLookup = (
  hostname: string,
  options: { family?: number; hints?: number; all?: boolean },
  callback: (error: Error | null, address: string | LookupRecord[], family?: number) => void,
) => void;

export interface PinnedRequestOptions extends Omit<http.RequestOptions, "lookup"> {
  hostname: string;
  port: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  lookup: PinnedLookup;
  pinnedAddress: string;
  pinnedFamily: number;
  servername?: string;
  agent: false;
  autoSelectFamily: boolean;
}

export interface FetchDeps {
  lookup?: SafeLookup;
  requestFactory?: (url: URL, options: PinnedRequestOptions) => RequestLike;
}

export interface ResolvedUrl {
  url: URL;
  address: string;
  family: number;
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/** Expands an IPv6 address into eight 16-bit groups, decoding a trailing dotted IPv4. */
function expandIpv6(ip: string): number[] | null {
  let value = ip.toLowerCase().split("%")[0];
  if (!value) return null;

  const lastColon = value.lastIndexOf(":");
  if (lastColon >= 0) {
    const tail = value.slice(lastColon + 1);
    if (tail.includes(".")) {
      if (net.isIP(tail) !== 4) return null;
      const bytes = tail.split(".").map(Number);
      const high = (bytes[0] << 8) | bytes[1];
      const low = (bytes[2] << 8) | bytes[3];
      value = `${value.slice(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
    }
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const group of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      groups.push(Number.parseInt(group, 16));
    }
    return groups;
  };
  const left = parse(halves[0]);
  const right = halves.length === 2 ? parse(halves[1]) : [];
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

/** Returns the IPv4 wrapped by ::ffff:0:0/96 or the deprecated ::0:0/96 form. */
function embeddedIpv4(groups: number[]): string | null {
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  const compatible = groups.slice(0, 6).every((group) => group === 0);
  if (!mapped && !compatible) return null;
  return [
    (groups[6] >> 8) & 0xff,
    groups[6] & 0xff,
    (groups[7] >> 8) & 0xff,
    groups[7] & 0xff,
  ].join(".");
}

function normalizeIp(ip: string): string {
  const family = net.isIP(ip);
  if (family === 4) return ip;
  if (family === 6) {
    const groups = expandIpv6(ip);
    if (groups) {
      const embedded = embeddedIpv4(groups);
      if (embedded) return embedded;
      return groups.map((group) => group.toString(16).padStart(4, "0")).join(":");
    }
  }
  return ip.toLowerCase().split("%")[0];
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip);
  if (!groups) return true;
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;

  const embedded = embeddedIpv4(groups);
  if (embedded) return isPrivateIpv4(embedded);

  const [a, b] = groups;
  return (
    (a & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (a & 0xffc0) === 0xfe80 || // fe80::/10 link local
    (a & 0xffc0) === 0xfec0 || // fec0::/10 deprecated site local
    (a & 0xff00) === 0xff00 || // ff00::/8 multicast
    (a === 0x2001 && b === 0x0db8) // 2001:db8::/32 documentation
  );
}

function assertPublicAddress(address: string): void {
  const family = net.isIP(address);
  if (family === 4 && isPrivateIpv4(address)) {
    throw new ValidationError("URL host is not a permitted public address");
  }
  if (family === 6 && isPrivateIpv6(address)) {
    throw new ValidationError("URL host is not a permitted public address");
  }
  if (family === 0) {
    throw new ValidationError("URL host could not be resolved");
  }
}

function assertSafeHostname(hostname: string): void {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".home") ||
    lower.endsWith(".lan") ||
    lower === "metadata.google.internal"
  ) {
    throw new ValidationError("URL host is not permitted");
  }
}

/** Rejects decimal, hex, and octal numeric hosts that WHATWG URL may not normalize. */
function isNumericHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (!lower || net.isIP(stripBrackets(lower)) !== 0) return false;
  const numeric = /^(?:\d+|0x[0-9a-f]+|0[0-7]+)$/;
  const labels = lower.split(".");
  return labels.length > 0 && labels.every((label) => numeric.test(label));
}

/**
 * Parses, validates, and resolves an http(s) URL exactly once. The returned
 * address is the IP that must be pinned to the TCP connection for this hop.
 */
export async function resolveSafePublicHttpUrl(
  rawUrl: string,
  deps: FetchDeps = {},
): Promise<ResolvedUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("Enter a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ValidationError("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new ValidationError("URLs with embedded credentials are not allowed");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ValidationError("URL port is not allowed");
  }

  assertSafeHostname(url.hostname);
  if (isNumericHostname(url.hostname)) {
    throw new ValidationError("URL host is not a permitted public address");
  }

  const literal = stripBrackets(url.hostname);
  const literalFamily = net.isIP(literal);
  if (literalFamily !== 0) {
    assertPublicAddress(literal);
    return { url, address: literal, family: literalFamily };
  }

  const lookup: SafeLookup =
    deps.lookup ?? ((hostname: string) => dns.lookup(hostname, { all: true }));
  let records: LookupRecord[];
  try {
    records = await lookup(url.hostname, { all: true });
  } catch {
    throw new ValidationError("URL host could not be resolved");
  }
  if (records.length === 0) {
    throw new ValidationError("URL host could not be resolved");
  }
  for (const record of records) {
    assertPublicAddress(record.address);
  }

  const pinned = records.find((record) => record.family === 4) ?? records[0];
  return { url, address: pinned.address, family: pinned.family };
}

/**
 * Parses and validates an http(s) URL intended for outbound fetching. Rejects
 * credentials, non-standard ports, and hostnames that resolve to private,
 * loopback, link-local, or otherwise reserved addresses.
 */
export async function assertSafePublicHttpUrl(
  rawUrl: string,
  deps: FetchDeps = {},
): Promise<URL> {
  return (await resolveSafePublicHttpUrl(rawUrl, deps)).url;
}

/** Ignores the socket-layer hostname and always returns the already validated IP. */
function createPinnedLookup(address: string, family: number): PinnedLookup {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
    } else {
      callback(null, address, family);
    }
  };
}

function createNodeReader(stream: AsyncIterable<Buffer | Uint8Array>): BodyReader {
  const iterator = stream[Symbol.asyncIterator]();
  return {
    async read() {
      const result = await iterator.next();
      if (result.done) return { done: true };
      const value = result.value;
      return { done: false, value: value instanceof Uint8Array ? value : Buffer.from(value) };
    },
    async cancel() {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  };
}

function toResponseLike(message: http.IncomingMessage): ResponseLike {
  return {
    status: message.statusCode ?? 0,
    headers: {
      get: (name) => {
        const value = message.headers[name.toLowerCase()];
        if (value === undefined) return null;
        return Array.isArray(value) ? value.join(", ") : value;
      },
    },
    body: { getReader: () => createNodeReader(message) },
    socket: message.socket as unknown as SocketLike,
  };
}

function normalizeResponse(raw: unknown): ResponseLike {
  if (raw && typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    const headers = candidate.headers as Record<string, unknown> | undefined;
    if (headers && typeof headers.get === "function") return raw as ResponseLike;
    if ("statusCode" in candidate || "headers" in candidate) {
      return toResponseLike(raw as http.IncomingMessage);
    }
  }
  return raw as ResponseLike;
}

function performRequest(
  url: URL,
  resolved: ResolvedUrl,
  accept: string,
  deps: FetchDeps,
  signal: AbortSignal,
): Promise<{ response: ResponseLike; request: RequestLike }> {
  const host = stripBrackets(url.hostname);
  const options: PinnedRequestOptions = {
    protocol: url.protocol,
    hostname: host,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    method: "GET",
    path: `${url.pathname}${url.search}`,
    headers: { accept, host: url.host },
    agent: false,
    autoSelectFamily: false,
    lookup: createPinnedLookup(resolved.address, resolved.family),
    pinnedAddress: resolved.address,
    pinnedFamily: resolved.family,
    ...(url.protocol === "https:" ? { servername: host } : {}),
  };

  return new Promise((resolveRequest, rejectRequest) => {
    let settled = false;
    let onAbort: () => void = () => {};
    let request: RequestLike;

    const finish = (error: Error | null, response?: ResponseLike) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (error) rejectRequest(error);
      else resolveRequest({ response: response as ResponseLike, request });
    };

    try {
      request = deps.requestFactory
        ? deps.requestFactory(url, options)
        : ((url.protocol === "https:"
            ? https.request(options as unknown as https.RequestOptions)
            : http.request(options as unknown as http.RequestOptions)) as unknown as RequestLike);
    } catch (error) {
      rejectRequest(new ValidationError("Remote fetch failed", error));
      return;
    }

    onAbort = () => {
      request.destroy();
      finish(new ValidationError("Remote fetch timed out"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    if (typeof request.on === "function") {
      request.on("error", (rawError: unknown) => {
        if (settled) return;
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));
        finish(new ValidationError("Remote fetch failed", error));
      });
      request.on("socket", (rawSocket: unknown) => {
        const socket = rawSocket as SocketLike;
        if (!socket || typeof socket !== "object") return;
        let checked = false;
        const checkPeer = () => {
          if (checked || settled) return;
          const remote = socket.remoteAddress;
          if (typeof remote !== "string" || remote.length === 0) return;
          checked = true;
          if (normalizeIp(remote) !== normalizeIp(resolved.address)) {
            socket.destroy?.(new ValidationError("Remote fetch peer address mismatch"));
            finish(new ValidationError("Remote fetch failed (peer address mismatch)"));
          }
        };
        if (typeof socket.on === "function") {
          socket.on("connect", () => checkPeer());
        }
        checkPeer();
      });
      request.on("response", (rawResponse: unknown) => {
        if (settled) return;
        finish(null, normalizeResponse(rawResponse));
      });
    }

    try {
      request.end();
    } catch (error) {
      finish(new ValidationError("Remote fetch failed", error));
    }
  });
}

/**
 * Fetches a remote resource with scheme/address validation, DNS pinning,
 * bounded redirects, a timeout, and a hard response-size cap.
 */
export async function safeFetchBuffer(
  rawUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    allowedContentTypes?: readonly string[];
  } = {},
  deps: FetchDeps = {},
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accept = options.allowedContentTypes?.join(", ") ?? "*/*";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let resolved = await resolveSafePublicHttpUrl(rawUrl, deps);

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const { response, request } = await performRequest(
        resolved.url,
        resolved,
        accept,
        deps,
        controller.signal,
      );

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          throw new ValidationError("Too many or invalid redirects");
        }
        let next: URL;
        try {
          next = new URL(location, resolved.url);
        } catch {
          throw new ValidationError("Too many or invalid redirects");
        }
        if (!["http:", "https:"].includes(next.protocol)) {
          throw new ValidationError("Only http and https URLs are allowed");
        }
        resolved = await resolveSafePublicHttpUrl(next.toString(), deps);
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new ValidationError(`Remote fetch failed (${response.status})`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        options.allowedContentTypes &&
        !options.allowedContentTypes.some((type) =>
          contentType.toLowerCase().startsWith(type),
        )
      ) {
        throw new ValidationError("Remote resource has an unexpected content type");
      }

      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > maxBytes) {
        throw new ValidationError("Remote resource is too large");
      }

      if (!response.body) {
        throw new ValidationError("Remote resource has no body");
      }

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      const abortBody = () => request.destroy();
      controller.signal.addEventListener("abort", abortBody, { once: true });
      try {
        for (;;) {
          if (controller.signal.aborted) {
            throw new ValidationError("Remote fetch timed out");
          }
          const { done, value } = await reader.read();
          if (controller.signal.aborted) {
            throw new ValidationError("Remote fetch timed out");
          }
          if (done) break;
          total += value?.byteLength ?? 0;
          if (total > maxBytes) {
            await reader.cancel();
            throw new ValidationError("Remote resource is too large");
          }
          chunks.push(Buffer.from(value ?? new Uint8Array()));
        }
      } finally {
        controller.signal.removeEventListener("abort", abortBody);
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType,
        finalUrl: resolved.url.toString(),
      };
    }

    throw new ValidationError("Too many redirects");
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new ValidationError("Remote fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
