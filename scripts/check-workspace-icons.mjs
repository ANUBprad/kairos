#!/usr/bin/env node
/** Regression guard for monochrome workspace icons and saved identifier compatibility. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const picker = read("client/features/workspaces/components/notebook-icon-picker.tsx");

const legacyIdentifiers = [
  "📚",
  "🔬",
  "💻",
  "🧠",
  "📊",
  "⚡",
  "🎨",
  "📝",
  "🌐",
  "🎯",
  "🚀",
  "💡",
  "📌",
  "✨",
  "🔥",
  "🤖",
  "📖",
  "🎓",
  "🧪",
  "🛠️",
];

for (const identifier of legacyIdentifiers) {
  assert.ok(
    picker.includes(`"${identifier}"`),
    `Missing legacy workspace icon identifier: ${identifier}`,
  );
}

assert.match(picker, /strokeWidth=\{1\.75\}/);
assert.match(picker, /border-brand\/40 bg-brand-soft text-brand/);
assert.match(picker, /hover:bg-surface-hover hover:text-foreground/);
assert.match(picker, /isLegacyEmoji/);
assert.match(picker, /\{value\}/);
assert.doesNotMatch(picker, /\{icon\}\s*<\/button>/);

const renderSites = [
  "client/features/dashboard/components/create-workspace-modal.tsx",
  "client/features/dashboard/components/edit-workspace-modal.tsx",
  "client/app/(protected)/workspace/[workspaceId]/settings/page.tsx",
  "client/features/workspaces/components/workspace-header.tsx",
  "client/features/dashboard/components/workspace-card.tsx",
];

for (const file of renderSites) {
  const source = read(file);
  assert.match(source, /WorkspaceIcon|NotebookIconPicker/);
  assert.doesNotMatch(source, /\|\|\s*"📚"/);
}

console.log("WORKSPACE ICON GUARD: PASS (20 identifiers + 5 render sites)");
