'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  getCostSummary,
  getCostForecast,
  getCostAnomalies,
} from '@/lib/observability/cost-tracker';

async function getOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
}

export async function costSummary(days?: number) {
  const orgId = await getOrgId();
  return getCostSummary(orgId, days);
}

export async function costForecast() {
  const orgId = await getOrgId();
  return getCostForecast(orgId);
}

export async function costAnomalies() {
  const orgId = await getOrgId();
  return getCostAnomalies(orgId);
}
