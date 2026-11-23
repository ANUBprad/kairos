import dns from "node:dns/promises";
import net from "node:net";
import { ValidationError } from "../types/app-error.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && parts[2] === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];

  if (normalized === "::" || normalized === "::1") return true;

  // IPv4-mapped addresses (::ffff:127.0.0.1)
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
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

/**
 * Parses and validates an http(s) URL intended for outbound fetching. Rejects
 * credentials, non-standard ports, and hostnames that resolve to private,
 * loopback, link-local, or otherwise reserved addresses.
 */
export async function assertSafePublicHttpUrl(rawUrl: string): Promise<URL> {
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

  if (net.isIP(url.hostname)) {
    assertPublicAddress(url.hostname);
    return url;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new ValidationError("URL host could not be resolved");
  }
  if (records.length === 0) {
    throw new ValidationError("URL host could not be resolved");
  }
  for (const record of records) {
    assertPublicAddress(record.address);
  }

  return url;
}

/**
 * Fetches a remote resource with scheme/address validation, bounded redirects,
 * a timeout, and a hard response-size cap.
 */
export async function safeFetchBuffer(
  rawUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    allowedContentTypes?: readonly string[];
  } = {},
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current = await assertSafePublicHttpUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: options.allowedContentTypes?.join(", ") ?? "*/*" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          throw new ValidationError("Too many or invalid redirects");
        }
        current = await assertSafePublicHttpUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) {
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
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new ValidationError("Remote resource is too large");
        }
        chunks.push(Buffer.from(value));
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType,
        finalUrl: current.toString(),
      };
    }

    throw new ValidationError("Too many redirects");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ValidationError("Remote fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
