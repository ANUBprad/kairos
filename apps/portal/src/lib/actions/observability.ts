'use server';

import { getSelectedOrgId } from "@/lib/server/workspace";
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
  return getSelectedOrgId();
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
  return finishTrace(traceId, output, await getOrgId());
}

export async function captureSpan(traceId: string, span: Parameters<typeof addSpan>[1]) {
  return addSpan(traceId, span, await getOrgId());
}

export async function completeSpan(spanId: string, output?: unknown) {
  return finishSpan(spanId, output, await getOrgId());
}

export async function traceEvent(
  traceId: string,
  name: string,
  attributes?: Record<string, unknown>
) {
  return addTraceEvent(traceId, name, attributes, await getOrgId());
}

export async function listTraces(filters: TraceFilter) {
  const orgId = await getOrgId();
  return searchTraces(orgId, filters);
}

export async function getTrace(traceId: string) {
  return getTraceById(traceId, await getOrgId());
}

export async function replayExistingTrace(traceId: string) {
  return replayTrace(traceId, await getOrgId());
}

export async function traceStats(days?: number) {
  const orgId = await getOrgId();
  return getTraceStats(orgId, days);
}
