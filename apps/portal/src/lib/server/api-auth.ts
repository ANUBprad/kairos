import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { validateAndRetrieveApiKey } from "@/lib/api-keys";
import { hasPermission } from "@/lib/rbac";

const API_SECRET = process.env.KAIROS_API_SECRET ?? "";

/**
 * Validates an API key and resolves the caller's organization.
 *
 * Stored API keys are resolved against the database to return the real
 * user/org context. A shared KAIROS_API_SECRET is accepted in development
 * for service-to-service calls. Never logs the key value.
 */
export async function validateApiKey(
  request: NextRequest,
): Promise<{ userId: string; organizationId: string } | null> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) return null;

  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith("kai_")) {
    const resolved = await validateAndRetrieveApiKey(trimmed);
    if (resolved) {
      const resource = request.nextUrl.pathname.split("/")[3];
      const readOnly = ["GET", "HEAD"].includes(request.method) || (resource === "compare" && request.method === "POST");
      const permission = readOnly ? "view" : request.method === "DELETE" ? "delete" : "edit";
      const resourceScope = resource === "artifacts" ? "artifacts"
        : ["experiments", "datasets", "compare", "regression"].includes(resource) ? "experiment" : "";
      if (!hasPermission(resolved.role, permission)) return null;
      if (!resolved.scopes.some((scope) => scope === "admin" || scope === (readOnly ? "read" : "write") || (resourceScope !== "" && scope === resourceScope))) return null;
      return { userId: resolved.userId, organizationId: resolved.organizationId };
    }
    return null;
  }

  if (process.env.NODE_ENV === "production") return null;

  if (!API_SECRET) {
    return { userId: "api-user", organizationId: "api-org" };
  }

  const keyBuffer = Buffer.from(trimmed, "utf-8");
  const secretBuffer = Buffer.from(API_SECRET, "utf-8");

  if (keyBuffer.length !== secretBuffer.length) return null;

  const isValid = timingSafeEqual(keyBuffer, secretBuffer);
  if (!isValid) return null;

  return { userId: "api-user", organizationId: "api-org" };
}
