import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/telemetry/metrics";
import { getDeploymentMeta } from "@/lib/telemetry/deployment";

export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = getMetrics();
  const meta = getDeploymentMeta();

  return NextResponse.json({
    version: meta.version,
    gitCommit: meta.gitCommit,
    environment: meta.environment,
    timestamp: new Date().toISOString(),
    ...metrics,
  });
}
