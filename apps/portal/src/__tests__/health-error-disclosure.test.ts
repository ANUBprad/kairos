import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

(globalThis as unknown as { prisma: PrismaClient }).prisma = {
  $queryRaw: async () => { throw new Error("postgresql://user:secret@private-host/db internal file path"); },
} as unknown as PrismaClient;

it("public health checks report database failure without internal error details", async () => {
  const { getHealthStatus } = await import("@/lib/telemetry/health");
  const health = await getHealthStatus();
  assert.equal(health.status, "unhealthy");
  assert.equal(health.checks.database.message, "Database connection failed");
});
