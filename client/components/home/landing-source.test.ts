import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function source(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");
}

const page = readFileSync(
  fileURLToPath(new URL("../../app/page.tsx", import.meta.url)),
  "utf8",
);
const globals = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

test("landing sections render in one continuous narrative order", () => {
  const sectionTags = [
    "<Hero",
    "<CinematicPipeline",
    "<IntegrationsStrip",
    "<GroundingIntro",
    "<FeatureRows",
    "<UseCases",
    "<Faq",
    "<FinalCta",
  ];
  const positions = sectionTags.map((tag) => page.indexOf(tag));

  positions.forEach((position, index) => {
    assert.ok(position >= 0, `${sectionTags[index]} is rendered on the landing page`);
    if (index > 0) {
      assert.ok(position > positions[index - 1], `${sectionTags[index]} follows ${sectionTags[index - 1]}`);
    }
  });
});

test("landing anchors are defined exactly once", () => {
  const pipeline = source("cinematic-pipeline.tsx");
  const integrations = source("integrations-strip.tsx");
  const grounding = source("grounding-intro.tsx");
  const features = source("feature-rows.tsx");
  const useCases = source("use-cases.tsx");
  const faq = source("faq.tsx");
  const finalCta = source("final-cta.tsx");

  assert.equal((pipeline.match(/id="workflow"/g) ?? []).length, 1);
  assert.match(integrations, /id="sources"/);
  assert.match(grounding, /id="grounding"/);
  assert.match(features, /id="features"/);
  assert.match(useCases, /id="use-cases"/);
  assert.match(faq, /id="faq"/);
  assert.match(finalCta, /id="get-started"/);
  assert.match(features, /id: "source-library"/);
  assert.doesNotMatch(features, /id: "sources"/);

  const anchoredSources = {
    pipeline,
    integrations,
    grounding,
    features,
    useCases,
    faq,
    finalCta,
  };
  const ids = Object.values(anchoredSources).flatMap((text) => [
    ...Array.from(text.matchAll(/id="([^"]+)"/g), (match) => match[1]),
    ...Array.from(text.matchAll(/id: "([^"]+)"/g), (match) => match[1]),
  ]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `Landing IDs must be unique; found: ${ids.join(", ")}`,
  );
});

test("footer keeps legal and support routes", () => {
  const footer = source("site-footer.tsx");
  assert.match(footer, /href: "\/terms"/);
  assert.match(footer, /href: "\/privacy"/);
  assert.match(footer, /href: "\/support"/);
  assert.match(footer, /href: "\/pricing"/);
});

test("landing surfaces and effects use shared design tokens", () => {
  for (const token of [
    "--navy:",
    "--navy-card:",
    "--editorial-bg:",
    "--editorial-ink:",
    "--editorial-border:",
    "--editorial-surface:",
    "--pipeline-bg:",
    "--pipeline-line:",
    "--processing:",
    "--processing-deep:",
    "--processing-rgb:",
    "--processing-deep-rgb:",
    "--spark-rgb:",
    "--pipeline-shadow-card:",
    "--pipeline-shadow-badge:",
    ".kairos-final-glow",
  ]) {
    assert.ok(globals.includes(token), `${token} is defined in globals.css`);
  }
});

test("rendered landing surfaces avoid hardcoded legacy brand and fixed theme colors", () => {
  const renderedSurfaces = [
    "site-nav.tsx",
    "hero.tsx",
    "cinematic-pipeline.tsx",
    "integrations-strip.tsx",
    "grounding-intro.tsx",
    "feature-rows.tsx",
    "use-cases.tsx",
    "faq.tsx",
    "final-cta.tsx",
    "site-footer.tsx",
  ];

  for (const file of renderedSurfaces) {
    const text = source(file);
    assert.doesNotMatch(
      text,
      /\b(?:bg|text|border|divide|from|via|to)-(?:white|navy|brand-accent)\b/,
      `${file} uses theme-aware utilities`,
    );
    assert.doesNotMatch(
      text,
      /#(?:f6f7f4|0a0f14|155e56|c8f169|071225|103b36|e7f0ed|e8663a)\b/i,
      `${file} avoids legacy brand literals`,
    );
  }
});
