import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";

export const ensureDefaultOrg = cache(async () => {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const userId = session.user.id;

  const existing = await prisma.member.findFirst({
    where: { userId },
    select: { organizationId: true },
  });

  let orgId: string;

  if (!existing) {
    const org = await prisma.organization.create({
      data: {
        name: "My Organization",
        slug: `org-${userId.slice(0, 8)}`,
        ownerId: userId,
      },
    });

    await prisma.member.create({
      data: { role: "OWNER", organizationId: org.id, userId },
    });

    await prisma.project.create({
      data: {
        name: "Default Project",
        slug: `default-${org.id.slice(0, 8)}`,
        organizationId: org.id,
      },
    });

    orgId = org.id;
  } else {
    orgId = existing.organizationId;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      projects: {
        include: { _count: { select: { knowledgeBases: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!organization) throw new Error("Organization not found");

  const project = organization.projects[0];

  if (!project) {
    const created = await prisma.project.create({
      data: {
        name: "Default Project",
        slug: `default-${orgId.slice(0, 8)}`,
        organizationId: orgId,
      },
      include: { _count: { select: { knowledgeBases: true } } },
    });

    organization.projects = [created];
    return { organization, project: created };
  }

  return { organization, project };
});
