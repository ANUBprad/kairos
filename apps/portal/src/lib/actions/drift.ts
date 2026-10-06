'use server';

import { getSelectedOrgId, requireOrgPermission } from "@/lib/server/workspace";
import { logActivity } from '@/lib/activity';
import {
  createDriftAlert,
  getDriftAlerts,
  acknowledgeDrift,
  resolveDrift,
  ignoreDrift,
  detectLatencyDrift,
  detectCostDrift,
  detectQualityDrift,
  getDriftStats,
} from '@/lib/observability/drift-detection';
import type { CreateDriftInput } from '@/lib/observability/drift-detection';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
}

export async function reportDrift(input: CreateDriftInput) {
  const orgId = await requireOrgPermission("create");
  const drift = await createDriftAlert(orgId, input);
  await logActivity(orgId, 'DRIFT_DETECTED', 'DriftAlert', drift.id, { type: input.type });
  return drift;
}

export async function listDriftAlerts(filters?: { type?: string; status?: string; severity?: string }) {
  const orgId = await getOrgId();
  return getDriftAlerts(orgId, filters);
}

export async function acknowledgeDriftAlert(driftId: string) {
  return acknowledgeDrift(driftId, await requireOrgPermission("edit"));
}

export async function resolveDriftAlert(driftId: string) {
  return resolveDrift(driftId, await requireOrgPermission("edit"));
}

export async function ignoreDriftAlert(driftId: string) {
  return ignoreDrift(driftId, await requireOrgPermission("edit"));
}

export async function runDriftDetection() {
  const orgId = await requireOrgPermission("edit");
  const [latency, cost, quality] = await Promise.all([
    detectLatencyDrift(orgId),
    detectCostDrift(orgId),
    detectQualityDrift(orgId),
  ]);
  return { latency, cost, quality };
}

export async function driftStats(days?: number) {
  const orgId = await getOrgId();
  return getDriftStats(orgId, days);
}
