import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";

/**
 * Returns the existing organization and its first project for the current
 * user. This is a **read-only** operation — it never creates database
 * records. Returns null if no organization/project exists or if the
 * database is unreachable (e.g. during build without a live DB).
 */
export const ensureDefaultOrg = cache(async () => {
  try {
    const session = await getServerSession();
    if (!session || !session.user.id) return null;

    const userId = session.user.id;

    const member = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });

    if (!member) return null;

    const organization = await prisma.organization.findUnique({
      where: { id: member.organizationId },
      include: {
        projects: {
          include: { _count: { select: { knowledgeBases: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!organization) return null;

    const project = organization.projects[0];

    if (!project) return null;

    return { organization, project };
  } catch {
    return null;
  }
});
