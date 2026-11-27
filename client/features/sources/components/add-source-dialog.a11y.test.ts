import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "add-source-dialog.tsx"),
  "utf8",
);

describe("add source dialog accessibility", () => {
  it("exposes dialog semantics with a labelled title", () => {
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby="add-source-dialog-title"/);
    assert.match(source, /id="add-source-dialog-title"/);
  });

  it("groups the source type buttons", () => {
    assert.match(source, /role="group" aria-label="Source type"/);
  });

  it("associates every visible field with a label", () => {
    for (const id of [
      "pdf-title",
      "image-title",
      "website-url",
      "website-title",
      "youtube-url",
      "youtube-title",
      "text-title",
      "text-content",
      "github-url-public",
      "github-title-public",
      "github-url-manual",
      "github-title-manual",
      "github-repo-title",
    ]) {
      assert.match(source, new RegExp(`htmlFor="${id}"`));
      assert.match(source, new RegExp(`id="${id}"`));
    }
    assert.match(source, /aria-label="Notion internal integration token"/);
    assert.match(source, /aria-label="Search Google Drive files"/);
    assert.match(source, /aria-label="Search Notion pages"/);
    assert.match(source, /aria-label="Search GitHub repositories"/);
  });

  it("uses keyboard-operable file pickers and page selection", () => {
    assert.match(
      source,
      /type="button"\s+onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}/,
    );
    assert.match(
      source,
      /type="button"\s+onClick=\{\(\) => imageInputRef\.current\?\.click\(\)\}/,
    );
    assert.match(source, /role="listbox"\s+aria-label="Notion pages"/);
    assert.match(source, /role="option"\s+aria-selected=\{isSelected\}/);
  });

  it("gates integration tabs on connection status and exposes retry", () => {
    assert.equal((source.match(/<IntegrationStatusGate/g) ?? []).length, 3);
    assert.match(source, /isError: isNotionPagesError/);
    assert.match(
      source,
      /role="alert"[\s\S]{0,400}Couldn&apos;t load Notion pages/,
    );
    assert.match(source, /onClick=\{\(\) => void refetchNotionPages\(\)\}/);
  });
});
