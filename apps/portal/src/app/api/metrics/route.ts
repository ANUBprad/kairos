import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/telemetry/metrics";
import { getDeploymentMeta } from "@/lib/telemetry/deployment";
import { getServerSession } from "@/lib/server/auth-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const metrics = getMetrics();
  const meta = getDeploymentMeta();

  return NextResponse.json({
    version: meta.version,
    environment: meta.environment,
    timestamp: new Date().toISOString(),
    ...metrics,
  });
}
