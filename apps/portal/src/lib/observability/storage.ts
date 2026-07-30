import { prisma } from '@/lib/prisma';

export interface TelemetryConfigInput {
  samplingRate: number;
  retentionDays: number;
  enableTraces: boolean;
  enableMetrics: boolean;
  enableLogs: boolean;
  maxSpansPerTrace: number;
  maxEventsPerTrace: number;
  compressOldTraces: boolean;
  archiveAfterDays: number;
}

export async function getTelemetryConfig(orgId: string) {
  let config = await prisma.telemetryConfig.findUnique({
    where: { organizationId: orgId },
  });

  if (!config) {
    config = await prisma.telemetryConfig.create({
      data: {
        organizationId: orgId,
        samplingRate: 1.0,
        retentionDays: 90,
        enableTraces: true,
        enableMetrics: true,
        enableLogs: true,
        maxSpansPerTrace: 100,
        maxEventsPerTrace: 50,
        compressOldTraces: true,
        archiveAfterDays: 30,
      },
    });
  }

  return config;
}

export async function updateTelemetryConfig(orgId: string, input: Partial<TelemetryConfigInput>) {
  return prisma.telemetryConfig.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      ...input,
    } as any,
    update: input as any,
  });
}

export async function archiveOldTraces(orgId: string) {
  const config = await getTelemetryConfig(orgId);
  const archiveDate = new Date();
  archiveDate.setDate(archiveDate.getDate() - config.archiveAfterDays);

  const oldTraces = await prisma.trace.findMany({
    where: {
      organizationId: orgId,
      startTime: { lt: archiveDate },
    },
    select: { id: true },
  });

  if (oldTraces.length === 0) return { archived: 0 };

  const traceIds = oldTraces.map((t: any) => t.id);

  await prisma.span.deleteMany({
    where: { traceId: { in: traceIds } },
  });

  await prisma.traceEvent.deleteMany({
    where: { traceId: { in: traceIds } },
  });

  await prisma.trace.deleteMany({
    where: { id: { in: traceIds } },
  });

  return { archived: traceIds.length };
}

export async function cleanupOldAlerts(orgId: string, days: number = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [events, drifts] = await Promise.all([
    prisma.alertEvent.deleteMany({
      where: {
        organizationId: orgId,
        firedAt: { lt: cutoff },
        status: { in: ['RESOLVED', 'ACKNOWLEDGED'] },
      },
    }),
    prisma.driftAlert.deleteMany({
      where: {
        organizationId: orgId,
        createdAt: { lt: cutoff },
        status: { in: ['RESOLVED', 'IGNORED'] },
      },
    }),
  ]);

  return {
    alertEventsDeleted: events.count,
    driftAlertsDeleted: drifts.count,
  };
}

export async function getStorageStats(orgId: string) {
  const [traceCount, spanCount, eventCount, costRecordCount, alertEventCount, driftAlertCount] =
    await Promise.all([
      prisma.trace.count({ where: { organizationId: orgId } }),
      prisma.span.count({
        where: { trace: { organizationId: orgId } },
      }),
      prisma.traceEvent.count({
        where: { trace: { organizationId: orgId } },
      }),
      prisma.costRecord.count({ where: { organizationId: orgId } }),
      prisma.alertEvent.count({ where: { organizationId: orgId } }),
      prisma.driftAlert.count({ where: { organizationId: orgId } }),
    ]);

  return {
    traces: traceCount,
    spans: spanCount,
    events: eventCount,
    costRecords: costRecordCount,
    alertEvents: alertEventCount,
    driftAlerts: driftAlertCount,
    totalRecords: traceCount + spanCount + eventCount + costRecordCount + alertEventCount + driftAlertCount,
  };
}
