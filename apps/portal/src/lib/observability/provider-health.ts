import { prisma } from '@/lib/prisma';

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

  const where = {
    organizationId_provider_model_date: {
      organizationId: data.organizationId,
      provider: data.provider,
      model: data.model,
      date: dateOnly,
    },
  };

  const existing = await prisma.providerHealth.findUnique({
    where,
    select: { totalRequests: true, avgLatencyMs: true },
  });

  // Weighted running mean. Incrementing every other field but leaving
  // avgLatencyMs at its first value would report a frozen sample as the
  // average, i.e. a fabricated number once more than one request is recorded.
  // ponytail: read-then-write, so two concurrent writers can skew the mean by
  // one sample; provider health is best-effort telemetry, not a ledger.
  const prevTotal = existing?.totalRequests ?? 0;
  const nextTotal = prevTotal + data.totalRequests;
  const avgLatencyMs =
    nextTotal > 0
      ? ((existing?.avgLatencyMs ?? 0) * prevTotal + data.avgLatencyMs * data.totalRequests) / nextTotal
      : 0;

  return prisma.providerHealth.upsert({
    where,
    create: {
      provider: data.provider,
      model: data.model,
      date: dateOnly,
      totalRequests: data.totalRequests,
      successCount: data.successCount,
      errorCount: data.errorCount,
      timeoutCount: data.timeoutCount,
      avgLatencyMs,
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
      avgLatencyMs,
      totalCost: { increment: data.totalCost },
      totalTokens: { increment: data.totalTokens },
      lastError: data.lastError,
      lastErrorAt: data.lastError ? new Date() : undefined,
    },
  });
}

/**
 * One provider-call sample for the health board. Best-effort by design: an
 * observability write must never turn a working chat turn into a failed one, so
 * every error is swallowed. `errorCode` is a bounded classification (never raw
 * provider text) because it is stored and later surfaced.
 */
export async function recordProviderRequest(sample: {
  organizationId?: string | null;
  provider: string;
  model: string;
  outcome: "success" | "error" | "timeout";
  latencyMs: number;
  errorCode?: string;
  tokens?: number;
}): Promise<void> {
  if (!sample.organizationId) return;
  try {
    await recordProviderHealth({
      organizationId: sample.organizationId,
      provider: sample.provider,
      model: sample.model,
      date: new Date(),
      totalRequests: 1,
      successCount: sample.outcome === "success" ? 1 : 0,
      errorCount: sample.outcome === "error" ? 1 : 0,
      timeoutCount: sample.outcome === "timeout" ? 1 : 0,
      avgLatencyMs: Math.max(0, sample.latencyMs),
      totalCost: 0,
      totalTokens: sample.tokens ?? 0,
      lastError: sample.outcome === "success" ? undefined : sample.errorCode,
    });
  } catch {
    // Telemetry only; never surface a health-write failure to the caller.
  }
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

  for (const [provider, p] of Object.entries(byProvider)) {
    // A provider that recorded no requests carries no health signal. Reporting
    // it as 100% uptime would fabricate a green status, so drop it and let the
    // UI render its honest "no data" state instead.
    if (p.totalRequests === 0) {
      delete byProvider[provider];
      continue;
    }
    p.uptime = (p.successCount / p.totalRequests) * 100;
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
