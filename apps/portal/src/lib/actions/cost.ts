'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
import {
  getCostSummary,
  getCostForecast,
  getCostAnomalies,
} from '@/lib/observability/cost-tracker';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
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
