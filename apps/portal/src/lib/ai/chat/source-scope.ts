export const MAX_CHAT_SOURCES = 50;

const ID_MAX_LENGTH = 128;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

// Entity ids use Prisma cuid() (also tolerate uuid) — never charset-guess
// beyond a safe slug-like shape. Server-side ownership checks are what
// actually secure the query, not this shape test.
export function isValidEntityId(id: string): boolean {
  return id.length > 0 && id.length <= ID_MAX_LENGTH && ID_PATTERN.test(id);
}

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

export function sourceScopeKey(sourceIds: string[] | null | undefined): string {
  if (!sourceIds || sourceIds.length === 0) return "all";
  return [...sourceIds].sort().join(",");
}