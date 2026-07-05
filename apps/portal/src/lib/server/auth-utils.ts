import { cache } from "react";
import { auth } from "@/lib/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const getServerSession = cache(async () => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session;
  } catch (err) {
    console.error("[AUTH] Session validation failed:", err);
    redirect("/login");
  }
});

export async function requireSession() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}
