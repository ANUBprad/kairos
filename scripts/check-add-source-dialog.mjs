#!/usr/bin/env node
/** Regression guard for the Add Knowledge dialog palette, states and draft safety. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const dialog = read("client/features/sources/components/add-source-dialog.tsx");
const draft = read("client/features/sources/lib/add-source-draft.ts");
const globals = read("client/app/globals.css");

// Restrained selected tab state — no bright primary fill.
assert.match(dialog, /border-brand\/40 bg-brand-soft text-brand/);
assert.doesNotMatch(
  dialog,
  /activeTab === tab\.id[\s\S]{0,140}bg-primary text-primary-foreground/,
);

// Semantic connection state that distinguishes stale rows from never-connected.
assert.match(dialog, /function ConnectionState/);
assert.match(dialog, /border-success\/30 bg-success\/10 text-success/);
assert.match(dialog, /border-warning\/30 bg-warning\/10 text-warning/);
assert.match(dialog, /"Reconnect needed"/);
assert.match(dialog, /"Not connected"/);
assert.match(
  dialog,
  /needsReconnect=\{integrations\?\.googleDrive\?\.needsReconnect\}/,
);
assert.match(dialog, /needsReconnect=\{integrations\?\.github\?\.needsReconnect\}/);

// Callback errors use allowlisted codes, never the raw provider description.
assert.match(dialog, /integrationErrorFromQuery/);
assert.doesNotMatch(dialog, /error_description/);

// Recovery actions remain reachable.
for (const action of ["Retry connection check", "Dismiss", "Clear draft"]) {
  assert.ok(dialog.includes(action), `Missing recovery action: ${action}`);
}

// Closing preserves the draft; a successful import clears it.
assert.match(dialog, /clearAddSourceDraft\(workspaceId\)/);
assert.match(dialog, /const handleClose = \(\) => \{[\s\S]{0,220}onOpenChange\(false\)/);

// Draft persists only non-secret, serializable values in session storage.
assert.match(draft, /sessionStorage/);
assert.match(draft, /50_000/);
const draftFields = draft.match(/export interface AddSourceDraft \{([\s\S]*?)\}/)?.[1] ?? "";
assert.ok(draftFields.length > 0, "AddSourceDraft interface is missing");
assert.doesNotMatch(draftFields, /:\s*File\b|token|secret|cookie|password/i);

// Exact light/dark palette tokens remain intact.
for (const token of [
  "#f5f5f5",
  "#ffffff",
  "#f05a24",
  "#080808",
  "#101010",
  "#171717",
  "#ff6b2c",
]) {
  assert.ok(globals.includes(token), `Missing palette token: ${token}`);
}

console.log(
  "ADD KNOWLEDGE GUARD: PASS (palette + selected state + connection/recovery + draft safety)",
);
