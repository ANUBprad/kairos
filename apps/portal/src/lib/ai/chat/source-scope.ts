import { isValidEntityId } from "@/lib/validation";

export const MAX_CHAT_SOURCES = 50;

export { isValidEntityId };

// Returns null when the client did not send a source-scope array (means "all
// sources"). Invalid/duplicate entries are safely ignored rather than leaked
// as cross-workspace references.
export function parseSourceIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [
    ...new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((s) => s.trim())
        .filter((s) => isValidEntityId(s)),
    ),
  ];
  return ids.slice(0, MAX_CHAT_SOURCES);
}

export function formatSourceScopeLabel(selectedCount: number): string {
  return selectedCount > 0 ? `Selected sources (${selectedCount})` : "All sources";
}

// Keeps only requested ids that exist in the caller-provided owned set.
// An explicit selection that contains no accessible ids remains an empty
// scope; it must never silently broaden into an all-sources query.
export function filterScopedSourceIds(requested: string[], ownedIds: string[]): string[] {
  const owned = new Set(ownedIds);
  return requested.filter((id) => owned.has(id));
}

export function sourceScopeKey(sourceIds: string[] | null | undefined): string {
  if (sourceIds === null || sourceIds === undefined) return "all";
  return [...sourceIds].sort().join(",");
}