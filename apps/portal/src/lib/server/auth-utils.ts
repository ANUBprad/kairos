import { getDemoSession, type DemoSession } from "./demo-user";

export type { DemoSession };

/**
 * Retrieves the current server session.
 *
 * In demo mode (KAIROS_DEMO_MODE=true), returns the demo user session.
 * In production, this is a placeholder that returns null — replace with
 * proper BetterAuth/session validation when auth provider is integrated.
 *
 * IMPORTANT: In production mode without demo enabled, this returns null,
 * and callers MUST check for null and return 401.
 */
export async function getServerSession(): Promise<DemoSession | null> {
  return getDemoSession();
}

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
