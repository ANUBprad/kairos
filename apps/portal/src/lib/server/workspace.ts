import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getServerSession } from "@/lib/server/auth-utils";
import { createOrganization, getUserOrganizations } from "@/lib/organizations";
import { resolveSelectedOrganization, type OrgRef } from "@/lib/workspace-selection";

// Cookie that records which of the authenticated user's organizations is the
// active workspace. The value is never trusted on its own: every resolution
// re-validates it against the user's memberships, so a stale/forged value
// (including one carried over from a previous session on the same browser)
// silently falls back to the user's own first organization.
export const APP_WORKSPACE_ORG_COOKIE = "kairos_workspace_org";

export interface WorkspaceOrganization {
  id: string;
  name: string;
  slug: string;
  projects: {
    id: string;
    name: string;
    _count: { knowledgeBases: number };
  }[];
}

interface WorkspaceUser {
  name: string | null;
  email: string;
  image: string | null;
  id: string;
}

export interface WorkspaceContext {
  user: WorkspaceUser;
  organizations: OrgRef[];
  selectedOrganization: WorkspaceOrganization | null;
}

export { resolveSelectedOrganization };

function workspaceOrgName(name: string, email: string): string {
  const base = name.trim().split(/\s+/)[0] || email.split("@")[0] || "My";
  return `${base}'s Workspace`;
}

function workspaceOrgSlug(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "workspace";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/**
 * Auto-provisions a personal organization (OWNER membership + Default
 * Project) for a user who has none, using the existing organization creation
 * path. Returns the new org ref, or null if the database is unreachable.
 *
 * ponytail: provisioning is only attempted when the user has zero
 * memberships, so it is idempotent in practice; a rare slug collision during
 * a concurrent double-provision retries with a fresh slug instead of wiring
 * up a bespoke transaction.
 */
export async function provisionUserWorkspace(
  userId: string,
  name: string,
  email: string
): Promise<OrgRef | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const org = await createOrganization(userId, {
        name: workspaceOrgName(name, email),
        slug: workspaceOrgSlug(name || email),
      });
      return { id: org.id, name: org.name, slug: org.slug };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("slug already exists")) continue;
      logger.warn("Workspace provisioning failed", { error: message, userId });
      return null;
    }
  }
  return null;
}

/**
 * Server-side resolution of the user's workspace: their organizations plus
 * the active one. Selection honors the persisted cookie only when the user is
 * still a member of that organization. Provisions a personal organization for
 * a user with no memberships. Never falls back to demo data.
 */
export async function resolveUserWorkspace(
  userId: string,
  user: { name?: string | null; email?: string | null },
  selectedOrganizationId: string | null
): Promise<{ organizations: OrgRef[]; selectedOrganization: WorkspaceOrganization | null } | null> {
  let organizations = (await getUserOrganizations(userId)).map(({ id, name, slug }) => ({
    id,
    name,
    slug,
  }));

  if (organizations.length === 0) {
    const provisioned = await provisionUserWorkspace(userId, user.name ?? "", user.email ?? "");
    if (!provisioned) return null;
    organizations = [provisioned];
  }

  const selected = resolveSelectedOrganization(organizations, selectedOrganizationId);
  if (!selected) return null;

  const selectedOrganization = await prisma.organization.findUnique({
    where: { id: selected.id },
    select: {
      id: true,
      name: true,
      slug: true,
      projects: {
        select: {
          id: true,
          name: true,
          _count: { select: { knowledgeBases: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!selectedOrganization) return null;

  return { organizations, selectedOrganization };
}

/**
 * Resolves the workspace context for the current authenticated session.
 * Returns null when unauthenticated or when the database is unreachable
 * (e.g. during build without a live DB). Safe to call during rendering.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return null;

    const cookieStore = await cookies();
    const selectedOrganizationId = cookieStore.get(APP_WORKSPACE_ORG_COOKIE)?.value ?? null;

    const resolved = await resolveUserWorkspace(session.user.id, session.user, selectedOrganizationId);
    if (!resolved) return null;

    return {
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      },
      organizations: resolved.organizations,
      selectedOrganization: resolved.selectedOrganization,
    };
  } catch (err) {
    if (isDynamicServerError(err)) throw err;
    logger.warn("getWorkspaceContext failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
});

function isDynamicServerError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("couldn't be rendered statically because it used")
  );
}