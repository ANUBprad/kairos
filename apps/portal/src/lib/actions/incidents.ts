'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
import { logActivity } from '@/lib/activity';
import {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  assignIncident,
  linkAlertToIncident,
  linkTraceToIncident,
  createIncidentEvent,
  getIncidentTimeline,
  getIncidentStats,
} from '@/lib/observability/incidents';
import type { CreateIncidentInput } from '@/lib/observability/incidents';

async function getOrgId(): Promise<string> {
  return getSelectedOrgId();
}

export async function createNewIncident(input: CreateIncidentInput) {
  const orgId = await getOrgId();
  const incident = await createIncident(orgId, input);
  await logActivity(orgId, 'INCIDENT_CREATED', 'Incident', incident.id, { title: input.title });
  return incident;
}

export async function listIncidents(filters?: { status?: string; severity?: string }) {
  const orgId = await getOrgId();
  return getIncidents(orgId, filters);
}

export async function getIncident(incidentId: string) {
  return getIncidentById(incidentId, await getOrgId());
}

export async function updateIncident(
  incidentId: string,
  status: 'OPEN' | 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
  data?: { resolution?: string; rootCause?: string; postmortem?: string }
) {
  const orgId = await getOrgId();
  const result = await updateIncidentStatus(incidentId, status, data, orgId);
  await logActivity(orgId, 'INCIDENT_UPDATED', 'Incident', incidentId, { status });
  return result;
}

export async function setIncidentOwner(incidentId: string, ownerId: string) {
  return assignIncident(incidentId, ownerId, await getOrgId());
}

export async function linkAlert(incidentId: string, alertId: string) {
  return linkAlertToIncident(incidentId, alertId, await getOrgId());
}

export async function linkTrace(incidentId: string, traceId: string) {
  return linkTraceToIncident(incidentId, traceId, await getOrgId());
}

export async function addIncidentNote(incidentId: string, message: string) {
  const orgId = await getOrgId();
  const event = await createIncidentEvent(incidentId, message, orgId);
  await logActivity(orgId, 'INCIDENT_NOTE', 'Incident', incidentId, { message });
  return event;
}

export async function getIncidentEvents(incidentId: string) {
  return getIncidentTimeline(incidentId, await getOrgId());
}

export async function incidentStats(days?: number) {
  const orgId = await getOrgId();
  return getIncidentStats(orgId, days);
}
