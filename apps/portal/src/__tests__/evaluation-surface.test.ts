import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Evaluation surface contract. The evaluation charts and dashboard previously
// referenced shadcn tokens (hsl(var(--primary)), fill-primary, bg-card, …) that
// are not defined by the Quiet Intelligence theme, so SVG strokes/fills resolved
// to none and the radar/bar output rendered broken. These are source-level
// guards: the surface must reference the real theme tokens only.

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const charts = source("../lib/evaluation/visualization/charts.tsx");
const evaluationClient = source("../app/app/evaluation/evaluation-client.tsx");
const evaluationPage = source("../app/app/evaluation/page.tsx");
const qualityGates = source("../app/app/quality-gates/quality-gates-client.tsx");
const reviews = source("../app/app/reviews/reviews-client.tsx");

describe("evaluation surface — theme tokens", () => {
  it("uses real theme tokens for chart paint instead of undefined shadcn vars", () => {
    assert.doesNotMatch(charts, /hsl\(var\(--/);
    assert.doesNotMatch(charts, /fill-primary|fill-foreground/);
    assert.doesNotMatch(charts, /bg-card|text-muted-foreground/);
    assert.match(charts, /stroke-border/);
    assert.match(charts, /fill-brand/);
    assert.match(charts, /bg-surface/);
  });

  it("uses the brand ring and error token for the evaluation client", () => {
    assert.doesNotMatch(evaluationClient, /ring-primary|border-input|bg-destructive/);
    assert.doesNotMatch(evaluationClient, /font-medium text-foreground/);
    assert.doesNotMatch(evaluationClient, /hsl\(var\(--/);
    assert.match(evaluationClient, /ring-brand/);
    assert.match(evaluationClient, /text-error/);
  });
});

describe("evaluation surface — benchmark run status", () => {
  it("distinguishes running, completed and failed instead of a two-state toggle", () => {
    assert.match(evaluationClient, /function runStatusMeta\(/);
    assert.match(evaluationClient, /case "running":/);
    assert.match(evaluationClient, /case "completed":/);
    assert.match(evaluationClient, /case "failed":/);
  });
});

describe("evaluation surface — heading hierarchy", () => {
  it("lets the client PageHeader own the single page title", () => {
    assert.doesNotMatch(evaluationPage, /<h1/);
    assert.match(evaluationPage, /<EvaluationDashboard/);
  });
});

describe("evaluation surface — status semantics", () => {
  it("marks a failed quality gate as destructive, not informational", () => {
    assert.match(qualityGates, /variant="destructive">Failed<\/Badge>/);
  });

  it("marks a rejected review as a terminal destructive state", () => {
    assert.match(reviews, /REJECTED: \{ label: "Rejected", badge: "destructive"/);
  });
});
