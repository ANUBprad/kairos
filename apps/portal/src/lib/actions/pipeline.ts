'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
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
  return getSelectedOrgId();
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
  return finishPipelineStep(stepId, status, output, error, await getOrgId());
}

export async function completePipeline(pipelineId: string, status: 'COMPLETED' | 'FAILED' | 'TIMEOUT') {
  const orgId = await getOrgId();
  const result = await finishPipelineRun(pipelineId, status, orgId);
  await logActivity(orgId, 'PIPELINE_COMPLETED', 'PipelineRun', pipelineId, { status });
  return result;
}

export async function getPipeline(pipelineId: string) {
  return getPipelineRun(pipelineId, await getOrgId());
}

export async function getPipelineRuns(filters?: { status?: string; limit?: number }) {
  const orgId = await getOrgId();
  return getPipelineRunsDb(orgId, filters);
}

export async function pipelineStats(days?: number) {
  const orgId = await getOrgId();
  return getPipelineStats(orgId, days);
}
