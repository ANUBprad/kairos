'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
import { logActivity } from '@/lib/activity';
import {
  createAlertRule,
  getAlertRules,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  evaluateAlertRules,
  getAlertEvents,
  resolveAlertEvent,
  acknowledgeAlertEvent,
  getAlertStats,
} from '@/lib/observability/alerting';
import type { CreateAlertRuleInput } from '@/lib/observability/alerting';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
}

export async function createRule(input: CreateAlertRuleInput) {
  const orgId = await getOrgId();
  const rule = await createAlertRule(orgId, input);
  await logActivity(orgId, 'ALERT_RULE_CREATED', 'AlertRule', rule.id, { name: input.name });
  return rule;
}

export async function listRules() {
  const orgId = await getOrgId();
  return getAlertRules(orgId);
}

export async function updateRule(ruleId: string, data: Partial<CreateAlertRuleInput>) {
  return updateAlertRule(ruleId, data, await getOrgId());
}

export async function deleteRule(ruleId: string) {
  return deleteAlertRule(ruleId, await getOrgId());
}

export async function toggleRule(ruleId: string, enabled: boolean) {
  return toggleAlertRule(ruleId, enabled, await getOrgId());
}

export async function checkAlerts() {
  const orgId = await getOrgId();
  const fired = await evaluateAlertRules(orgId);
  for (const alert of fired) {
    await logActivity(orgId, 'ALERT_FIRED', 'AlertRule', alert.rule.id, {
      value: alert.value,
      message: alert.message,
    });
  }
  return fired;
}

export async function listAlertEvents(filters?: { status?: string; ruleId?: string }) {
  const orgId = await getOrgId();
  return getAlertEvents(orgId, filters);
}

export async function resolveAlert(eventId: string) {
  return resolveAlertEvent(eventId, await getOrgId());
}

export async function acknowledgeAlert(eventId: string) {
  return acknowledgeAlertEvent(eventId, await getOrgId());
}

export async function alertStats(days?: number) {
  const orgId = await getOrgId();
  return getAlertStats(orgId, days);
}
