import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accessSource = readFileSync(
  new URL("../lib/evaluation/access.ts", import.meta.url),
  "utf8",
);

const actionsSource = readFileSync(
  new URL("../lib/actions/evaluation.ts", import.meta.url),
  "utf8",
);

const regressionSource = readFileSync(
  new URL("../lib/evaluation/regression.ts", import.meta.url),
  "utf8",
);

const regressionPageSource = readFileSync(
  new URL("../components/evaluation/regression-compare.tsx", import.meta.url),
  "utf8",
);

const regressionClientSource = readFileSync(
  new URL("../app/app/regression/regression-client.tsx", import.meta.url),
  "utf8",
);

const regressionTrackingSource = readFileSync(
  new URL("../lib/evaluation/regression-tracking.ts", import.meta.url),
  "utf8",
);

const regressionRouteSource = readFileSync(
  new URL("../app/api/v1/regression/route.ts", import.meta.url),
  "utf8",
);

describe("dataset and run authorization shared boundary", () => {
  it("resolves dataset tenancy through the caller identity, not dataset existence", () => {
    assert.match(accessSource, /canAccessKnowledgeBase\(userId, dataset\.knowledgeBaseId\)/);
    assert.doesNotMatch(accessSource, /_userId/);
  });

  it("keeps foreign, forged, and missing datasets indistinguishable as not-found", () => {
    assert.match(accessSource, /Dataset not found/);
    assert.doesNotMatch(accessSource, /assertDatasetAccess[\s\S]{0,120}findUnique[\s\S]{0,40}return dataset/);
  });

  it("derives run access from the run dataset's tenancy", () => {
    assert.match(accessSource, /await assertDatasetAccess\(run\.datasetId, userId\)/);
  });

  it("makes the actions import the shared boundary and no longer define it locally", () => {
    assert.match(actionsSource, /import \{ assertDatasetAccess, assertRunAccess \} from "@\/lib\/evaluation\/access";/);
    assert.doesNotMatch(actionsSource, /async function assertDatasetAccess\(/);
    assert.doesNotMatch(actionsSource, /async function assertRunAccess\(/);
  });

  it("gates dataset and benchmark entry points with the caller's session identity", () => {
    const callCount = actionsSource.match(/await assertDatasetAccess\(datasetId, session\.user\.id\)/g)?.length ?? 0;
    assert.equal(callCount, 7);
  });
});

describe("leaderboard run tenancy wiring", () => {
  it("never queries leaderboard runs by raw caller-supplied ids without the shared boundary", () => {
    assert.doesNotMatch(actionsSource, /benchmarkRun\.findMany\(\{\s*where: \{ id: \{ in: runIds \} \}/);
  });

  it("routes both leaderboard functions through filterAccessibleRunIds", () => {
    assert.match(actionsSource, /filterAccessibleRunIds\(runIds, session\.user\.id\)/);
    assert.equal((actionsSource.match(/filterAccessibleRunIds\(runIds, session\.user\.id\)/g) ?? []).length, 2);
  });

  it("derives leaderboard access from assertRunAccess through the shared boundary", () => {
    assert.match(actionsSource, /filterAccessibleRunIds[\s\S]{0,300}await assertRunAccess\(id, userId\)/);
  });
});

describe("regression run comparison wiring", () => {
  it("delegates the comparison action to a session-scoped core", () => {
    assert.match(actionsSource, /compareEvaluationRuns\(baselineRunId: string, candidateRunId: string\)[\s\S]{0,200}getServerSession\(\)/);
    assert.match(actionsSource, /compareRunsForUser\(baselineRunId, candidateRunId, session\.user\.id\)/);
  });

  it("keeps foreign, fabricated, and deleted runs indistinguishable at the comparison boundary", () => {
    assert.match(regressionSource, /await assertRunAccess\(baselineRunId, userId\)[\s\S]{0,120}throw new Error\("Run not found"\)/);
    assert.match(regressionSource, /await assertRunAccess\(candidateRunId, userId\)[\s\S]{0,120}throw new Error\("Run not found"\)/);
  });

  it("scopes the run picker through the shared dataset accessor", () => {
    assert.match(actionsSource, /listRunsForDataset\(datasetId: string\)[\s\S]{0,300}getBenchmarkRuns\(datasetId, session\.user\.id\)/);
  });

  it("connects the regression page to the real comparison action", () => {
    assert.match(regressionPageSource, /import \{[\s\S]*compareEvaluationRuns[\s\S]*\} from "@\/lib\/actions\/evaluation"/);
    assert.match(regressionPageSource, /listRunsForDataset/);
    assert.doesNotMatch(regressionPageSource, /fetch\("\/api\/v1\/evaluation\/run"/);
    assert.match(regressionClientSource, /RegressionCompare/);
  });

  it("removes the dead namespace input from the regression surface", () => {
    assert.doesNotMatch(regressionPageSource, /namespace/);
  });

  it("renders a per-metric verdict with the comparison statistics", () => {
    assert.match(regressionPageSource, /VerdictBadge/);
    assert.match(regressionPageSource, /p-value/);
    assert.match(regressionPageSource, /pairedCount/);
  });
});

describe("regression tracking API route wiring", () => {
  it("authenticates the tracking route the same way as the other v1 routes", () => {
    assert.match(regressionRouteSource, /const auth = await validateApiKey\(request\)/);
    assert.match(regressionRouteSource, /rateLimit\(`v1:\$\{auth\.organizationId\}`, RATE_LIMITS\.api\)/);
  });

  it("never trusts a client-supplied identity or run state", () => {
    assert.doesNotMatch(regressionRouteSource, /body\.organizationId|body\.organization_id/);
    assert.doesNotMatch(regressionRouteSource, /body\.userId|body\.user_id/);
    assert.doesNotMatch(regressionRouteSource, /body\.status|body\.verdict/);
  });

  it("only accepts the two run ids and validates their UUID format", () => {
    assert.match(regressionRouteSource, /body\.baselineRunId/);
    assert.match(regressionRouteSource, /body\.candidateRunId/);
    assert.match(regressionRouteSource, /UUID_REGEX\.test\(baselineRunId\)/);
    assert.match(regressionRouteSource, /UUID_REGEX\.test\(candidateRunId\)/);
  });

  it("delegates the tracked comparison to the shared Slice B engine, unchanged", () => {
    assert.match(regressionTrackingSource, /import \{[^}]*buildRegressionComparison[^}]*\} from "\.\/regression"/);
    assert.doesNotMatch(regressionTrackingSource, /compareMetrics\(/);
  });

  it("resolves run tenancy through the API key organization, with standalone runs global", () => {
    assert.match(regressionTrackingSource, /knowledgeBase: \{ project: \{ organizationId \} \}/);
    assert.match(regressionTrackingSource, /knowledgeBaseId: null/);
  });

  it("keeps foreign, forged, and deleted runs indistinguishable as not-found", () => {
    assert.match(regressionTrackingSource, /throw new Error\("Run not found"\)/);
    assert.match(regressionRouteSource, /error\.message === "Run not found"/);
    assert.match(regressionRouteSource, /One or both runs not found/);
  });

  it("derives the persisted verdict from the comparison without client input", () => {
    assert.match(regressionTrackingSource, /overallVerdict = result\.ok \? result\.overall\.verdict : "incompatible"/);
    assert.match(regressionTrackingSource, /baselineRunId_candidateRunId/);
  });
});
