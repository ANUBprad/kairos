import { cache } from "react";
import { getWorkspaceContext } from "@/lib/server/workspace";
import { logger } from "@/lib/logger";

/**
 * Returns the active workspace organization and its first project for the
 * current user. This is a **read-only** resolution — it never creates
 * knowledge-base records (the workspace context may provision a personal
 * organization for a user who has none). Honors the user's selected
 * workspace organization. Returns null if no organization/project exists or
 * if the database is unreachable (e.g. during build without a live DB).
 */
export const ensureDefaultOrg = cache(async () => {
  try {
    const context = await getWorkspaceContext();
    if (!context?.selectedOrganization) return null;

    const project = context.selectedOrganization.projects[0];
    if (!project) return null;

    return { organization: context.selectedOrganization, project };
  } catch (err) {
    logger.warn("ensureDefaultOrg failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
});
