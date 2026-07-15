import { cache } from "react";
import { auth } from "@/lib/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";

function isDynamicServerError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("couldn't be rendered statically because it used")
  );
}

export const getServerSession = cache(async () => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session;
  } catch (err) {
    if (isDynamicServerError(err)) {
      throw err;
    }
    logger.error("Session validation failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    redirect("/login");
  }
});

export async function requireSession() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}
