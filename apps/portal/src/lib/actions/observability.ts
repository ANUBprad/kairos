'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import {
  createTrace,
  finishTrace,
  addSpan,
  finishSpan,
  addTraceEvent,
  searchTraces,
  getTraceById,
  replayTrace,
  getTraceStats,
} from '@/lib/observability/trace-explorer';
import type { TraceFilter } from '@/lib/observability/trace-explorer';

async function getOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) throw new Error('No organization');
  return membership.organizationId;
}

export async function captureTrace(input: Parameters<typeof createTrace>[1]) {
  const orgId = await getOrgId();
  const trace = await createTrace(orgId, input);
  await logActivity(orgId, 'TRACE_CREATED', 'Trace', trace.id, { name: input.name });
  return trace;
}

export async function completeTrace(
  traceId: string,
  output: Parameters<typeof finishTrace>[1]
) {
  return finishTrace(traceId, output);
}

export async function captureSpan(traceId: string, span: Parameters<typeof addSpan>[1]) {
  return addSpan(traceId, span);
}

export async function completeSpan(spanId: string, output?: unknown) {
  return finishSpan(spanId, output);
}

export async function traceEvent(
  traceId: string,
  name: string,
  attributes?: Record<string, unknown>
) {
  return addTraceEvent(traceId, name, attributes);
}

export async function listTraces(filters: TraceFilter) {
  const orgId = await getOrgId();
  return searchTraces(orgId, filters);
}

export async function getTrace(traceId: string) {
  return getTraceById(traceId);
}

export async function replayExistingTrace(traceId: string) {
  return replayTrace(traceId);
}

export async function traceStats(days?: number) {
  const orgId = await getOrgId();
  return getTraceStats(orgId, days);
}
