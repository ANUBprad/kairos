'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getTelemetryConfig, updateTelemetryConfig, archiveOldTraces, cleanupOldAlerts, getStorageStats } from '@/lib/observability/storage';
import type { TelemetryConfigInput } from '@/lib/observability/storage';

async function getOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
}

export async function telemetryConfig() {
  const orgId = await getOrgId();
  return getTelemetryConfig(orgId);
}

export async function updateConfig(input: Partial<TelemetryConfigInput>) {
  const orgId = await getOrgId();
  return updateTelemetryConfig(orgId, input);
}

export async function archiveTraces() {
  const orgId = await getOrgId();
  return archiveOldTraces(orgId);
}

export async function cleanupAlerts(days?: number) {
  const orgId = await getOrgId();
  return cleanupOldAlerts(orgId, days);
}

export async function storageStats() {
  const orgId = await getOrgId();
  return getStorageStats(orgId);
}
