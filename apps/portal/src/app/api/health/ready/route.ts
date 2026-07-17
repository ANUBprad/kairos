import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/telemetry/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getHealthStatus();
    const isReady = health.status !== "unhealthy";
    return NextResponse.json(
      { status: isReady ? "ready" : "not_ready", checks: health.checks },
      { status: isReady ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready", error: "Readiness check failed" },
      { status: 503 },
    );
  }
}
