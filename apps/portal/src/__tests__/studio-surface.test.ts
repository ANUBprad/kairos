import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studioSource = readFileSync(
  new URL("../components/app/studio/artifact-studio.tsx", import.meta.url),
  "utf8",
);
const detailClientSource = readFileSync(
  new URL("../components/app/studio/artifact-detail-client.tsx", import.meta.url),
  "utf8",
);
const studioLoadingSource = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/studio/loading.tsx", import.meta.url),
  "utf8",
);
const detailLoadingSource = readFileSync(
  new URL("../app/app/knowledge-bases/[kbId]/artifacts/[artifactId]/loading.tsx", import.meta.url),
  "utf8",
);

describe("studio generator surface", () => {
  it("heads the generator with the shared editorial section title", () => {
    assert.match(
      studioSource,
      /<h2 className="section-title">Generate an artifact<\/h2>/,
    );
  });

  it("wraps the artifact-type selector so all seven types fit narrow viewports", () => {
    assert.match(
      studioSource,
      /mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1/,
    );
  });

  it("bounds the source picker so a large workspace stays a single page", () => {
    assert.match(
      studioSource,
      /<ul className="mt-4 max-h-80 space-y-1 overflow-y-auto overscroll-contain pr-1">/,
    );
  });
});

describe("studio loading skeletons", () => {
  it("shapes the studio loader into the header, generator, and artifacts sections", () => {
    assert.match(studioLoadingSource, /animate-pulse/);
    assert.match(studioLoadingSource, /h-7 w-40 rounded bg-surface/);
    assert.match(studioLoadingSource, /rounded-xl border border-border bg-surface p-5/);
    assert.match(studioLoadingSource, /border-b border-border px-5 py-4/);
  });

  it("keeps a visible spinner under the artifact-detail header skeleton", () => {
    assert.match(detailLoadingSource, /Loader2/);
    assert.match(detailLoadingSource, /animate-pulse mb-6 space-y-3/);
    assert.match(detailLoadingSource, /h-7 w-72 rounded-lg bg-surface/);
  });
});

describe("artifact detail header", () => {
  it("leads with the workspace name, then the artifact title and provenance meta", () => {
    assert.match(detailClientSource, /<p className="text-xs font-medium text-brand">\{kbName\}<\/p>/);
    assert.match(detailClientSource, /page-description mt-1/);
  });

  it("keeps the chat return deep-link intact through the header polish", () => {
    assert.match(detailClientSource, /returnConversationId/);
    assert.match(detailClientSource, /\?conversation=\$\{returnConversationId\}/);
    assert.doesNotMatch(detailClientSource, /prisma/i);
  });
});