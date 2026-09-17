"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { ensureDefaultOrg } from "@/lib/server/organization";
import { revalidatePath } from "next/cache";
import { serverTrackEvent } from "@/lib/telemetry/analytics-server";
import { getMembershipForResource, isRoleSufficient } from "@/lib/rbac";

// The caller's identity is the authorization gate, not the KB's existence:
// a foreign KB resolves to the same "not found" as a missing one, so probing
// other organizations' knowledge bases cannot succeed or leak existence.
// Rename/delete are organization-admin mutations: only OWNER or ADMIN members
// may perform them.
async function assertCanMutateKnowledgeBase(kbId: string, userId: string) {
  const membership = await getMembershipForResource(userId, "knowledge_base", kbId);
  if (!membership) throw new Error("Knowledge base not found");
  if (!isRoleSufficient(membership.role, "ADMIN")) {
    throw new Error("You don't have permission to modify this knowledge base");
  }
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

  const orgResult = await ensureDefaultOrg();
  if (!orgResult) throw new Error("No workspace available. Please try again.");
  const { project } = orgResult;

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

  const orgResult = await ensureDefaultOrg();
  if (!orgResult) return [];
  const { project } = orgResult;

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

  await assertCanMutateKnowledgeBase(id, session.user.id);

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

  await assertCanMutateKnowledgeBase(id, session.user.id);

  await prisma.knowledgeBase.delete({ where: { id } });

  revalidatePath("/app");
}
