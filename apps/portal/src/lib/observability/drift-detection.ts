import { prisma } from '@/lib/prisma';

export interface CreateDriftInput {
  type: 'EMBEDDING_DRIFT' | 'PROMPT_DRIFT' | 'DATASET_DRIFT' | 'RETRIEVER_DRIFT' | 'MODEL_DRIFT' | 'LATENCY_DRIFT' | 'QUALITY_DRIFT' | 'COST_DRIFT';
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  metric: string;
  currentValue: number;
  baselineValue: number;
  message: string;
}

export async function createDriftAlert(orgId: string, input: CreateDriftInput) {
  const deviationPercent = input.baselineValue !== 0
    ? ((input.currentValue - input.baselineValue) / input.baselineValue) * 100
    : 0;

  return prisma.driftAlert.create({
    data: {
      type: input.type,
      severity: input.severity ?? 'WARNING',
      status: 'OPEN',
      metric: input.metric,
      currentValue: input.currentValue,
      baselineValue: input.baselineValue,
      deviationPercent,
      message: input.message,
      organizationId: orgId,
    },
  });
}

export async function getDriftAlerts(orgId: string, filters?: {
  type?: string;
  status?: string;
  severity?: string;
}) {
  const where: any = { organizationId: orgId };
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;

  return prisma.driftAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function acknowledgeDrift(driftId: string) {
  return prisma.driftAlert.update({
    where: { id: driftId },
    data: { status: 'ACKNOWLEDGED' },
  });
}

export async function resolveDrift(driftId: string) {
  return prisma.driftAlert.update({
    where: { id: driftId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}

export async function ignoreDrift(driftId: string) {
  return prisma.driftAlert.update({
    where: { id: driftId },
    data: { status: 'IGNORED' },
  });
}

export async function detectLatencyDrift(orgId: string) {
  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);
  const prev7 = new Date(now);
  prev7.setDate(prev7.getDate() - 14);

  const [currentWeek, previousWeek] = await Promise.all([
    prisma.trace.aggregate({
      where: { organizationId: orgId, startTime: { gte: last7 } },
      _avg: { durationMs: true },
    }),
    prisma.trace.aggregate({
      where: { organizationId: orgId, startTime: { gte: prev7, lt: last7 } },
      _avg: { durationMs: true },
    }),
  ]);

  const currentAvg = currentWeek._avg.durationMs ?? 0;
  const prevAvg = previousWeek._avg.durationMs ?? 0;

  if (prevAvg > 0) {
    const deviation = ((currentAvg - prevAvg) / prevAvg) * 100;
    if (Math.abs(deviation) > 20) {
      await createDriftAlert(orgId, {
        type: 'LATENCY_DRIFT',
        severity: Math.abs(deviation) > 50 ? 'CRITICAL' : 'WARNING',
        metric: 'avg_latency_ms',
        currentValue: currentAvg,
        baselineValue: prevAvg,
        message: `Average latency ${deviation > 0 ? 'increased' : 'decreased'} by ${Math.abs(deviation).toFixed(1)}% (prev: ${prevAvg.toFixed(0)}ms, current: ${currentAvg.toFixed(0)}ms)`,
      });
    }
  }

  return { currentAvg, prevAvg };
}

export async function detectCostDrift(orgId: string) {
  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);
  const prev7 = new Date(now);
  prev7.setDate(prev7.getDate() - 14);

  const [currentWeek, previousWeek] = await Promise.all([
    prisma.costRecord.aggregate({
      where: { organizationId: orgId, date: { gte: last7 } },
      _sum: { cost: true },
    }),
    prisma.costRecord.aggregate({
      where: { organizationId: orgId, date: { gte: prev7, lt: last7 } },
      _sum: { cost: true },
    }),
  ]);

  const currentCost = currentWeek._sum.cost ?? 0;
  const prevCost = previousWeek._sum.cost ?? 0;

  if (prevCost > 0) {
    const deviation = ((currentCost - prevCost) / prevCost) * 100;
    if (Math.abs(deviation) > 25) {
      await createDriftAlert(orgId, {
        type: 'COST_DRIFT',
        severity: Math.abs(deviation) > 50 ? 'CRITICAL' : 'WARNING',
        metric: 'weekly_cost',
        currentValue: currentCost,
        baselineValue: prevCost,
        message: `Weekly cost ${deviation > 0 ? 'increased' : 'decreased'} by ${Math.abs(deviation).toFixed(1)}% (prev: $${prevCost.toFixed(2)}, current: $${currentCost.toFixed(2)})`,
      });
    }
  }

  return { currentCost, prevCost };
}

export async function detectQualityDrift(orgId: string) {
  const now = new Date();
  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);
  const prev7 = new Date(now);
  prev7.setDate(prev7.getDate() - 14);

  const [currentWeek, previousWeek] = await Promise.all([
    prisma.experimentRun.aggregate({
      where: { startedAt: { gte: last7 } },
      _avg: { tokensUsed: true },
    }),
    prisma.experimentRun.aggregate({
      where: { startedAt: { gte: prev7, lt: last7 } },
      _avg: { tokensUsed: true },
    }),
  ]);

  const currentAvg = currentWeek._avg.tokensUsed ?? 0;
  const prevAvg = previousWeek._avg.tokensUsed ?? 0;

  if (prevAvg > 0) {
    const deviation = ((currentAvg - prevAvg) / prevAvg) * 100;
    if (Math.abs(deviation) > 15) {
      await createDriftAlert(orgId, {
        type: 'QUALITY_DRIFT',
        severity: deviation < -20 ? 'CRITICAL' : 'WARNING',
        metric: 'avg_score',
        currentValue: currentAvg,
        baselineValue: prevAvg,
        message: `Quality score ${deviation > 0 ? 'improved' : 'degraded'} by ${Math.abs(deviation).toFixed(1)}% (prev: ${prevAvg.toFixed(3)}, current: ${currentAvg.toFixed(3)})`,
      });
    }
  }

  return { currentAvg, prevAvg };
}

export async function getDriftStats(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, open, byType, bySeverity] = await Promise.all([
    prisma.driftAlert.count({
      where: { organizationId: orgId, createdAt: { gte: startDate } },
    }),
    prisma.driftAlert.count({
      where: { organizationId: orgId, status: 'OPEN' },
    }),
    prisma.driftAlert.groupBy({
      by: ['type'],
      where: { organizationId: orgId, createdAt: { gte: startDate } },
      _count: true,
    }),
    prisma.driftAlert.groupBy({
      by: ['severity'],
      where: { organizationId: orgId, createdAt: { gte: startDate } },
      _count: true,
    }),
  ]);

  return { total, open, byType, bySeverity, days };
}
