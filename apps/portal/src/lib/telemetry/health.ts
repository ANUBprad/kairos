import { prisma } from "@/lib/prisma";
import { getDeploymentMeta } from "./deployment";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  gitCommit: string;
  environment: string;
  checks: {
    database: ServiceCheck;
    [key: string]: ServiceCheck;
  };
}

export interface ServiceCheck {
  status: "up" | "down" | "degraded";
  latencyMs?: number;
  message?: string;
}

const startTime = Date.now();

async function checkDatabase(): Promise<ServiceCheck> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: latencyMs > 1000 ? "degraded" : "up",
      latencyMs,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : "Database connection failed",
    };
  }
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const meta = getDeploymentMeta();
  const dbCheck = await checkDatabase();

  const checks = { database: dbCheck };
  const allUp = Object.values(checks).every((c) => c.status === "up");
  const anyDown = Object.values(checks).some((c) => c.status === "down");

  return {
    status: allUp ? "healthy" : anyDown ? "unhealthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: meta.version,
    gitCommit: meta.gitCommit,
    environment: meta.environment,
    checks,
  };
}
