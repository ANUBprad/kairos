#!/usr/bin/env node
/** Regression guard for source sidebar readability, statuses and selection. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const panel = read("client/features/sources/components/sources-panel.tsx");
const item = read("client/features/sources/components/source-item.tsx");
const badge = read("client/features/sources/components/source-status-badge.tsx");
const typeIcon = read("client/features/sources/components/source-type-icon.tsx");
const layout = read(
  "client/features/workspaces/components/workspace-layout.tsx",
);
const selection = read("client/features/workspaces/lib/source-selection.ts");

// Readable titles with a full-title tooltip; source type and status are shown.
assert.match(item, /title=\{source\.title\}/);
assert.match(item, /line-clamp-2/);
assert.match(item, /text-\[13px\]/);
assert.match(item, /SOURCE_TYPE_LABELS\[source\.type\]/);
assert.match(item, /<SourceStatusBadge/);
assert.match(item, /onPreview/);
assert.match(item, /onDelete\(source\.id\)/);
assert.match(item, /Retry processing \$\{source\.title\}/);

// Semantic status colors rather than neutral gray for every state.
assert.match(badge, /READY: "border-success\/30 bg-success\/10 text-success"/);
assert.match(
  badge,
  /PROCESSING: "border-warning\/30 bg-warning\/10 text-warning"/,
);
assert.match(badge, /FAILED: "border-danger\/30 bg-danger\/10 text-danger"/);

// Type icons are decorative; the visible type label carries the meaning.
assert.match(typeIcon, /aria-hidden="true"/);

// Search covers titles and types; selection controls operate on visible rows.
assert.match(panel, /SOURCE_TYPE_LABELS\[s\.type\]/);
assert.match(panel, /allVisibleSelected/);
assert.match(panel, /onDeselectAll\(visibleIds\)/);
assert.match(panel, /onSelectAll\(visibleIds\)/);
assert.match(panel, /\{selectedSourceIds\.length\}\/\{sources\.length\} active/);

// Workspace layout never counts or sends stale IDs.
assert.match(layout, /pruneSelectedSourceIds/);
assert.match(layout, /effectiveSelectedIds/);
assert.match(layout, /selectedSourceIds=\{effectiveSelectedIds\}/);
assert.match(layout, /selectedSourcesCount=\{effectiveSelectedIds\.length\}/);
assert.match(layout, /sourceIds: effectiveSelectedIds/);
assert.doesNotMatch(layout, /selectedSourcesCount=\{selectedSourceIds\.length\}/);

// Persisted selection is a cache that is pruned and workspace-scoped.
assert.match(selection, /kairos_selected_sources_\$\{workspaceId\}/);
assert.match(selection, /parsePersistedSelection/);
assert.match(selection, /pruneSelectedSourceIds/);

console.log(
  "SOURCE SIDEBAR GUARD: PASS (titles + statuses + actions + selection)",
);
