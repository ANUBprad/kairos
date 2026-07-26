import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const API_SECRET = process.env.KAIROS_API_SECRET ?? "";

/**
 * Validates an API key using constant-time comparison.
 *
 * Returns the validated user/org context on success, null on failure.
 * Never logs the key value.
 */
export function validateApiKey(
  request: NextRequest,
): { userId: string; organizationId: string } | null {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) return null;

  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return null;

  // If no secret is configured, reject all API key requests in production
  if (!API_SECRET) {
    if (process.env.NODE_ENV === "production") return null;
    // In development, allow any non-empty key with a warning
    return { userId: "api-user", organizationId: "api-org" };
  }

  // Constant-time comparison
  const keyBuffer = Buffer.from(trimmed, "utf-8");
  const secretBuffer = Buffer.from(API_SECRET, "utf-8");

  if (keyBuffer.length !== secretBuffer.length) return null;

  const isValid = timingSafeEqual(keyBuffer, secretBuffer);
  if (!isValid) return null;

  return { userId: "api-user", organizationId: "api-org" };
}
