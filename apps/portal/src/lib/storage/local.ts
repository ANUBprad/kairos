import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageFile, StorageProvider, StorageUploadOptions } from "./types";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

export function localStorageRoot(): string {
  return path.resolve(process.env.KAIROS_LOCAL_STORAGE_DIR || path.join(process.cwd(), ".kairos-storage"));
}

export function localStoragePath(key: string): string {
  const segments = key.split("/");
  if (
    !key ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    throw new Error("Invalid local storage key");
  }
  const root = localStorageRoot();
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(root + path.sep)) {
    throw new Error("Invalid local storage key");
  }
  return target;
}

function signingSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for local storage signing");
  return secret;
}

export function signLocalStorageKey(key: string, expires: number): string {
  return createHmac("sha256", signingSecret()).update(`${key}:${expires}`).digest("hex");
}

export function verifyLocalStorageSignature(key: string, expires: number, signature: string): boolean {
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  if (expires > Math.floor(Date.now() / 1000) + 24 * 60 * 60) return false;
  let expected: string;
  try {
    expected = signLocalStorageKey(key, expires);
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function signedUrl(key: string): string {
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const baseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";
  const url = new URL("/api/storage/local", baseUrl);
  url.searchParams.set("key", key);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signLocalStorageKey(key, expires));
  return url.toString();
}

export class LocalStorageProvider implements StorageProvider {
  async upload(
    buffer: Buffer,
    fileName: string,
    key?: string,
    _options?: StorageUploadOptions,
  ): Promise<StorageFile> {
    const storageKey = key || fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const target = localStoragePath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: "wx" });
    return { key: storageKey, url: signedUrl(storageKey), provider: "local" };
  }

  async delete(key: string): Promise<void> {
    await rm(localStoragePath(key), { force: true });
  }

  getUrl(key: string): string {
    return signedUrl(key);
  }

  async getSignedUrl(key: string): Promise<string> {
    return signedUrl(key);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(localStoragePath(key));
  }
}
