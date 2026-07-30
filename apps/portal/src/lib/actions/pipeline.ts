'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import {
  createPipelineRun,
  finishPipelineStep,
  finishPipelineRun,
  getPipelineRun,
  getPipelineRuns as getPipelineRunsDb,
  getPipelineStats,
} from '@/lib/observability/pipeline-inspector';
import type { CreatePipelineInput } from '@/lib/observability/pipeline-inspector';

async function getOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
}

export async function startPipeline(input: CreatePipelineInput) {
  const orgId = await getOrgId();
  const pipeline = await createPipelineRun(orgId, input);
  await logActivity(orgId, 'PIPELINE_STARTED', 'PipelineRun', pipeline.id, {
    stepCount: input.steps.length,
  });
  return pipeline;
}

export async function completeStep(stepId: string, status: 'COMPLETED' | 'FAILED' | 'TIMEOUT', output?: unknown, error?: string) {
  return finishPipelineStep(stepId, status, output, error);
}

export async function completePipeline(pipelineId: string, status: 'COMPLETED' | 'FAILED' | 'TIMEOUT') {
  const orgId = await getOrgId();
  const result = await finishPipelineRun(pipelineId, status);
  await logActivity(orgId, 'PIPELINE_COMPLETED', 'PipelineRun', pipelineId, { status });
  return result;
}

export async function getPipeline(pipelineId: string) {
  return getPipelineRun(pipelineId);
}

export async function getPipelineRuns(filters?: { status?: string; limit?: number }) {
  const orgId = await getOrgId();
  return getPipelineRunsDb(orgId, filters);
}

export async function pipelineStats(days?: number) {
  const orgId = await getOrgId();
  return getPipelineStats(orgId, days);
}
