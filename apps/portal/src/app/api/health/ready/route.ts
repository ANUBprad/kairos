import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/telemetry/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  const isReady = health.status !== "unhealthy";
  return NextResponse.json(
    { status: isReady ? "ready" : "not_ready", checks: health.checks },
    { status: isReady ? 200 : 503 },
  );
}
