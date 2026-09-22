// Analytics honesty contract: production analytics surfaces must never render
// fabricated data. The dashboard and model comparison pages may only consume
// real server actions (trace/cost/drift) and must surface explicit
// unavailable/not-yet-collected states for metrics with no backend data. This
// test fails when mock generators, Math.random series, hardcoded totals, or
// fake loading delays are reintroduced.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");
const DASHBOARD = readFileSync(join(SRC, "components/evaluation/analytics-dashboard.tsx"), "utf8");
const MODEL_COMPARISON = readFileSync(join(SRC, "components/evaluation/model-comparison.tsx"), "utf8");

const FABRICATION_PATTERNS = [
  "Math.random",
  "generateTrendData",
  "generateMockResult",
  "randomInRange",
  "MOCK_PROMPT_IMPROVEMENTS",
  "MOCK_REGRESSIONS",
  "MOCK_TOKEN_USAGE",
  "MOCK_PROVIDER_CALLS",
  "totalEvaluations",
  "activeReviews",
  "12847",
];

describe("analytics honesty contract", () => {
  for (const file of ["analytics-dashboard.tsx", "model-comparison.tsx"]) {
    it(`renders no fabricated data in ${file}`, () => {
      const source = file === "analytics-dashboard.tsx" ? DASHBOARD : MODEL_COMPARISON;
      for (const pattern of FABRICATION_PATTERNS) {
        assert.ok(
          !source.includes(pattern),
          `${file} must not contain fabricated data source "${pattern}"`,
        );
      }
      assert.ok(
        !/setTimeout\s*\(/.test(source),
        `${file} must not fake work with a setTimeout loading delay`,
      );
    });
  }

  it("analytics dashboard consumes only real server actions", () => {
    assert.match(DASHBOARD, /import \{ traceStats \} from "@\/lib\/actions\/observability"/);
    assert.match(DASHBOARD, /import \{ costSummary \} from "@\/lib\/actions\/cost"/);
    assert.match(DASHBOARD, /import \{ driftStats, listDriftAlerts \} from "@\/lib\/actions\/drift"/);
  });

  it("analytics dashboard surfaces explicit unavailable states", () => {
    assert.match(DASHBOARD, /Not yet collected/);
    assert.match(DASHBOARD, /not recorded for this workspace/);
    assert.match(
      DASHBOARD,
      /No traces recorded yet|No provider usage yet|No drift alerts detected/,
    );
  });

  it("model comparison consumes only real server actions", () => {
    assert.match(MODEL_COMPARISON, /import \{ traceStats \} from "@\/lib\/actions\/observability"/);
    assert.match(MODEL_COMPARISON, /import \{ costSummary \} from "@\/lib\/actions\/cost"/);
  });

  it("model comparison does not claim quality scores it does not have", () => {
    assert.match(MODEL_COMPARISON, /not yet available/);
    assert.match(MODEL_COMPARISON, /not recorded for this workspace/);
    assert.ok(!MODEL_COMPARISON.includes("qualityProfile"));
    assert.ok(!MODEL_COMPARISON.includes("generateMockResult"));
  });
});