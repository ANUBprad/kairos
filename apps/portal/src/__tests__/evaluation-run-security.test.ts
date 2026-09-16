import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  new URL("../app/api/v1/evaluation/run/route.ts", import.meta.url),
  "utf8",
);

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

describe("evaluation run HTTP boundary wiring", () => {
  it("rejects client filesystem paths instead of forwarding them", () => {
    assert.match(routeSource, /dataset_path is not accepted/);
    assert.doesNotMatch(routeSource, /body\.dataset_path[\s\S]{0,60}JSON\.stringify/);
  });

  it("never trusts a client-supplied namespace", () => {
    assert.doesNotMatch(routeSource, /body\.namespace/);
    assert.match(routeSource, /namespace = knowledgeBaseId;/);
  });

  it("anchors the namespace to a knowledge base the caller can access", () => {
    assert.match(routeSource, /await canAccessKnowledgeBase\(session\.user\.id, knowledgeBaseId\)\)/);
    assert.match(routeSource, /namespace = knowledgeBaseId;/);
    assert.match(routeSource, /namespace = kb\.id;/);
  });
});

describe("intelligence persistence wiring", () => {
  it("requires a knowledge base anchor when persisting", () => {
    assert.match(routeSource, /persist && !knowledgeBaseId/);
    assert.match(routeSource, /knowledge_base_id is required when persist=true/);
  });

  it("forwards include_results only when persisting", () => {
    assert.match(routeSource, /\? \{ include_results: true \} : \{\}/);
  });

  it("derives the persisted run's ownership from the server session and validated namespace", () => {
    assert.match(routeSource, /createIntelligenceRun\(\{[\s\S]{0,240}knowledgeBaseId: namespace,[\s\S]{0,160}userId: session\.user\.id/);
    assert.doesNotMatch(routeSource, /body\.run_id/);
    assert.doesNotMatch(routeSource, /body\.user_id|body\.organization_id/);
  });

  it("lets the server own the run lifecycle, never the client", () => {
    assert.doesNotMatch(routeSource, /body\.run_id[\s\S]{0,60}JSON\.stringify/);
    assert.doesNotMatch(routeSource, /run_id[\s\S]{0,60}createIntelligenceRun/);
    assert.match(routeSource, /failIntelligenceRun\(runId\)/);
    assert.match(routeSource, /completeIntelligenceRun\(runId, outcome/);
  });
});

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
    assert.equal(callCount, 5);
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