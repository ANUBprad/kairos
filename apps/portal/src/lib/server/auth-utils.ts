import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { getDemoSession, isDemoModeEnabled, type DemoSession } from "./demo-user";
import { logger } from "@/lib/logger";

export type { DemoSession };

function isDynamicServerError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("couldn't be rendered statically because it used")
  );
}

/**
 * Resolves the current server session.
 *
 * - Demo mode (KAIROS_DEMO_MODE=true, non-production): the demo user session.
 * - Otherwise: the real Better Auth session, or null when unauthenticated.
 *
 * In production the demo branch is unreachable, so a user is never fabricated:
 * callers must handle null (see requireSession).
 */
export const getServerSession = cache(async (): Promise<DemoSession | null> => {
  if (isDemoModeEnabled()) return getDemoSession();

  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    // better-auth exposes its own User shape; map to the app's session contract.
    return session
      ? { user: session.user as unknown as DemoSession["user"] }
      : null;
  } catch (err) {
    if (isDynamicServerError(err)) throw err;
    logger.error("Session validation failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
});

/**
 * Requires a valid session. Throws if no session is available.
 * Use this in server actions and API routes that require authentication.
 */
export async function requireSession(): Promise<DemoSession> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session;
}
