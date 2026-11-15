import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const page = source("../app/app/page.tsx");
const view = source("../components/app/home/home-view.tsx");
const sidebar = source("../components/app/sidebar.tsx");
const palette = source("../components/ui/command-palette.tsx");
const layout = source("../app/app/layout.tsx");
const sourceDialog = source("../components/app/source-add-dialog.tsx");

describe("home dashboard", () => {
  it("scopes every recent-activity read to the caller's project and user", () => {
    assert.match(page, /listKnowledgeBases\(\)/);
    assert.match(page, /userId:\s*session\.user\.id,\s*knowledgeBase:\s*\{\s*projectId\s*\}/);
    assert.match(page, /knowledgeBase:\s*\{\s*projectId\s*\}/);
    assert.match(page, /getStudyCountsForProject\(session\.user\.id,\s*projectId\)/);
  });

  it("reads genuine source status instead of assuming sources are ready", () => {
    assert.match(page, /status:\s*true/);
    assert.match(view, /ProcessingBadge/);
    assert.match(view, /status=\{source\.status\}/);
  });

  it("keeps artifact links blocked behind a completed status", () => {
    assert.match(view, /artifact\.status === "COMPLETED"/);
    assert.match(view, /ArtifactStatusBadge/);
  });

  it("surfaces a graceful error state for partial or failed loads", () => {
    assert.match(page, /loadError/);
    assert.match(view, /couldn&apos;t be loaded/);
  });

  it("ships an intentional first-run onboarding state", () => {
    assert.match(view, /hasWorkspaces/);
    assert.match(view, /Set up your first workspace/);
  });

  it("points every call to action at a real destination", () => {
    for (const href of ["/app/research", "/app/knowledge-bases", "/app/study"]) {
      assert.ok(view.includes(`href="${href}"`), `missing ${href}`);
    }
    assert.match(view, /kbWorkspaceHref\(/);
  });

  it("does not repeat navigation destinations as sidebar quick actions", () => {
    assert.doesNotMatch(sidebar, /Quick Actions|Open Studio|New workspace/);
    assert.match(sidebar, /organizations\.length > 1/);
    assert.match(sidebar, /activeHref/);
  });

  it("keeps the command palette focused on navigation, not fake actions", () => {
    assert.doesNotMatch(palette, /ACTION_COMMANDS|Upload Document|Create Workspace|Open Chat|Run Evaluation/);
    assert.match(palette, /cmd\.category === "Workspace"/);
    assert.match(palette, /Search pages/);
  });

  it("removes hidden shortcuts that duplicated navigation with misleading targets", () => {
    assert.doesNotMatch(layout, /KeyboardShortcuts/);
    assert.match(layout, /CommandPalette/);
  });

  it("explains that YouTube ingestion requires accessible captions", () => {
    assert.match(sourceDialog, /imports the video&apos;s available captions/);
    assert.match(sourceDialog, /without accessible captions cannot be indexed/);
  });

  it("does not resurrect the removed stat-card dashboard", () => {
    assert.doesNotMatch(page, /DashboardClient|StatCard|DashboardCard/);
  });
});
