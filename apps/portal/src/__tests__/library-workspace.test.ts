import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const library = source("../components/app/knowledge-base-list.tsx");
const tabs = source("../components/app/kb-workspace-tabs.tsx");
const surfaces = {
  "chat-interface": source("../components/app/chat-interface.tsx"),
  "study-dashboard": source("../components/app/study/study-dashboard.tsx"),
  "artifact-studio": source("../components/app/studio/artifact-studio.tsx"),
  "document-table": source("../components/app/document-table.tsx"),
};

describe("library and workspace experience", () => {
  it("renders an editorial hairline list instead of a card grid", () => {
    assert.match(library, /divide-y divide-border/);
    assert.doesNotMatch(library, /grid gap-4 sm:grid-cols-2 lg:grid-cols-3/);
  });

  it("keeps workspace rows linked and the create/rename/delete wiring intact", () => {
    assert.match(library, /href=\{`\/app\/knowledge-bases\/\$\{kb\.id\}`\}/);
    for (const dialog of [
      "CreateKnowledgeBaseDialog",
      "RenameKnowledgeBaseDialog",
      "DeleteKnowledgeBaseDialog",
    ]) {
      assert.match(library, new RegExp(dialog));
    }
  });

  it("shares one workspace header across the KB surfaces", () => {
    assert.match(tabs, /export function WorkspaceHeader\(/);
    assert.match(tabs, /<KbWorkspaceTabs kbId=\{kbId\}/);
    for (const [name, src] of Object.entries(surfaces)) {
      assert.match(src, /WorkspaceHeader/, `${name} should use the shared header`);
    }
  });

  it("does not bless a route that does not exist from the workspace tab bar", () => {
    assert.match(tabs, /`\/app\/knowledge-bases\/\$\{kbId\}`/);
    assert.match(tabs, /`\/app\/knowledge-bases\/\$\{kbId\}\/chat`/);
    assert.match(tabs, /`\/app\/knowledge-bases\/\$\{kbId\}\/studio`/);
    assert.match(tabs, /`\/app\/knowledge-bases\/\$\{kbId\}\/study`/);
  });
});
