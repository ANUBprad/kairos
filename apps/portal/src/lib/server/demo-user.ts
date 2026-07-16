import { prisma } from "@/lib/prisma";

export const DEMO_USER_ID = "demo-user";
const DEMO_USER_EMAIL = "demo@kairos.dev";
const DEMO_USER_NAME = "Demo User";

let cachedOrgId: string | null = null;
let cachedProjectId: string | null = null;

export interface DemoSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export async function ensureDemoUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      emailVerified: true,
    },
    select: { id: true },
  });

  return user.id;
}

export async function getDemoOrgAndProject(): Promise<{ orgId: string; projectId: string }> {
  if (cachedOrgId && cachedProjectId) return { orgId: cachedOrgId, projectId: cachedProjectId };

  const userId = await ensureDemoUser();

  const existingOrg = await prisma.organization.findFirst({
    where: { members: { some: { userId } } },
    select: { id: true },
  });

  if (existingOrg) {
    const orgWithProjects = await prisma.organization.findUnique({
      where: { id: existingOrg.id },
      select: {
        id: true,
        projects: { select: { id: true }, take: 1 },
      },
    });
    if (orgWithProjects && orgWithProjects.projects.length > 0) {
      cachedOrgId = orgWithProjects.id;
      cachedProjectId = orgWithProjects.projects[0].id;
      return { orgId: orgWithProjects.id, projectId: orgWithProjects.projects[0].id };
    }
  }

  const slug = `demo-org-${Date.now()}`;
  const newOrg = await prisma.organization.create({
    data: {
      name: "Demo Organization",
      slug,
      ownerId: userId,
      members: {
        create: { userId, role: "OWNER" },
      },
      projects: {
        create: { name: "Demo Project", slug: `demo-project-${Date.now()}` },
      },
    },
    select: {
      id: true,
      projects: { select: { id: true }, take: 1 },
    },
  });

  cachedOrgId = newOrg.id;
  cachedProjectId = newOrg.projects[0].id;
  return { orgId: newOrg.id, projectId: newOrg.projects[0].id };
}

export async function getDemoSession(): Promise<DemoSession> {
  await ensureDemoUser();
  return {
    user: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      role: "ADMIN",
    },
  };
}
