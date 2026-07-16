"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { ensureDefaultOrg } from "@/lib/server/organization";
import { revalidatePath } from "next/cache";
import { serverTrackEvent } from "@/lib/telemetry/analytics-server";

async function assertMemberAccess(kbId: string, _userId: string) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: { id: true },
  });

  if (!kb) {
    throw new Error("Knowledge base not found");
  }

  return kb;
}

export async function createKnowledgeBase(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const name = formData.get("name");
  const description = formData.get("description");

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Name is required");
  }
  if (name.length > 255) {
    throw new Error("Name is too long");
  }
  if (typeof description === "string" && description.length > 1000) {
    throw new Error("Description is too long");
  }

  const { project } = await ensureDefaultOrg();

  const kb = await prisma.knowledgeBase.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      projectId: project.id,
    },
    select: { id: true, name: true, description: true, createdAt: true },
  });

  serverTrackEvent("knowledge_base_created", { kbId: kb.id, name: kb.name }, session.user.id);
  revalidatePath("/app");
  return kb;
}

export async function listKnowledgeBases() {
  const session = await getServerSession();
  if (!session) return [];

  const { project } = await ensureDefaultOrg();

  return prisma.knowledgeBase.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      retrievalConfig: true,
      _count: { select: { documents: true } },
    },
  });
}

export async function renameKnowledgeBase(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const id = formData.get("id");
  const name = formData.get("name");

  if (typeof id !== "string" || !id) throw new Error("ID is required");
  if (typeof name !== "string" || !name.trim()) throw new Error("Name is required");
  if (name.length > 255) throw new Error("Name is too long");

  await assertMemberAccess(id, session.user.id);

  const updated = await prisma.knowledgeBase.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true, description: true, createdAt: true },
  });

  revalidatePath("/app");
  return updated;
}

export async function deleteKnowledgeBase(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("ID is required");

  await assertMemberAccess(id, session.user.id);

  await prisma.knowledgeBase.delete({ where: { id } });

  revalidatePath("/app");
}
