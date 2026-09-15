import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSourceProvenance } from "@/lib/artifacts/summary-view";

const sourceListSource = () =>
  readFileSync(new URL("../components/app/studio/artifact-source-list.tsx", import.meta.url), "utf8");

const viewerSource = (name: string) =>
  readFileSync(
    new URL(`../components/app/studio/${name}-artifact-viewer.tsx`, import.meta.url),
    "utf8",
  );

const ALL_VIEWERS = ["summary", "report", "takeaways", "quiz", "flashcards", "mindmap", "podcast"] as const;

describe("shared artifact source list component", () => {
  it("resolves the stored sourceIds snapshot through the pure provenance helper", () => {
    const sources = [
      { id: "doc_a", name: "alpha.pdf" },
      { id: "doc_b", name: "beta.pdf" },
    ];
    assert.deepEqual(resolveSourceProvenance(["doc_a", "gone"], sources), [
      { id: "doc_a", name: "alpha.pdf" },
      { id: "gone", name: "gone" },
    ]);
    assert.match(sourceListSource(), /resolveSourceProvenance/);
  });

  it("renders available sources as in-app links scoped to the knowledge base", () => {
    const src = sourceListSource();
    assert.match(src, /`\/app\/knowledge-bases\/\$\{artifact\.knowledgeBaseId\}\/\$\{ref\.id\}`/);
    assert.match(src, /from ["']next\/link["']/);
    assert.match(src, /truncate/);
  });

  it("guards availability against the caller-scoped source list", () => {
    const src = sourceListSource();
    assert.match(src, /new Set\(sources\.map\(\(s\) => s\.id\)\)/);
    assert.match(src, /available\.has\(ref\.id\)/);
    assert.doesNotMatch(src, /availableSourceIds/);
  });

  it("renders deleted or unavailable sources as inert non-link text", () => {
    const src = sourceListSource();
    assert.match(src, /Unavailable source · \{ref\.id\.slice\(0, 8\)\}…/);
    assert.doesNotMatch(src, /Unavailable source[\s\S]*<Link/);
  });

  it("returns null when the artifact carries no sourceIds, leaving legacy blocks blank", () => {
    assert.match(sourceListSource(), /if \(provenance\.length === 0\) return null/);
  });

  it("stays a presentational client component with no server or data access", () => {
    const src = sourceListSource();
    assert.match(src, /"use client"/);
    assert.doesNotMatch(src, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(src, /from ["']@\/lib\/actions\//);
    assert.doesNotMatch(src, /from ["']@\/lib\/artifacts\/persistence["']/);
  });
});

describe("provenance wiring in artifact viewers", () => {
  it("every viewer delegates provenance to the shared component and drops the inline resolver", () => {
    for (const kind of ALL_VIEWERS) {
      const src = viewerSource(kind);
      assert.match(src, /ArtifactSourceList/);
      assert.doesNotMatch(src, /resolveSourceProvenance/);
      assert.match(src, /<ArtifactSourceList artifact=\{artifact\} sources=\{sources\} \/>/);
    }
  });

  it("summary, report and takeaways now render clickable links instead of inert text", () => {
    for (const kind of ["summary", "report", "takeaways"] as const) {
      const src = viewerSource(kind);
      assert.match(src, /ArtifactSourceList/);
      assert.match(src, /<h4[^>]*>\s*Sources\s*<\/h4>/);
    }
  });

  it("quiz guards the block on the stored sourceIds and no longer imports next/link", () => {
    const src = viewerSource("quiz");
    assert.match(src, /artifact\.sourceIds\.length > 0/);
    assert.doesNotMatch(src, /from ["']next\/link["']/);
    assert.doesNotMatch(src, /Revisit the sources[\s\S]*<Link/);
  });

  it("mind map consumes the sources prop it previously discarded and renders a Sources block", () => {
    const src = viewerSource("mindmap");
    assert.doesNotMatch(src, /_sources/);
    assert.match(src, /artifact\.sourceIds\.length > 0/);
    assert.match(src, /Sources/);
  });

  it("flashcards and podcast keep guarded behavior through the shared component", () => {
    for (const kind of ["flashcards", "podcast"] as const) {
      const src = viewerSource(kind);
      assert.match(src, /Revisit the sources behind this/);
      assert.match(src, /ArtifactSourceList/);
      assert.doesNotMatch(src, /availableSourceIds|Unavailable source/);
    }
  });

  it("no viewer builds a direct source link, so deleted docs can never produce dead app routes", () => {
    for (const kind of ALL_VIEWERS) {
      const src = viewerSource(kind);
      assert.doesNotMatch(src, /\/app\/knowledge-bases\/\$\{artifact\.knowledgeBaseId\}\/\$\{ref\.id\}/);
    }
  });
});