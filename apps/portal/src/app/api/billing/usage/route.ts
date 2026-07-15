import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { getAllUsage } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const usage = await getAllUsage(session.user.id);
  return NextResponse.json(usage);
}
