import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/telemetry/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getHealthStatus();
    const status = health.status === "unhealthy" ? 503 : 200;
    return NextResponse.json(health, { status });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString(), error: "Health check failed" },
      { status: 503 },
    );
  }
}
