'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import {
  getProviderHealthSummary,
  getProviderLatencyPercentiles,
  getProviderErrors,
} from '@/lib/observability/provider-health';

async function getOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
}

export async function providerHealthSummary(days?: number) {
  const orgId = await getOrgId();
  return getProviderHealthSummary(orgId, days);
}

export async function providerLatency(provider: string, model?: string) {
  const orgId = await getOrgId();
  return getProviderLatencyPercentiles(orgId, provider, model);
}

export async function providerErrorList(days?: number) {
  const orgId = await getOrgId();
  return getProviderErrors(orgId, days);
}
