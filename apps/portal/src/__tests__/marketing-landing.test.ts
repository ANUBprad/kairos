import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const landing = source("../app/(marketing)/page.tsx");
const layout = source("../app/(marketing)/layout.tsx");
const hero = source("../components/marketing/sections/hero-section.tsx");
const workflow = source("../components/marketing/sections/workflow-section.tsx");
const artifacts = source("../components/marketing/sections/artifacts-section.tsx");
const cta = source("../components/marketing/sections/final-cta-section.tsx");

describe("marketing landing page", () => {
  it("composes the editorial landing sections", () => {
    for (const section of [
      "Hero",
      "WorkflowSection",
      "ArtifactsSection",
      "FinalCTASection",
    ]) {
      assert.match(landing, new RegExp(section));
    }
  });

  it("drops the scroll-driven chrome for a calm, reduced-motion page", () => {
    assert.doesNotMatch(landing, /ScrollProgress/);
    assert.doesNotMatch(landing, /SectionNav/);
    assert.doesNotMatch(layout, /SmoothScrollProvider/);
  });

  it("keeps the primary call to action pointed at the app", () => {
    assert.match(hero, /href="\/app"/);
    assert.match(cta, /href="\/app"/);
  });

  it("presents the four-step research journey", () => {
    for (const step of [
      "Bring your sources",
      "Understand them",
      "Create from them",
      "Learn from them",
    ]) {
      assert.match(workflow, new RegExp(step));
    }
  });

  it("keeps artifacts grounded in the shared studio artifact catalog", () => {
    assert.match(artifacts, /ACTIVE_STUDIO_ARTIFACT_TYPES/);
    assert.match(artifacts, /ARTIFACT_TYPE_META/);
  });
});
