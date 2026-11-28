import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
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
    "<Workflow",
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
  const workflow = source("workflow.tsx");
  const pipeline = source("cinematic-pipeline.tsx");
  const integrations = source("integrations-strip.tsx");
  const grounding = source("grounding-intro.tsx");
  const features = source("feature-rows.tsx");
  const useCases = source("use-cases.tsx");
  const faq = source("faq.tsx");
  const finalCta = source("final-cta.tsx");

  assert.equal((workflow.match(/^\s+id="workflow"/gm) ?? []).length, 1);
  assert.equal((pipeline.match(/^\s+id="pipeline"/gm) ?? []).length, 1);
  assert.doesNotMatch(pipeline, /id="workflow"/);
  assert.match(integrations, /id="sources"/);
  assert.match(grounding, /id="grounding"/);
  assert.match(features, /id="features"/);
  assert.match(useCases, /id="use-cases"/);
  assert.match(faq, /id="faq"/);
  assert.match(finalCta, /id="get-started"/);
  assert.match(features, /id: "source-library"/);
  assert.doesNotMatch(features, /id: "sources"/);

  const anchoredSources = {
    workflow,
    pipeline,
    integrations,
    grounding,
    features,
    useCases,
    faq,
    finalCta,
  };
  const ids = Object.values(anchoredSources).flatMap((text) => [
    ...Array.from(text.matchAll(/(?:^|\s)id="([^"]+)"/g), (match) => match[1]),
    ...Array.from(text.matchAll(/id: "([^"]+)"/g), (match) => match[1]),
  ]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `Landing IDs must be unique; found: ${ids.join(", ")}`,
  );
});

test("hero uses a local cinematic video with a real poster fallback", () => {
  const hero = source("hero.tsx");

  assert.match(hero, /const HERO_VIDEO = "\/landing\/sunrise-beach\.mp4";/);
  assert.match(hero, /const HERO_POSTER = "\/landing\/sunrise-beach-poster\.jpg";/);
  assert.match(hero, /<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline[\s\S]*?preload="metadata"/);
  assert.match(hero, /poster=\{HERO_POSTER\}/);
  assert.match(hero, /<source src=\{HERO_VIDEO\} type="video\/mp4" \/>/);
  assert.match(hero, /data-testid="hero-video"/);
  assert.match(hero, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(hero, /new IntersectionObserver/);
  assert.match(hero, /aria-hidden="true" className="kairos-hero-media"/);
  assert.match(globals, /\.kairos-hero-poster,\s*\.kairos-hero-video \{[\s\S]*?object-fit: cover/);
  assert.doesNotMatch(hero, /The evidence loop|LOOP_STEPS|Free-window credits/);

  for (const asset of [
    "../../public/landing/sunrise-beach.mp4",
    "../../public/landing/sunrise-beach-poster.jpg",
  ]) {
    const path = fileURLToPath(new URL(asset, import.meta.url));
    assert.ok(existsSync(path), `${asset} exists`);
    assert.ok(statSync(path).size > 0, `${asset} is not empty`);
  }
});

test("footer keeps legal and support routes", () => {
  const footer = source("site-footer.tsx");
  assert.match(footer, /href: "\/terms"/);
  assert.match(footer, /href: "\/privacy"/);
  assert.match(footer, /href: "\/support"/);
  assert.match(footer, /href: "\/pricing"/);
});

test("footer uses three valid navigation columns and a decorative atmosphere", () => {
  const footer = source("site-footer.tsx");

  assert.equal((footer.match(/heading: "/g) ?? []).length, 3);
  for (const heading of ["Product", "Resources", "Account"]) {
    assert.match(footer, new RegExp(`heading: "${heading}"`));
  }
  assert.match(footer, /<nav\s+aria-label="Footer"/);
  assert.match(footer, /aria-hidden="true" className="kairos-footer-wordmark"/);
  assert.match(footer, /href="\/signup"/);
  assert.doesNotMatch(footer, /href: "#"/);
  assert.doesNotMatch(footer, /<video\b|<source\b/i);

  assert.match(globals, /\.kairos-footer-atmosphere \{/);
  assert.match(globals, /\.kairos-footer-wordmark \{[\s\S]*?var\(--primary\)/);
  assert.match(globals, /\.dark \.kairos-footer \{/);
  assert.match(globals, /\.kairos-footer-content \{[\s\S]*?clamp\(/);
  assert.match(globals, /\.kairos-footer-wordmark \{[\s\S]*?bottom: 1\.5rem;/);
  assert.match(globals, /\.kairos-footer-wordmark \{[\s\S]*?font-size: clamp\(/);
  assert.match(globals, /\.kairos-footer-wordmark \{[\s\S]*?line-height: 1;/);
  assert.match(globals, /\.kairos-footer-wordmark \{[\s\S]*?max-width:/);

  const wordmarkBlock =
    globals.match(/\.kairos-footer-wordmark \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(wordmarkBlock, /color: color-mix\(/);
  assert.doesNotMatch(
    wordmarkBlock,
    /background-clip|-webkit-text-fill-color|linear-gradient/,
  );
});

test("integration carousel uses verified brands and supports real interaction", () => {
  const integrations = source("integrations-strip.tsx");
  const carousel = source("integrations-carousel.tsx");

  assert.match(integrations, /<IntegrationsCarousel \/>/);
  assert.doesNotMatch(
    integrations,
    /Files and links|Connected accounts|Source types|Processing services/,
  );

  for (const logo of [
    "/integrations/google-drive-logo.png",
    "/integrations/notion-logo.webp",
    "/integrations/notion-logo-white.webp",
    "/integrations/github.svg",
    "/integrations/youtube.svg",
    "/integrations/firecrawl.png",
    "/integrations/tavily.svg",
    "/integrations/pinecone.png",
    "/integrations/elevenlabs.svg",
    "/integrations/mem0.svg",
  ]) {
    assert.ok(carousel.includes(logo), `${logo} is used by the carousel`);
  }

  assert.doesNotMatch(carousel, /category:/);
  assert.doesNotMatch(carousel, /kairos-carousel-category/);
  assert.match(carousel, /logoWidth: 48/);
  assert.doesNotMatch(carousel, /scale\(/);

  assert.match(carousel, /"use client"/);
  assert.match(carousel, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.doesNotMatch(carousel, /from "lucide-react"/);
  assert.match(carousel, /setPointerCapture\(event\.pointerId\)/);
  assert.match(carousel, /releasePointerCapture\(event\.pointerId\)/);
  assert.match(carousel, /tabIndex=\{0\}/);
  assert.match(carousel, /onKeyDown=\{\(event\) =>/);
  assert.match(carousel, /event\.key === "ArrowLeft"/);
  assert.match(carousel, /event\.key === "ArrowRight"/);
  assert.match(carousel, /PAUSED_SPEED = 0/);
  assert.match(carousel, /aria-label="Previous source or service"/);
  assert.match(carousel, /aria-label="Next source or service"/);
  assert.match(carousel, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(carousel, /new IntersectionObserver/);
  assert.match(carousel, /new ResizeObserver/);
});

test("workflow is a deterministic six-stage scroll narrative", () => {
  const workflow = source("workflow.tsx");
  const pipeline = source("cinematic-pipeline.tsx");

  for (const title of [
    "Add sources",
    "Process and index",
    "Ask a question",
    "Retrieve evidence",
    "Grounded answer",
    "Turn research into outputs",
  ]) {
    assert.match(workflow, new RegExp(`title: "${title}"`));
  }

  assert.match(workflow, /"use client"/);
  assert.match(workflow, /const STAGES: WorkflowStage\[\]/);
  assert.match(workflow, /id="workflow"/);
  assert.match(workflow, /data-active-stage=\{activeStage\}/);
  assert.match(workflow, /data-state=\{stateFor\(index, activeStage\)\}/);
  assert.match(workflow, /data-testid="workflow-demo"/);
  assert.match(workflow, /setProperty\("--workflow-progress"/);
  assert.match(workflow, /new IntersectionObserver/);
  assert.match(workflow, /requestAnimationFrame\(update\)/);
  assert.match(workflow, /no live data or backend jobs are run here/);
  assert.doesNotMatch(workflow, /\bfetch\(|axios|\/api\/|useMutation/);

  assert.doesNotMatch(pipeline, /const STAGES|Illustrative visualization/);
  assert.match(globals, /\.kairos-workflow-scroll \{[\s\S]*?height: 520vh/);
  assert.match(globals, /\.kairos-workflow-sticky \{[\s\S]*?position: sticky/);
  assert.match(
    globals,
    /prefers-reduced-motion: reduce[\s\S]*?\.kairos-workflow-panel/,
  );
});

test("scroll reveals are one-shot and disabled under reduced motion", () => {
  const motion = source("scroll-motion.tsx");
  assert.match(motion, /"use client"/);
  assert.match(motion, /data-visible="true"/);
  assert.match(motion, /dataset\.visible = "false"/);
  assert.match(motion, /observer\?\.disconnect\(\)/);
  assert.match(motion, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(globals, /\.kairos-reveal\[data-visible="false"\]/);
  assert.match(
    globals,
    /prefers-reduced-motion: reduce[\s\S]*?\.kairos-reveal[\s\S]*?opacity: 1 !important/,
  );
  assert.match(
    globals,
    /prefers-reduced-motion: reduce[\s\S]*?\.kairos-carousel-card/,
  );
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
    "workflow.tsx",
    "cinematic-pipeline.tsx",
    "integrations-strip.tsx",
    "integrations-carousel.tsx",
    "scroll-motion.tsx",
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
