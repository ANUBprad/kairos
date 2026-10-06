'use server';

import { getSelectedOrgId, requireOrgPermission } from "@/lib/server/workspace";
import { getTelemetryConfig, updateTelemetryConfig, archiveOldTraces, cleanupOldAlerts, getStorageStats } from '@/lib/observability/storage';
import type { TelemetryConfigInput } from '@/lib/observability/storage';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
}

export async function telemetryConfig() {
  const orgId = await getOrgId();
  return getTelemetryConfig(orgId);
}

export async function updateConfig(input: Partial<TelemetryConfigInput>) {
  const orgId = await requireOrgPermission("edit");
  return updateTelemetryConfig(orgId, input);
}

export async function archiveTraces() {
  const orgId = await requireOrgPermission("edit");
  return archiveOldTraces(orgId);
}

export async function cleanupAlerts(days?: number) {
  const orgId = await requireOrgPermission("edit");
  return cleanupOldAlerts(orgId, days);
}

export async function storageStats() {
  const orgId = await getOrgId();
  return getStorageStats(orgId);
}
