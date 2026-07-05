import { cache } from "react";
import { auth } from "@/lib/server/auth";
import { headers } from "next/headers";

export const getServerSession = cache(async () => {
  const headersList = await headers();
  return auth.api.getSession({ headers: headersList });
});
