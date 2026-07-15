"use server";

import { headers } from "next/headers";
import { detectRegion } from "@/lib/pricing/config";

export async function getUserRegion(): Promise<string> {
  const headersList = await headers();
  return detectRegion(headersList);
}
