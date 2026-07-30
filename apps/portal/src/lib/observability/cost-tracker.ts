import { prisma } from '@/lib/prisma';

export interface CostFilter {
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  model?: string;
  groupBy?: 'date' | 'provider' | 'model' | 'operation';
}

export async function recordCost(orgId: string, data: {
  date: Date;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestCount?: number;
  userId?: string;
}) {
  const dateOnly = new Date(data.date);
  dateOnly.setHours(0, 0, 0, 0);

  return prisma.costRecord.upsert({
    where: {
      date_provider_model_operation_organizationId: {
        date: dateOnly,
        provider: data.provider,
        model: data.model,
        operation: data.operation,
        organizationId: orgId,
      },
    },
    create: {
      date: dateOnly,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.totalTokens,
      cost: data.cost,
      requestCount: data.requestCount ?? 1,
      organizationId: orgId,
      userId: data.userId,
    },
    update: {
      inputTokens: { increment: data.inputTokens },
      outputTokens: { increment: data.outputTokens },
      totalTokens: { increment: data.totalTokens },
      cost: { increment: data.cost },
      requestCount: { increment: data.requestCount ?? 1 },
    },
  });
}

export async function getCostSummary(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalCost, totalTokens, byProvider, byModel, dailyCosts] =
    await Promise.all([
      prisma.costRecord.aggregate({
        where: { organizationId: orgId, date: { gte: startDate } },
        _sum: { cost: true, totalTokens: true, requestCount: true },
      }),
      prisma.costRecord.aggregate({
        where: { organizationId: orgId, date: { gte: startDate } },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
      }),
      prisma.costRecord.groupBy({
        by: ['provider'],
        where: { organizationId: orgId, date: { gte: startDate } },
        _sum: { cost: true, totalTokens: true, requestCount: true },
        orderBy: { _sum: { cost: 'desc' } },
      }),
      prisma.costRecord.groupBy({
        by: ['model'],
        where: { organizationId: orgId, date: { gte: startDate } },
        _sum: { cost: true, totalTokens: true, requestCount: true },
        orderBy: { _sum: { cost: 'desc' } },
      }),
      prisma.costRecord.groupBy({
        by: ['date'],
        where: { organizationId: orgId, date: { gte: startDate } },
        _sum: { cost: true, totalTokens: true },
        orderBy: { date: 'asc' },
      }),
    ]);

  return {
    totalCost: totalCost._sum.cost ?? 0,
    totalTokens: totalTokens._sum.totalTokens ?? 0,
    inputTokens: totalTokens._sum.inputTokens ?? 0,
    outputTokens: totalTokens._sum.outputTokens ?? 0,
    totalRequests: Number(totalCost._sum.requestCount ?? 0),
    avgCostPerRequest: Number(totalCost._sum.requestCount ?? 0) > 0
      ? (totalCost._sum.cost ?? 0) / Number(totalCost._sum.requestCount ?? 0)
      : 0,
    byProvider,
    byModel,
    dailyCosts,
    days,
  };
}

export async function getCostForecast(orgId: string) {
  const last30 = await getCostSummary(orgId, 30);
  const last7 = await getCostSummary(orgId, 7);

  const dailyAvg30 = last30.days > 0 ? last30.totalCost / last30.days : 0;
  const dailyAvg7 = last7.days > 0 ? last7.totalCost / last7.days : 0;
  const trend = dailyAvg30 > 0 ? (dailyAvg7 - dailyAvg30) / dailyAvg30 : 0;

  const forecast30 = dailyAvg7 * 30 * (1 + trend);
  const forecast90 = dailyAvg7 * 90 * (1 + trend);

  return {
    dailyAvg30,
    dailyAvg7,
    trend,
    forecast30Days: forecast30,
    forecast90Days: forecast90,
    projectedMonthly: forecast30,
    projectedQuarterly: forecast90,
  };
}

export async function getCostAnomalies(orgId: string) {
  const daily = await prisma.costRecord.groupBy({
    by: ['date'],
    where: { organizationId: orgId },
    _sum: { cost: true },
    orderBy: { date: 'asc' },
  });

  if (daily.length < 7) return [];

  const costs = daily.map((d: any) => d._sum.cost ?? 0);
  const mean = costs.reduce((a: number, b: number) => a + b, 0) / costs.length;
  const stdDev = Math.sqrt(costs.reduce((sum: number, c: number) => sum + Math.pow(c - mean, 2), 0) / costs.length);

  const anomalies: Array<{ date: Date; cost: number; deviation: number }> = [];
  for (const d of daily) {
    const cost = d._sum.cost ?? 0;
    if (stdDev > 0) {
      const deviation = Math.abs(cost - mean) / stdDev;
      if (deviation > 2) {
        anomalies.push({ date: d.date, cost, deviation });
      }
    }
  }

  return anomalies;
}
