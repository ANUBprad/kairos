export interface OrgRef {
  id: string;
  name: string;
  slug: string;
}

/**
 * Pure selection resolver: honors a previously selected org only when the
 * user still belongs to it, otherwise the user's first organization.
 * Null when the user has no organizations at all. This is the tenant-boundary
 * predicate for the workspace context — it must never resolve to an org the
 * user cannot access (a stale or forged selection silently falls back).
 */
export function resolveSelectedOrganization(
  organizations: OrgRef[],
  selectedOrganizationId: string | null | undefined
): OrgRef | null {
  if (organizations.length === 0) return null;
  return organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0];
}