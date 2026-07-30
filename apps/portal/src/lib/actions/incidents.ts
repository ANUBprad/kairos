'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
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
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
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
  return getIncidentById(incidentId);
}

export async function updateIncident(
  incidentId: string,
  status: 'OPEN' | 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
  data?: { resolution?: string; rootCause?: string; postmortem?: string }
) {
  const result = await updateIncidentStatus(incidentId, status, data);
  const orgId = await getOrgId();
  await logActivity(orgId, 'INCIDENT_UPDATED', 'Incident', incidentId, { status });
  return result;
}

export async function setIncidentOwner(incidentId: string, ownerId: string) {
  return assignIncident(incidentId, ownerId);
}

export async function linkAlert(incidentId: string, alertId: string) {
  return linkAlertToIncident(incidentId, alertId);
}

export async function linkTrace(incidentId: string, traceId: string) {
  return linkTraceToIncident(incidentId, traceId);
}

export async function addIncidentNote(incidentId: string, message: string) {
  const orgId = await getOrgId();
  const event = await createIncidentEvent(incidentId, message);
  await logActivity(orgId, 'INCIDENT_NOTE', 'Incident', incidentId, { message });
  return event;
}

export async function getIncidentEvents(incidentId: string) {
  return getIncidentTimeline(incidentId);
}

export async function incidentStats(days?: number) {
  const orgId = await getOrgId();
  return getIncidentStats(orgId, days);
}
