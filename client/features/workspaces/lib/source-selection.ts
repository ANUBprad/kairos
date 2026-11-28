/**
 * Grounding-selection helpers for the sources sidebar.
 *
 * The persisted list is only a cache: the authoritative selection is always
 * intersected with the sources that actually exist in the active workspace so
 * deleted sources and workspace switches can never inflate the "N/M active"
 * count or leak into chat/artifact requests.
 */

/** Stable localStorage key for a workspace's grounding selection. */
export function selectedSourcesStorageKey(workspaceId: string): string {
  return `kairos_selected_sources_${workspaceId}`;
}

/** Parses a persisted selection, rejecting malformed values and non-string IDs. */
export function parsePersistedSelection(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

/**
 * Keeps only IDs still present in the workspace, preserving order and removing
 * duplicates. Guarantees the result is a subset of `sourceIds`.
 */
export function pruneSelectedSourceIds(
  selected: readonly string[],
  sourceIds: readonly string[],
): string[] {
  const available = new Set(sourceIds);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of selected) {
    if (available.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Prunes stale IDs and selects only genuinely new sources. Sources the user
 * deliberately deselected stay deselected when the list refreshes.
 */
export function includeNewSourceIds(
  selected: readonly string[],
  sourceIds: readonly string[],
  previouslyKnownIds: readonly string[],
): string[] {
  const known = new Set(previouslyKnownIds);
  const added = sourceIds.filter(
    (id) => !known.has(id) && !selected.includes(id),
  );
  return [...pruneSelectedSourceIds(selected, sourceIds), ...added];
}
