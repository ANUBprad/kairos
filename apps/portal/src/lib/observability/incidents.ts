import { prisma } from '@/lib/prisma';

export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity?: 'MINOR' | 'MAJOR' | 'CRITICAL' | 'FATAL';
  ownerId?: string;
  linkedAlertIds?: string[];
  linkedTraceIds?: string[];
}

export async function createIncident(orgId: string, input: CreateIncidentInput) {
  return prisma.incident.create({
    data: {
      title: input.title,
      description: input.description,
      severity: input.severity ?? 'MINOR',
      status: 'OPEN',
      organizationId: orgId,
      ownerId: input.ownerId,
      linkedAlertIds: input.linkedAlertIds ?? [],
      linkedTraceIds: input.linkedTraceIds ?? [],
    },
  });
}

export async function getIncidents(orgId: string, filters?: {
  status?: string;
  severity?: string;
}) {
  const where: any = { organizationId: orgId };
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;

  return prisma.incident.findMany({
    where,
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getIncidentById(incidentId: string) {
  return prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}

export async function updateIncidentStatus(
  incidentId: string,
  status: 'OPEN' | 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
  data?: {
    resolution?: string;
    rootCause?: string;
    postmortem?: string;
  }
) {
  const update: any = { status };
  if (data?.resolution) update.resolution = data.resolution;
  if (data?.rootCause) update.rootCause = data.rootCause;
  if (data?.postmortem) update.postmortem = data.postmortem;
  if (status === 'RESOLVED' || status === 'CLOSED') {
    update.resolvedAt = new Date();
  }

  return prisma.incident.update({
    where: { id: incidentId },
    data: update,
  });
}

export async function assignIncident(incidentId: string, ownerId: string) {
  return prisma.incident.update({
    where: { id: incidentId },
    data: { ownerId },
  });
}

export async function linkAlertToIncident(incidentId: string, alertId: string) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new Error('Incident not found');

  const linkedAlertIds = [...new Set([...incident.linkedAlertIds, alertId])];
  return prisma.incident.update({
    where: { id: incidentId },
    data: { linkedAlertIds },
  });
}

export async function linkTraceToIncident(incidentId: string, traceId: string) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new Error('Incident not found');

  const linkedTraceIds = [...new Set([...incident.linkedTraceIds, traceId])];
  return prisma.incident.update({
    where: { id: incidentId },
    data: { linkedTraceIds },
  });
}

export async function createIncidentEvent(incidentId: string, message: string) {
  return prisma.incidentEvent.create({
    data: {
      incidentId,
      message,
      timestamp: new Date(),
    },
  });
}

export async function getIncidentTimeline(incidentId: string) {
  return prisma.incidentEvent.findMany({
    where: { incidentId },
    orderBy: { timestamp: 'asc' },
  });
}

export async function getIncidentStats(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, open, bySeverity, byStatus] = await Promise.all([
    prisma.incident.count({
      where: { organizationId: orgId, createdAt: { gte: startDate } },
    }),
    prisma.incident.count({
      where: { organizationId: orgId, status: { in: ['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING'] } },
    }),
    prisma.incident.groupBy({
      by: ['severity'],
      where: { organizationId: orgId, createdAt: { gte: startDate } },
      _count: true,
    }),
    prisma.incident.groupBy({
      by: ['status'],
      where: { organizationId: orgId, createdAt: { gte: startDate } },
      _count: true,
    }),
    prisma.incident.aggregate({
      where: {
        organizationId: orgId,
        resolvedAt: { not: null },
        createdAt: { gte: startDate },
      },
      _avg: {
        // Calculate avg resolution time in application
      },
    }),
  ]);

  const resolvedIncidents = await prisma.incident.findMany({
    where: {
      organizationId: orgId,
      resolvedAt: { not: null },
      createdAt: { gte: startDate },
    },
    select: { startedAt: true, resolvedAt: true },
  });

  const avgResolutionMs = resolvedIncidents.length > 0
    ? resolvedIncidents.reduce((sum: number, i: any) => {
        return sum + (i.resolvedAt!.getTime() - i.startedAt.getTime());
      }, 0) / resolvedIncidents.length
    : 0;

  return {
    total,
    open,
    bySeverity,
    byStatus,
    avgResolutionHours: avgResolutionMs / (1000 * 60 * 60),
    days,
  };
}
