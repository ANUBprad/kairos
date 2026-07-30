import { prisma } from '@/lib/prisma';

export interface CreateTraceInput {
  requestId: string;
  name: string;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  input?: string;
  output?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}

export interface TraceSpanInput {
  name: string;
  status?: 'OK' | 'ERROR' | 'UNSET';
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  attributes?: Record<string, unknown>;
  parentSpanId?: string;
}

export async function createTrace(orgId: string, input: CreateTraceInput) {
  return prisma.trace.create({
    data: {
      requestId: input.requestId,
      name: input.name,
      status: 'OK',
      startTime: new Date(),
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      input: input.input,
      output: input.output,
      metadata: input.metadata as any,
      userId: input.userId,
      organizationId: orgId,
    },
  });
}

export async function finishTrace(
  traceId: string,
  output: {
    status?: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';
    output?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
  }
) {
  const now = new Date();
  const trace = await prisma.trace.findUnique({ where: { id: traceId } });
  if (!trace) throw new Error('Trace not found');

  const durationMs = now.getTime() - trace.startTime.getTime();

  return prisma.trace.update({
    where: { id: traceId },
    data: {
      status: output.status ?? 'OK',
      endTime: now,
      durationMs,
      output: output.output,
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      totalTokens: output.totalTokens,
      cost: output.cost,
    },
  });
}

export async function addSpan(traceId: string, span: TraceSpanInput) {
  return prisma.span.create({
    data: {
      traceId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      status: span.status ?? 'OK',
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs: span.durationMs,
      input: span.input as any,
      output: span.output as any,
      attributes: span.attributes as any,
    },
  });
}

export async function finishSpan(spanId: string, output?: unknown) {
  const now = new Date();
  const span = await prisma.span.findUnique({ where: { id: spanId } });
  if (!span) throw new Error('Span not found');

  return prisma.span.update({
    where: { id: spanId },
    data: {
      endTime: now,
      durationMs: now.getTime() - span.startTime.getTime(),
      output: output as any,
    },
  });
}

export async function addTraceEvent(
  traceId: string,
  name: string,
  attributes?: Record<string, unknown>
) {
  return prisma.traceEvent.create({
    data: {
      traceId,
      name,
      timestamp: new Date(),
      attributes: attributes as any,
    },
  });
}

export interface TraceFilter {
  provider?: string;
  model?: string;
  status?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  minDurationMs?: number;
  maxDurationMs?: number;
  maxCost?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'startTime' | 'durationMs' | 'cost' | 'totalTokens';
  sortOrder?: 'asc' | 'desc';
}

export async function searchTraces(orgId: string, filters: TraceFilter) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const sortBy = filters.sortBy ?? 'startTime';
  const sortOrder = filters.sortOrder ?? 'desc';

  const where: any = { organizationId: orgId };

  if (filters.provider) where.provider = filters.provider;
  if (filters.model) where.model = filters.model;
  if (filters.status) where.status = filters.status;
  if (filters.minDurationMs) where.durationMs = { gte: filters.minDurationMs };
  if (filters.maxDurationMs) where.durationMs = { ...where.durationMs, lte: filters.maxDurationMs };
  if (filters.maxCost) where.cost = { lte: filters.maxCost };
  if (filters.startDate || filters.endDate) {
    where.startTime = {};
    if (filters.startDate) where.startTime.gte = filters.startDate;
    if (filters.endDate) where.startTime.lte = filters.endDate;
  }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { requestId: { contains: filters.search } },
      { input: { contains: filters.search } },
      { output: { contains: filters.search } },
    ];
  }

  const [traces, total] = await Promise.all([
    prisma.trace.findMany({
      where,
      include: {
        _count: { select: { spans: true, events: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.trace.count({ where }),
  ]);

  return {
    traces: traces.map((t: any) => ({
      ...t,
      spanCount: t._count.spans,
      eventCount: t._count.events,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getTraceById(traceId: string) {
  return prisma.trace.findUnique({
    where: { id: traceId },
    include: {
      spans: { orderBy: { startTime: 'asc' } },
      events: { orderBy: { timestamp: 'asc' } },
    },
  });
}

export async function replayTrace(traceId: string) {
  const trace = await getTraceById(traceId);
  if (!trace) throw new Error('Trace not found');
  return trace;
}

export async function getTraceStats(orgId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalTraces, errorTraces, avgDuration, totalCost, byProvider, byModel, statusBreakdown] =
    await Promise.all([
      prisma.trace.count({
        where: { organizationId: orgId, startTime: { gte: startDate } },
      }),
      prisma.trace.count({
        where: { organizationId: orgId, startTime: { gte: startDate }, status: 'ERROR' },
      }),
      prisma.trace.aggregate({
        where: { organizationId: orgId, startTime: { gte: startDate } },
        _avg: { durationMs: true },
      }),
      prisma.trace.aggregate({
        where: { organizationId: orgId, startTime: { gte: startDate } },
        _sum: { cost: true },
      }),
      prisma.trace.groupBy({
        by: ['provider'],
        where: { organizationId: orgId, startTime: { gte: startDate } },
        _count: true,
        _avg: { durationMs: true },
        _sum: { cost: true },
      }),
      prisma.trace.groupBy({
        by: ['model'],
        where: { organizationId: orgId, startTime: { gte: startDate }, model: { not: null } },
        _count: true,
        _avg: { durationMs: true },
      }),
      prisma.trace.groupBy({
        by: ['status'],
        where: { organizationId: orgId, startTime: { gte: startDate } },
        _count: true,
      }),
    ]);

  return {
    totalTraces,
    errorTraces,
    errorRate: totalTraces > 0 ? (errorTraces / totalTraces) * 100 : 0,
    avgDurationMs: avgDuration._avg.durationMs ?? 0,
    totalCost: totalCost._sum.cost ?? 0,
    byProvider,
    byModel,
    statusBreakdown,
    days,
  };
}
