'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
import {
  getProviderHealthSummary,
  getProviderLatencyPercentiles,
  getProviderErrors,
} from '@/lib/observability/provider-health';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
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
