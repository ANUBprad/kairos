import { prisma } from '../db';

export interface CreatePipelineInput {
  traceId?: string;
  steps: Array<{
    name: string;
    type: string;
    order: number;
  }>;
}

export async function createPipelineRun(orgId: string, input: CreatePipelineInput) {
  return prisma.pipelineRun.create({
    data: {
      traceId: input.traceId,
      status: 'RUNNING',
      organizationId: orgId,
      startTime: new Date(),
      steps: {
        create: input.steps.map((s) => ({
          name: s.name,
          type: s.type,
          order: s.order,
          status: 'RUNNING',
          startTime: new Date(),
        })),
      },
    },
    include: { steps: true },
  });
}

export async function finishPipelineStep(
  stepId: string,
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT',
  output?: unknown,
  error?: string
) {
  const now = new Date();
  const step = await prisma.pipelineStep.findUnique({ where: { id: stepId } });
  if (!step) throw new Error('Pipeline step not found');

  return prisma.pipelineStep.update({
    where: { id: stepId },
    data: {
      status,
      endTime: now,
      durationMs: now.getTime() - step.startTime.getTime(),
      output: output as any,
      error,
    },
  });
}

export async function finishPipelineRun(
  pipelineId: string,
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT'
) {
  const now = new Date();
  const pipeline = await prisma.pipelineRun.findUnique({ where: { id: pipelineId } });
  if (!pipeline) throw new Error('Pipeline run not found');

  return prisma.pipelineRun.update({
    where: { id: pipelineId },
    data: {
      status,
      endTime: now,
      totalMs: now.getTime() - pipeline.startTime.getTime(),
    },
  });
}

export async function getPipelineRun(pipelineId: string) {
  return prisma.pipelineRun.findUnique({
    where: { id: pipelineId },
    include: {
      steps: { orderBy: { order: 'asc' } },
    },
  });
}

export async function getPipelineRuns(orgId: string, filters?: {
  status?: string;
  limit?: number;
}) {
  const where: any = { organizationId: orgId };
  if (filters?.status) where.status = filters.status;

  return prisma.pipelineRun.findMany({
    where,
    include: {
      steps: { orderBy: { order: 'asc' } },
    },
    orderBy: { startTime: 'desc' },
    take: filters?.limit ?? 50,
  });
}

export async function getPipelineStats(orgId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, completed, failed, avgDuration] = await Promise.all([
    prisma.pipelineRun.count({
      where: { organizationId: orgId, startTime: { gte: startDate } },
    }),
    prisma.pipelineRun.count({
      where: { organizationId: orgId, startTime: { gte: startDate }, status: 'COMPLETED' },
    }),
    prisma.pipelineRun.count({
      where: { organizationId: orgId, startTime: { gte: startDate }, status: 'FAILED' },
    }),
    prisma.pipelineRun.aggregate({
      where: { organizationId: orgId, startTime: { gte: startDate } },
      _avg: { totalMs: true },
    }),
  ]);

  return {
    total,
    completed,
    failed,
    successRate: total > 0 ? (completed / total) * 100 : 0,
    avgDurationMs: avgDuration._avg.totalMs ?? 0,
    days,
  };
}
