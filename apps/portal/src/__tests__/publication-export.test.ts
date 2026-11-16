import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterMarkdownSections,
  publicationExport,
  toLatexDocument,
  toStandaloneHtml,
} from "@/lib/publication-export";

const SECTIONS = [
  { id: "abstract", label: "Abstract", required: true },
  { id: "results", label: "Results", required: true },
  { id: "stats", label: "Statistical Analysis", required: false },
];

const DOC = `# Title

## Abstract

text

## Results

| a | b |

## Statistical Analysis

claims
`;

const component = readFileSync(
  new URL("../app/app/publication/publication-client.tsx", import.meta.url),
  "utf8",
);

describe("publication export", () => {
  it("drops a disabled optional section and keeps required ones", () => {
    const out = filterMarkdownSections(DOC, { stats: false }, SECTIONS);
    assert.match(out, /## Abstract/);
    assert.match(out, /## Results/);
    assert.doesNotMatch(out, /Statistical Analysis/);
    assert.doesNotMatch(out, /claims/);
  });

  it("keeps a required section even when its toggle is false", () => {
    const out = filterMarkdownSections(DOC, { abstract: false }, SECTIONS);
    assert.match(out, /## Abstract/);
  });

  it("keeps subsections attached to their parent section", () => {
    const out = filterMarkdownSections(
      "# T\n\n## Results\n\n### Key Findings\n\nx\n\n## Statistical Analysis\n\ny\n",
      { stats: false },
      SECTIONS,
    );
    assert.match(out, /### Key Findings/);
    assert.doesNotMatch(out, /Statistical Analysis/);
  });

  it("emits a complete HTML document with escaped user content", () => {
    const html = toStandaloneHtml("# T\n\n<script>alert(1)</script>");
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<\/html>/);
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.match(html, /&lt;script&gt;/);
  });

  it("emits a complete LaTeX document that cannot be terminated early", () => {
    const tex = toLatexDocument("# T\n\n\\end{verbatim}\n");
    assert.match(tex, /^\\documentclass/);
    assert.match(tex, /\\end\{document\}/);
    assert.equal((tex.match(/\\end\{verbatim\}/g) ?? []).length, 1);
  });

  it("maps each download format to its real mime type and extension", () => {
    assert.equal(publicationExport("markdown", "# x").filename, "kairos-paper.md");
    assert.match(publicationExport("markdown", "# x").mime, /text\/markdown/);
    assert.equal(publicationExport("html", "# x").filename, "kairos-paper.html");
    assert.match(publicationExport("html", "# x").mime, /text\/html/);
    assert.equal(publicationExport("latex", "# x").filename, "kairos-paper.tex");
    assert.match(publicationExport("latex", "# x").mime, /x-tex/);
  });

  it("uses the filtered text everywhere and prints a real PDF", () => {
    assert.match(component, /filterMarkdownSections\(paperContent/);
    assert.match(component, /ReactMarkdown>\{visiblePaper\}/);
    assert.match(component, /printWindow\.print\(\)/);
    assert.doesNotMatch(component, /format === "pdf" \? "pdf"/);
    assert.doesNotMatch(component, /random_seed/);
  });
});
