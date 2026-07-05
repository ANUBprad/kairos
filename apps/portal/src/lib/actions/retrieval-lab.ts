"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  getRetrievalConfig,
  saveRetrievalConfig,
  runRetrieval,
  runComparison,
  saveExperimentRun,
  listExperimentRuns,
  getExperimentRun,
} from "@/lib/retrieval/service";
import type { RetrievalConfig, RetrievalResultDisplay } from "@/lib/retrieval/types";

async function assertKbAccess(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: {
                where: { userId },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
    throw new Error("Knowledge base not found");
  }

  return kb;
}

export async function getKbRetrievalConfig(kbId: string): Promise<RetrievalConfig> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  await assertKbAccess(kbId, session.user.id);
  return getRetrievalConfig(kbId);
}

export async function updateKbRetrievalConfig(
  kbId: string,
  config: Partial<RetrievalConfig>,
): Promise<RetrievalConfig> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  await assertKbAccess(kbId, session.user.id);
  const updated = await saveRetrievalConfig(kbId, config);
  revalidatePath(`/app/retrieval-lab`);
  return updated;
}

export async function executeRetrieval(
  kbId: string,
  query: string,
  config: RetrievalConfig,
  debugMode = false,
): Promise<RetrievalResultDisplay> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  await assertKbAccess(kbId, session.user.id);
  return runRetrieval(kbId, query, config, debugMode);
}

export async function executeComparison(
  kbId: string,
  query: string,
  configA: RetrievalConfig,
  configB: RetrievalConfig,
  debugMode = false,
): Promise<{ a: RetrievalResultDisplay; b: RetrievalResultDisplay }> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  await assertKbAccess(kbId, session.user.id);
  return runComparison(kbId, query, configA, configB, debugMode);
}

export async function persistRun(
  kbId: string,
  query: string,
  config: RetrievalConfig,
  result: RetrievalResultDisplay,
): Promise<string> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  await assertKbAccess(kbId, session.user.id);
  return saveExperimentRun(null, kbId, query, config, result);
}

export async function fetchRuns(kbId: string) {
  const session = await getServerSession();
  if (!session) return [];
  return listExperimentRuns(kbId);
}

export async function fetchRun(runId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  return getExperimentRun(runId);
}

export async function getKbDocuments(kbId: string) {
  const session = await getServerSession();
  if (!session) return [];

  await assertKbAccess(kbId, session.user.id);

  return prisma.document.findMany({
    where: { knowledgeBaseId: kbId, status: "INDEXED" },
    select: { id: true, name: true, _count: { select: { chunks: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listKbsForLab() {
  const session = await getServerSession();
  if (!session) return [];

  const { ensureDefaultOrg } = await import("@/lib/server/organization");
  const { project } = await ensureDefaultOrg();

  return prisma.knowledgeBase.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}
