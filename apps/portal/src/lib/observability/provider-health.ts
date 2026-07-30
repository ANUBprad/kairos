import { prisma } from '../db';

export async function recordProviderHealth(data: {
  provider: string;
  model: string;
  date: Date;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  avgLatencyMs: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  totalCost: number;
  totalTokens: number;
  lastError?: string;
  organizationId: string;
}) {
  const dateOnly = new Date(data.date);
  dateOnly.setHours(0, 0, 0, 0);

  return prisma.providerHealth.upsert({
    where: {
      provider_model_date: {
        provider: data.provider,
        model: data.model,
        date: dateOnly,
      },
    },
    create: {
      provider: data.provider,
      model: data.model,
      date: dateOnly,
      totalRequests: data.totalRequests,
      successCount: data.successCount,
      errorCount: data.errorCount,
      timeoutCount: data.timeoutCount,
      avgLatencyMs: data.avgLatencyMs,
      p50LatencyMs: data.p50LatencyMs,
      p95LatencyMs: data.p95LatencyMs,
      p99LatencyMs: data.p99LatencyMs,
      totalCost: data.totalCost,
      totalTokens: data.totalTokens,
      lastError: data.lastError,
      lastErrorAt: data.lastError ? new Date() : undefined,
      organizationId: data.organizationId,
    },
    update: {
      totalRequests: { increment: data.totalRequests },
      successCount: { increment: data.successCount },
      errorCount: { increment: data.errorCount },
      timeoutCount: { increment: data.timeoutCount },
      totalCost: { increment: data.totalCost },
      totalTokens: { increment: data.totalTokens },
      lastError: data.lastError,
      lastErrorAt: data.lastError ? new Date() : undefined,
    },
  });
}

export async function getProviderHealthSummary(orgId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const health = await prisma.providerHealth.findMany({
    where: { organizationId: orgId, date: { gte: startDate } },
    orderBy: [{ provider: 'asc' }, { model: 'asc' }, { date: 'asc' }],
  });

  const byProvider: Record<string, {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
    totalCost: number;
    uptime: number;
    models: Record<string, typeof health>;
  }> = {};

  for (const h of health) {
    if (!byProvider[h.provider]) {
      byProvider[h.provider] = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgLatencyMs: 0,
        totalCost: 0,
        uptime: 0,
        models: {},
      };
    }
    const p = byProvider[h.provider];
    p.totalRequests += h.totalRequests;
    p.successCount += h.successCount;
    p.errorCount += h.errorCount;
    p.totalCost += h.totalCost;

    if (!p.models[h.model]) p.models[h.model] = [];
    p.models[h.model].push(h);
  }

  for (const p of Object.values(byProvider)) {
    p.uptime = p.totalRequests > 0 ? (p.successCount / p.totalRequests) * 100 : 100;
    let totalLatency = 0;
    let totalCount = 0;
    for (const modelHealth of Object.values(p.models)) {
      for (const h of modelHealth) {
        totalLatency += h.avgLatencyMs * h.totalRequests;
        totalCount += h.totalRequests;
      }
    }
    p.avgLatencyMs = totalCount > 0 ? totalLatency / totalCount : 0;
  }

  return { byProvider, days };
}

export async function getProviderLatencyPercentiles(orgId: string, provider: string, model?: string) {
  const where: any = { organizationId: orgId, provider };
  if (model) where.model = model;

  const records = await prisma.providerHealth.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 30,
  });

  const p50Values = records.filter((r: any) => r.p50LatencyMs).map((r: any) => r.p50LatencyMs!);
  const p95Values = records.filter((r: any) => r.p95LatencyMs).map((r: any) => r.p95LatencyMs!);
  const p99Values = records.filter((r: any) => r.p99LatencyMs).map((r: any) => r.p99LatencyMs!);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    avgP50: avg(p50Values),
    avgP95: avg(p95Values),
    avgP99: avg(p99Values),
    records: records.length,
  };
}

export async function getProviderErrors(orgId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.providerHealth.findMany({
    where: {
      organizationId: orgId,
      date: { gte: startDate },
      errorCount: { gt: 0 },
    },
    orderBy: { errorCount: 'desc' },
    take: 50,
  });
}
