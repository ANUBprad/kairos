# Kairos Evaluation & Regression Productization Audit

## Executive Summary

Kairos ships two **disconnected** evaluation systems:

1. **Portal path (persistent, in-DB)** — `BenchmarkDataset` → `BenchmarkRun` → `BenchmarkResult` in Prisma/Postgres, executed by synchronous server actions in `apps/portal/src/lib/actions/evaluation.ts` and `apps/portal/src/lib/evaluation/benchmark.ts`. Fully tenant-scoped, per-case persistent, config-snapshotted, wired into `research`, `benchmark-explorer`, `quality-gates`, `publication`.
2. **Intelligence path (ephemeral, in-memory)** — Chroma-backed `scripts/eval.py` / REST `POST /api/v1/evaluation/run`, executed by `intelligence/evaluation/runner.py`. Produces judge scores, latency/usage/cost, and a `trace_id`, but persists **nothing** and returns **aggregates only**.

The Regression page (`/app/regression`) drives the intelligence path, yet is titled "Test prompt versions against golden datasets and detect regressions" and performs **no regression detection**: it is a single blind run with no baseline, no comparison, and no statistical signal. Its free-text `namespace` input is silently ignored by the portal route (server-derived), and its `trace_id` line is plain text with no link to the trace explorer.

The claim central to productization — *run → metrics → comparison → regression → action* — completes nowhere end-to-end. The portal path stops at comparison (`compareRuns`, no-significance winner-by-majority), the intelligence path stops at a single-run aggregate, and no surface connects the two.

Most importantly, the audit found **one P0 security defect**: `getLeaderboard` / `getScientificLeaderboard` resolve `BenchmarkRun` records by caller-supplied `runIds` with no tenancy check, leaking another tenant's aggregated and per-query metrics (violating the "foreign ids fail as not-found" invariant enforced everywhere else).

All findings are classified in [Findings](#findings). One P0 must be fixed first; the recommended next product slice wires statistical regression comparison onto already-persisted portal runs with **zero schema change**.

## Current Evaluation Architecture

**Two execution paths (verified):**

| | Portal inline path | Intelligence HTTP/CLI path |
|---|---|---|
| Entry | server actions → `runBenchmark` (`benchmark.ts:101-250`) | `apps/portal/src/app/api/v1/evaluation/run/route.ts` → `INTELLIGENCE_REST_URL` |
| Server | Next.js server action (synchronous) | FastAPI `intelligence/api/routes/evaluation.py:58-77` → `run_dataset` (`factory.py:173-183`) |
| Store | Chroma + Postgres (Namespace) | Chroma only |
| Persist | `BenchmarkRun`/`BenchmarkResult` rows | none (aggregate JSON only) |
| Metrics | retrieval `@K` family + heuristic generation (in `metrics/retrieval.ts`, `metrics/generation.ts`) | recall/precision + optional LLM judge dims |
| Transport | N/A (in-process) | REST, `x-api-key` when `KAIROS_API_SECRET` set |

- No evaluation functionality exists in the gRPC channel. `proto/rag.proto` defines exactly five RPCs (`ComputeEmbeddings`, `ClassifyQueryType`, `IngestDocument`, `ExecuteRetrieval`, `GenerateResponse`); evaluation is HTTP-only.
- The two paths share no dataset format, no metric vocabulary, no storage, and no product surface. The portal `BenchmarkDataset` and the intelligence `dataset_name`/ground-truth (`benchmarks/dataset/`) are independent artifacts.
- The SDK (`sdk/kairos/`) exposes only `Retrieve`/`Ingest` client methods (`sdk/kairos/client.py`, `models.py`); no evaluation methods.

## Evaluation Dataset Lifecycle

**OBSERVED (portal, `createBenchmarkDataset` `benchmark.ts:23-46`, `importJsonDataset` `actions/evaluation.ts:57-96`):**
- Create: name, description, source, optional `knowledgeBaseId`, and `questions[]` (`question`, `expectedAnswer`, `referenceDocId`).
- `BenchmarkDataset` has a `version` column (`DEFAULT 1`) and a `parentVersionId` self-FK (migration `20260710000000...`, `CREATE TABLE BenchmarkDataset`). **Nothing writes version or parentVersionId** — versioning is inert; there is no clone/versioning action anywhere.
- Delete: `deleteDataset`/`deleteBenchmarkRun` (server actions, access-checked).
- Import: JSON with a `questions` array; tolerant key aliases (`expected_answer`, `reference_doc_id`).

**OBSERVED (intelligence):** datasets are package files resolved by name (`load_dataset(path=None)` in `factory.py:183`); ground-truth entries via REST `/api/v1/evaluation/ground-truth` (`evaluation.py:80-100`) are in-memory `GroundTruth` only.

**Lifecycle gap:** no dataset revision/versioning workflow, no "reference dataset" pinned to knowledge base content, no dataset↔namespace mapping. The `version`/`parentVersionId` schema intent is unused.

## Evaluation Run Lifecycle

**Portal inline run (`benchmark.ts:101-250`):**
1. Load dataset + questions; reject empty questions.
2. Create `BenchmarkRun` (`status: "running"`, `configSnapshot: RetrievalConfig`).
3. Synchronous per-question loop: `runRetrieval(knowledgeBaseId, question, config, true)` then inline LLM generation (`getAIProvider(...).generateChat`, hardcoded prompt, `temperature: 0.1`, `maxTokens: 1024`).
4. Per-question metrics computed with `calculateRetrievalMetrics` / `calculateGenerationMetrics`; results buffered.
5. **Errors are caught and dropped** (`benchmark.ts:203-205`): no `BenchmarkResult` row, no failure field; loop continues; run always ends `status: "completed"`.
6. If any results: `createMany` results; then aggregate mean metrics → `aggregatedMetrics`; `completedAt` set.

**Consequence (DERIVED):** a run where *all* questions throw produces `results.length === 0` → `avgLatency = 0/0 = NaN` → written into PostgreSQL `Json` column → the `benchmarkRun.update` in step 6 raises, leaving the run `status: "running"` forever with no result rows. Partial failures silently reduce N and inflate averages.

**Intelligence run (`evaluation.py:58-77`, `runner.py`):** classify → retrieve → (generate) → (judge) per entry; aggregates computed in-memory (`entry_result.py` `RunResult`); `trace_id` echoed from `results[0].trace_id`. `max_entries` and `top_k` are clamped in the portal route; a 15-minute `AbortSignal` guards the upstream call.

**No run queue/cancellation on either path.** The portal path runs in the server action (user's HTTP request held until completion); the intelligence path is synchronous HTTP with a 15-minute cap.

## Run Configuration & Reproducibility

**OBSERVED — what is snapshotted:**
- Portal: `configSnapshot` = the full `RetrievalConfig` object (both on `BenchmarkRun` and each `BenchmarkResult`; identical copy). Rendered in the report via the first result's snapshot (`benchmark.ts:265`, `getReport` takes `results.take(1)`).
- Intelligence: `RunConfig` (`namespace`, `dataset_name`, `generate`, `judge`, `top_k`, `max_entries`) lives per-run; not persisted anywhere.

**OBSERVED — what is NOT snapshotted:**
- The LLM model used for generation: `benchmark.ts:162-176` reads `(config as unknown).chatModel || provider.getDefaultModel()` — `chatModel` is not part of `RetrievalConfig`, so the actual model is **whatever the provider default is at run time**. System prompt is a hardcoded literal. Generation model+prompt are therefore not part of `configSnapshot`.
- Prompt template, temperature/maxTokens beyond the literal in code.
- Intelligence path: Chroma namespace contents are not versioned; a run against a mutated namespace is not reproducible.

**Recommendation:** extend the snapshot written by `runBenchmark` to include `chatModel`, the system/user prompt texts, `temperature`, `maxTokens`, provider, and source file/commit for the dataset.

## Per-Case Results

**Portal:** persistent per-case `BenchmarkResult` rows (retrievedChunkIds, retrievedChunks, generatedAnswer, retrievalMetrics, generationMetrics, latency fields, configSnapshot). Fetchable via `getBenchmarkRun(runId)` (`benchmark.ts:83-91`). `getReport` deliberately `take: 1` for the snapshot but returns aggregate.

**Intelligence:** per-entry `EntryResult` is computed and held in `RunResult.results`, but **`RunResult.to_dict()` (`entry_result.py:156-175`) emits aggregates ONLY** — per-query rows, generated answers, judge dims per entry, latency breakdowns, tokens, cost are all discarded by the HTTP/CLI boundary. The Regression UI has nothing per-case to render.

**Gap:** the page consumers that need per-case data (research, regression) cannot get it from the intelligence path, and the portal inline run never produces judge scores or cost/token accounting.

## Metrics Audit

**Portal retrieval metrics (`metrics/retrieval.ts`):** recall@K, precision@K, hit rate, MRR, nDCG — computed with a binary relevance model (`referenceDocId` document match; fallback relevant set = first 2 retrieved chunks when no `referenceDocId`). Formally correct implementations.

**Portal generation metrics (`metrics/generation.ts`) — heuristic proxies, with two correctness hazards:**
- `calculateFaithfulness` = per-sentence keyword-overlap (words > 3 chars, ≥ 50% contained in context). **An empty answer returns `1.0`** (`extractSentences([])` → `[]` → `return 1`, line 22-23). A generation outage therefore scores *perfect* faithfulness.
- `contextPrecision` is defined as "ratio of meaningful (≥3-word) sentences", not relevance of retrieved chunks — a misnamed heuristic.
- `contextRecall` returns **default `0.5` when no `expectedAnswer`** (line 58).
- `answerRelevancy` = question-word overlap in the answer text.

These are honest approximations, but combined with `runBenchmark`'s empty-answer→perfect-score path they can report high generation quality for a system that fails to answer.

**Intelligence scoring:** retrieval recall/precision from ground-truth relevant sets; optional LLM-as-judge dimensions (`judge_scores`, composite). No cost/usage on the portal path at all (`tokenUsage`, `cost`, `chunkCount` hardcoded `0` in `generateEvaluationReport` `benchmark.ts:287-297`).

## Regression Detection Audit

**OBSERVED — there is no regression detection in product surfaces:**

- `/app/regression` (`components/evaluation/regression-run.tsx`) = single-run aggregate dashboard. No baseline selection, no comparison, no delta, no significance. The page's own header text promises "detect regressions" (`regression-client.tsx:11`) and "Test prompt versions against golden datasets" — neither exists here.
- The `namespace` input (`regression-run.tsx:87-92`) is **dead**: `route.ts` never reads `body.namespace` (verified: no `body.namespace` reference; `evaluation-run-security.test.ts:27` even asserts its absence). The namespace is always derived from `knowledgeBaseId` or the caller's oldest accessible KB.
- `getBaselines` (`actions/evaluation.ts:266-284`) returns the caller's most recent 10 completed runs **across all datasets** — no dataset anchor, no per-dataset pinning — and is what `benchmark-explorer` and `/app/research` call a "baseline".
- True regressions *can* be detected statistically today, but only under `/app/research` (pairwise `compareMetrics` over up to 5 runs), not in any regression surface.

**Intelligence/CI regression:** `scripts/eval.py` supports `--baseline` (create/gate) and per-metric `--tolerance` (`regression.py`); the CI workflow creates the baseline in the *same* job as the gated run against same-day LLM output — a moving target with no persisted history (see [CI / Regression Gates](#ci--regression-gates)).

## Run Comparison

**Portal `compareRuns` (`actions/evaluation.ts:202-226`):**
- Fetches both runs' `aggregatedMetrics`, asserts dataset access per side, then `compareBenchmarkRuns` (`benchmark.ts:358-473`).
- **No check that the two runs use the same dataset.** Cross-dataset "comparisons" are allowed silently.
- Winner = majority of wins across 9 metrics with a 0.001 tie epsilon; **no statistical significance, no sample-size handling, no effect size** even though `significance.ts` provides exactly these primitives (used only by research/leaderboard/recommendations).
- Latency is **excluded** from `metricKeys` and hardcoded `0` in both config blocks; cost/usage/chunkCount likewise.
- `k` is hardcoded to `4` in both config blocks (`benchmark.ts:429,454`) regardless of the run's actual topK.

**Scientific comparison** (`research/page.tsx:120-227`) is real: paired t-test/Wilcoxon + bootstrap CI + effect size per metric over per-query values. It exists only there, capped at 5 runs (up to 10 pairwise comparisons), and operates on the portal inline run results only.

## Trace & Observability Integration

**OBSERVED:**
- Intelligence path emits `trace_id` per entry and per run (`entry_result.py` contextvars). The regression page prints it as a bare `<p className="font-mono">traceId: …` line — **not a link**.
- Trace Explorer (`/app/observability/traces/page.tsx`) is real (server-action `listTraces`, search/status/provider filters, pagination), but each row's "view" button links to `/app/observability/traces/${trace.id}` which **does not exist** (verified: no `traces/[id]` route; `glob app/observability/**` shows only page-level files) → dead deep-link.
- `Trace`/`Span`/`TraceEvent` models exist in `schema.prisma` but are **not created by any migration** (see [Database / Data Model](#database--data-model)); a fresh deploy ships without them.
- No portal inline-run trace is ever produced; the portal eval path emits no OpenTelemetry/`trace_id`.

**Gap:** run trace → explorer linkage is broken at both ends (no link from run, no detail route).

## Red-Team / Adversarial Evaluation

**OBSERVED (absence):** there is no adversarial evaluation surface anywhere:
- No jailbreak / prompt-injection / prompt-extraction fixture category in `BenchmarkDataset.tags` or the dataset UI.
- No red-team notebook, guardrail scorer, or `Prompt`-focused adversarial benchmark wired to `BenchmarkRun`.
- The closest capabilities are `retrieval-lab` (interactive single-query retrieval, real) and `quality-gates` (flagged conditions) — neither is red-team evaluation.
- `references: ReviewQueue`/`ReviewComment` models exist (`schema.prisma`, migration-orphaned) for human review of generated answers; no UI surface was found that runs a review meaningful against a `BenchmarkRun`.

Marked as explicit non-goal for this audit cycle; see [Candidate Product Slices](#candidate-product-slices) for optional angle.

## Evaluation UI Audit

**Real surfaces (verified wired to server actions / real data):**
- `/app/evaluation` (`evaluation-client.tsx` imports `@/lib/actions/evaluation`): dataset CRUD, manual/import questions, benchmark run, campaign run, report.
- `/app/datasets` (`@/lib/actions/golden-datasets`): golden-dataset management.
- `/app/benchmark-explorer` (`listDatasets`, `getBaselines`): run baskets vs baselines.
- `/app/quality-gates` (`@/lib/actions/quality-gates`): gate CRUD + evaluation against supplied metrics.
- `/app/research`: real run data → statistical comparison.
- `/app/retrieval-lab`: real interactive retrieval.
- `/app/observability` (traces/storage/sessions/providers/pipeline): real server-action surfaces.

**Mock / demo surfaces (verified in source):**
- `/app/experiments` (`experiments-client.tsx:30,284,345`): `DEMO_EXPERIMENTS` fallback when no rows; runs fabricate `latencyMs = 1500 + Math.random()*2000`.
- `/app/experiment-builder` (`experiment-builder-client.tsx:198`): `runExperiment` is a 3s `setTimeout` with no persistence.
- `/app/model-comparison` (`components/evaluation/model-comparison.tsx:152,281`): results synthesized from hand-tuned quality profiles + `Math.random()`.
- `/app/leaderboards` (`components/evaluation/leaderboards.tsx:117,486`): `MOCK_DATA` keyed by tab.
- `/app/analytics` (`components/evaluation/analytics-dashboard.tsx:84-88,94-197`): every series is `MOCK_*` + `Math.random()`.
- Dashboard widgets (`activity-feed`, `insights-panel`, `ai-suggestions`) fall back to `DEMO_*` when empty.

These pages present nonexistent capabilities as live product; the leaderboard/analytics/model-comparison surfaces are the same "leaderboard story" users are already told about via real `getLeaderboard`/`getScientificLeaderboard` actions — the mock UI bypasses them entirely.

## Product Coherence

The product story "evaluate → compare → detect regression → gate → act" is split:

- Portal runs persist everything and can be compared statistically, but **no surface named "regression" consumes them**.
- The surface named "regression" runs ephemeral Chrome evaluations with **no persistence, no baseline, no comparison, and a dead namespace input**.
- CI gates the intelligence path with a 6-question same-day baseline; the portal CI (`portal.yml`) runs lint/typecheck/prisma-validate/build only — it never touches evaluation.
- Mock pages (`model-comparison`, `leaderboards`, `analytics`) advertise scientific claims the real system only partially produces (and only on the portal side).
- Dataset versioning is inert; `parentVersionId` never set; no consistency between "dataset" (portal Prisma, questions with expectedAnswer) and "dataset" (intelligence file + ground-truth).

**There is no single surface where a user can: pick a dataset, run a baseline, modify one variable, re-run, and see a statistically backed regression verdict.**

## Tenancy & Security Audit

**OBSERVED (good):**
- `access.ts` centralizes tenancy: dataset anchored to a KB is gated by `canAccessKnowledgeBase(userId, kbId)`; un-anchored datasets are global; runs inherit dataset tenancy; foreign/forged ids fail as "not found".
- All evaluation server actions call `getServerSession()` and, where relevant, `assertDatasetAccess`/`assertRunAccess`/`assertKbAccess` (`actions/evaluation.ts`).
- HTTP boundary refuses `dataset_path` (route.ts:37-42) and never trusts a client namespace (route.ts:57-65; enforced by regex test `evaluation-run-security.test.ts`).
- Intelligence REST is behind `AuthMiddleware` (`x-api-key`) whenever `KAIROS_API_SECRET` is set, and production **refuses to start without it** (`app.py:30-39`).

**OBSERVED (P0):**
- `getLeaderboard` (`actions/evaluation.ts:319-334`) and `getScientificLeaderboard` (`:336-411`) fetch `BenchmarkRun` rows `where id in runIds` with **no `assertRunAccess`/`assertDatasetAccess`, no org scoping** — any authenticated caller may enumerate arbitrary run ids and read another tenant's `aggregatedMetrics` and (for the scientific variant) per-query retrieval/generation metrics. This breaks the invariant `access.ts` documents and the security tests enforce everywhere else.
- `getDatasetsForSelector` and `getBaselines` scope by the caller's org memberships (correct), but `getLeaderboard` does not.
- `/api/v1/config` is served without authentication middleware scoping (health + config are public in dev, config gated by middleware when secret is set — middleware covers all routes, so config is same-gate). No additional exposure found on the eval boundary.

**Historical fixes verified intact:**
- `d6373ea9` dataset confinement — route rejects client `dataset_path` and derives namespace from KB. ✅
- `8bd9b772` member privilege escalation — access via shared boundary imported by actions. ✅
- `5848dc82` gRPC auth interceptor — evaluation is HTTP-only, gRPC not reachable. ✅
- `8fdf26c6` migration chain — see data-model orphan gap (test covers only a hotpath subset).

## Run Reliability

**OBSERVED issues:**
- Portal `runBenchmark` has no failure handling: per-question `catch` silently discards; no partial/error status; all-fail run ends `completed` with NaN `avgLatencyMs` written into a Postgres Json column → update throws → run stuck `"running"`.
- No retry, no timeouts on the inline path (a single hung provider call blocks the whole server action; the HTTP path has a 15-minute outer cap).
- No run queue, cancellation, or background execution; heavy runs block the user's request.
- Intelligence `worker.py` is a stub: `process_ingestion_job` logs+sleeps (worker.py:15-27), `run_worker_loop` sleeps forever (worker.py:30-40) — yet is deployed as a Docker service (`docker-compose.yml`). It provides no evaluation or ingestion function.

## Reproducibility

- Generation model/prompt not in `configSnapshot` (see [Run Configuration & Reproducibility](#run-configuration--reproducibility)).
- `retrievalConfig` values used at run time are snapshotted, but the *chunk store state* (candidate chunks per KB) is not versioned.
- No dataset version pinning (inert `version`/`parentVersionId`).
- Intelligence runs are in-memory: same config + same namespace on a later day cannot be re-run against the same content.
- CI baseline is ephemeral same-job (see below).

## Query & Performance Audit

- Portal inline runs issue N synchronous retrieval+generation calls sequentially; a 100-question dataset = 100 provider round-trips held in one HTTP request. No batching, no parallel cap, no serverless timeout analysis.
- `getDashboardStats`-style leaderboards do N-queries per run id; `getScientificLeaderboard` loads all `results` per run with no pagination or `take` limit (`actions/evaluation.ts:348-355`).
- `getBaselines` is unscoped by dataset but `take: 10`; `getRun` includes all results un-paginated.
- The intelligence path clamps `max_entries` ≤ 1000 and `top_k` ≥ 1 (`route.ts:83-88`) plus a rate limiter; the portal action path has no equivalent limits.

## Test Coverage Audit

**OBSERVED tests (portal `src/__tests__/`):**
- `evaluation-run-security.test.ts` — **static/source-wiring tests** (regex over route.ts/access.ts/actions.ts): dataset_path rejection, namespace anchoring, shared-boundary import, session gating count. Not behavioral integration tests, but they pin the security invariants structurally.
- `evaluation-authorization.integration.test.ts` — behavioral tenancy testing of the auth boundary (previously green in full suite).
- `migration-chain.integration.test.ts` — deploys all migrations onto an empty DB and asserts **only `HOTPATH_TABLES`** (Experiment, BenchmarkDataset, ExperimentRun, BenchmarkRun, ProviderHealth, DocumentChunk, DocumentEmbedding, Conversation/Message/Citation, QuizAttempt*/FlashcardReview) plus a fixed hotpath-index set. It does not include BenchmarkQuestion/BenchmarkResult/ExperimentArtifact or any quality/observability table — which is exactly the gap.

**Coverage gaps:** no test exercises `runBenchmark` round-trip behavior (error isolation, all-fail NaN, snapshot completeness), no test for `compareRuns` cross-dataset guard (there is none), no test for regression-page semantics, no test for the intelligence runner payload shape (aggregate-only), no CLI gate behavioral test in-repo (CI does it live).

## SDK / CLI Audit

- **SDK** (`sdk/kairos/`): `Retrieve`/`Ingest`-style client only; no evaluation method, no baseline/gate helpers. Eval is CLI-only.
- **CLI** (`scripts/eval.py`): real and capable — `run`, `--namespace`, `--dataset-name`/`--dataset-path` (trusted local path here, correct), `--top-k`, `--max-entries`, `--baseline` create/gate, `--tolerance`, `--gate metric op value`, `--output`. This is the only surface today that can regression-gate; it persists nothing beyond requested JSON output.
- CLI and REST share `RunConfig`, but the REST path forbids `dataset_path` (by design) and drops per-entry data.

## CI / Regression Gates

**`.github/workflows/evaluate.yml` (OBSERVED):**
- Triggered on workflow_dispatch, PR→main, push→main.
- Spins up Chroma 1.0.15 + Ollama llama3, local embeddings.
- Step "Run evaluation and create baseline": `scripts/eval.py run --namespace ci-eval --dataset-name ci-golden --max-entries 6 --baseline artifacts/baseline.json`.
- Step "Check regression": re-run same command with `--gate success_rate gte 0.9 --gate total gte 6`; gate failure fails the job.
- Artifacts uploaded; containers torn down.

**Problems (OBSERVED + DERIVED):**
- The baseline is created in the **same job immediately before** the gated run against the same live namespace — a moving target created by the same code+LLM. It cannot detect cross-version drift (no stored history, no `--tolerance` set).
- Gate dimensions: only `success_rate ≥ 0.9` and `total ≥ 6` on 6 queries — thin.
- The portal CI (`portal.yml`: lint, `tsc --noEmit`, `prisma validate`, build) never runs any evaluation; the product's own persisted benchmark surface is uninstrumented in CI.
- Gate failures degrade nothing; the workflow has no baseline artifact retention beyond per-run uploads.

## Database / Data Model

**OBSERVED (schema.prisma + migrations):**
- Migrations total 11 (init → study_loop). The eval/observability migration `20260710000000_add_evaluation_observability_embedding_tables` creates `BenchmarkDataset, Experiment, ExperimentRun, BenchmarkRun, ProviderHealth, DocumentChunk, DocumentEmbedding`.
- **Migration-orphaned models** (exist in `schema.prisma`, but `rg` over `prisma/migrations/**` finds no `CREATE TABLE`): `BenchmarkQuestion`, `BenchmarkResult`, `ExperimentArtifact`, `GoldenDataset`(+Entry), `ReviewQueue/ReviewComment`, `QualityGate/QualityGateResult`, `LeaderboardEntry`, `Trace/Span/TraceEvent`, `CostRecord`, `DriftAlert`, `Alert*`, `Incident`, `Prompt(s)`. They live via historical `prisma db push`, not the deploy chain.
- Consequence: a **fresh production/CI database run through `prisma migrate deploy` materializes a schema without the tables the ORM queries for benchmark/quality/observability** → runtime failures at evaluation, quality-gate, and trace surfaces on green deploys. The `migration-chain` test passes because its `HOTPATH_TABLES` list excludes them.
- `BenchmarkQuestion`/`BenchmarkResult`/`ExperimentRun` carry `configSnapshot` (Json) — per-question config is snapshotted identically.
- No cost/token columns on `BenchmarkRun`/`BenchmarkResult` — mirrors the report's hardcoded zeros.

## Findings

### P0

**P0-1 — Cross-tenant leaderboard data leak.** `getLeaderboard`/`getScientificLeaderboard` (`apps/portal/src/lib/actions/evaluation.ts:319-411`) fetch `BenchmarkRun` by caller-supplied `runIds` with no tenancy check, exposing another org's `aggregatedMetrics` and per-query metrics to any authenticated user. Evidence: `actions/evaluation.ts` reads; contrast with `access.ts` and all other actions. Impact: tenant isolation breach on persisted evaluation data. Recommendation: `assertRunAccess` per id (or scope `where` with the caller's orgs) before selection; re-run `evaluation-run-security.test.ts` (its static assertions currently pin the wrong property for these two actions). Verification: see probe in [Validation Performed](#validation-performed).

### P1

**P1-1 — Zero-changes evaluation↔regression coherence.** No surface lets a user baseline → change one variable → re-run → get a statistically backed regression verdict. Evidence: `regression-run.tsx` (single blind run), `applyMetrics`/`compareRuns` no-significance, `getBaselines` cross-dataset. Impact: core product promise unmet; duplicate consumer buildouts.

**P1-2 — Regression page has no regression detection, dead namespace input.** `regression-run.tsx` and `route.ts` (never reads `body.namespace`; assertion-comment in `evaluation-run-security.test.ts:27`). Impact: misleading UI that silently evaluates against a server-chosen KB.

**P1-3 — Generation failure scores perfectly.** Empty answer → `faithfulness=1`, `contextPrecision=1` (`metrics/generation.ts:22-23,44-45`) combined with silent error-drop in `runBenchmark` means an outage reports top-tier "quality." Impact: false confidence, bad gate edges.

**P1-4 — Run failures vanish; all-fail run ends "completed" with NaN → stuck.** `benchmark.ts:203-209,237-247`. Impact: phantom status, corrupted aggregates, dangling `running` rows.

**P1-5 — Two evaluation systems with divergent vocabulary/storage, bridged nowhere.** Portal (BenchmarkDataset/Result) vs intelligence (dataset files/ground-truth). Impact: schemes/duplication; CI gates metrics users can't see; portal metrics CI never runs.

**P1-6 — Fresh deploy missing core tables.** `BenchmarkQuestion`, `BenchmarkResult`, `ExperimentArtifact`, `GoldenDataset*`, `QualityGate*`, `Trace/Span/TraceEvent`, leaderboard, prompts are migration-orphaned; `migration-chain.integration.test.ts` passes because `HOTPATH_TABLES` excludes them. Impact: green deployments land with eval/quality/observability broken.

**P1-7 — `compareRuns` allows cross-dataset comparison with a winner-by-majority verdict and hardcoded `k=4`, excluding latency/cost/usage.** `actions/evaluation.ts:202-226`, `benchmark.ts:358-473`. Impact: meaningless comparisons presented as conclusions.

### P2

**P2-1 — Mock/demo surfaces present fabricated analytics as product** (`experiments`, `experiment-builder`, `model-comparison`, `leaderboards`, `analytics` — sources cited in [Evaluation UI Audit](#evaluation-ui-audit)).

**P2-2 — Generation LLM model/prompt not snapshotted** (`benchmark.ts:162-176`) — reproducibility gap; report reads only first result's snapshot.

**P2-3 — Inert dataset versioning (`version`, `parentVersionId` never written).**

**P2-4 — Trace integration is dead at both ends** (plain-text trace_id from eval; `/app/observability/traces/[id]` route missing; Trace tables unbacked by migrations).

**P2-5 — `getBaselines` baseline identity is cross-dataset top-10, no staleness/anchor** (`actions/evaluation.ts:266-284`).

**P2-6 — Quality gates evaluated against caller-supplied metrics only; no wiring from `BenchmarkRun.aggregatedMetrics`** (`checkQualityGate(gateId, metrics)` `quality-gates.ts:170-197`).

**P2-7 — Ephemeral same-job CI baseline** on 6 queries, llama3+local embeddings, gate `success_rate≥0.9`/`total≥6` only, no portal-side CI eval (evaluate.yml).

**P2-8 — Intelligence worker is a stub deployed as a service** (`worker.py`, `docker-compose.yml`) — functionless cluster capacity.

**P2-9 — Generation metrics are keyword-heuristic; contextPrecision is sentence-length proxy; contextRecall defaults 0.5** (see [Metrics Audit](#metrics-audit)).

### P3

**P3-1 — No red-team/adversarial eval fixture category or surface.**
**P3-2 — No pagination/limits on portal runs or result includes on `getRun`/scientific leaderboard; no cancellation/queue.**
**P3-3 — SDK has no eval methods; eval is CLI/HTTP only.**
**P3-4 — No token/cost capture in portal metric path; report hardcodes zeros for tokenUsage/cost/chunkCount.**
**P3-5 — No behavioral (non-regex) regression test for run lifecycle, comparison guard, or runner payload shape.**

## Candidate Product Slices

A. **Fix P0-1** (leaderboard tenancy) — trivial diff, security-critical. *Do first, regardless of slice.*
B. **Statistically-backed run comparison on the Regression page** — rewire `/app/regression` to portal persisted runs; pick dataset → baseline run + treatment run → `compareAllMetrics` + `interpretResult` verdicts; zero schema.
C. **Persist intelligence run results into `BenchmarkRun`/`BenchmarkResult`** via the portal route on response (store judge dims in generationMetrics Json); enables per-case + regression on the Chroma path; zero schema.
D. **Snapshot LLM model/prompt in `configSnapshot`** + make `runBenchmark` record per-question failures and never report NaN; zero schema.
E. **Back the orphaned tables with a real migration** (add `20261116000000_materialize_orphaned_eval_tables`) and extend `migration-chain` coverage — deployment integrity, single migration, prisma-deploy-friendly.
F. **Wire quality gates to `BenchmarkRun.aggregatedMetrics`** (auto-check after run; UI shows gate verdicts per run).
G. **Dataset versioning** — wire clone/version actions consuming existing `version`/`parentVersionId` columns.
H. **Tracked CI regressions** — store gate results as run rows/artifacts with history + `--tolerance`; add a portal eval smoke to `portal.yml`.

## Recommended Next Implementation Slice

**Slice B: "Statistical Regression Comparison on Persisted Portal Runs".**

Rationale: it is the first rung that closes the product gap end-to-end (baseline → change → re-run → significant verdict) using **only objects that already exist** — `BenchmarkRun`/`BenchmarkResult` rows, `significance.ts` (paired t / Wilcoxon / Cohen's-d / Cliff's / bootstrap CI already implemented and already used by research/leaderboards), and the `regression` route. Zero schema, zero new dependencies, minimal diff, immediately demoable, and it removes the misleading dead-`namespace` control in the process.

Concrete steps (size-estimated small): (1) add a server action `getRunPerQueryMetrics(runId)` that, given two same-dataset completed runs, returns per-query metric arrays (access-checked); (2) replace RegressionRun's payload flow to call `compareAllMetrics` and render verdicts (significant improvement / degradation / no-change + effect size + CI), keeping the existing form (dataset selector, run button → `runBenchmark`); (3) show run ↗ tracing by deep-linking `trace_id` once present. Do this **after** P0-1.

Recommend doing E (establish the baseline; single migration) in the same cycle to keep deploys honest, but keep B as the single product slice.

## Explicit Non-Goals

- Merging the intelligence and portal evaluation systems into one — out of scope for this audit.
- Red-team/adversarial evaluation and guardrail scorers — no surface exists; defer.
- Background queues/cancellation for eval runs (requires service work).
- Any new Prisma migration beyond a possible orphan-table materialization (E), which is optional and audited separately.
- SDK evaluation methods — defer until a product slice lands.
- No implementation was undertaken as part of this audit (read-only).

## Schema Assessment

- Schema is structurally sound for the portal path's model set; tenancy is anchored cleanly (`knowledgeBaseId` cascade, runs→datasetId, `configSnapshot` Json both levels).
- The `configSnapshot` duplication is redundant (run-level + result-level) but harmless.
- The system-critical defect is **coverage**: evaluation/quality/observability tables are not migration-backed; the deploy path diverges from `schema.prisma`. This is the single biggest operational discrepancy.
- Minor: no cost/token columns; `version`/`parentVersionId` columns unused; no unique/tenancy index on `BenchmarkDataset.knowledgeBaseId`.

## Dependency Assessment

- Portal eval path: `openai` SDK (provider `generateChat`), Prisma, Next server actions, `lucide-react`. No new or unbounded dependency.
- Intelligence eval path: FastAPI, ChromaDB, `openai`/`ollama` clients, provider env vars. All pinned in `requirements.txt`.
- `significance.ts` is pure stdlib (no statistical package); `node:test` for tests. No test framework beyond stdlib.
- No dependency in the audit's recommended slice is new.

## Validation Performed

- **Read** (not agent-parroted): `schema.prisma` eval/experiment models; eval migration `...add_evaluation_observability_embedding_tables/migration.sql`; `benchmark.ts` (full), `access.ts`, `significance.ts` (full), `metrics/retrieval.ts`, `metrics/generation.ts`, `actions/evaluation.ts` (full), `regression-run.tsx`, `route.ts`, `evaluation.py`, `factory.py` (run_dataset/build_evaluation_runner), `entry_result.py`, `eval.py`, `evaluate.yml`, `worker.py`, `traces/page.tsx`, `quality-gates.ts` (check/record), `migration-chain.integration.test.ts`, `evaluation-run-security.test.ts`, research page comparison block.
- **Grep-verified:** no `BenchmarkQuestion|BenchmarkResult|ExperimentArtifact|GoldenDataset|QualityGate|Trace|Span` in any migration; mock-marker verification for experiments/model-comparison/leaderboards/analytics; `no evaluate` in `portal.yml`; `no traces/[id]` route exists (glob).
- **Prior full-suite state (reference):** portal `node --import tsx --test src/__tests__/*.test.ts` passed 699/699 on the previous mission; the audit is read-only by directive and touched no code or tests, so no suite was re-run and no behavior changed.
- **Deliberate simplifications noted with `ponytail:` semantics where a shortcut was taken** — none here: every OBSERVED claim above was verified against source or filesystem in this session.

## Conclusion

The evaluation subsystem is a set of real, well-guarded primitives (portal tenancy, per-case persistence, honest retrieval metrics, first-class statistical machinery in `significance.ts`, hardening fixes all verified intact) that are **not productized**: the regression surface is a mock of its own promise, the two evaluation engines never meet, CI gates a surface users cannot see, and the leaderboard actions carry a P0 tenant leak.

Audit verdict: **not yet a product workflow.** Fix P0-1 immediately; execute Slice B (statistical regression comparison on persisted runs, zero schema) as the next product slice; and in the same cycle add the orphan-table migration so `prisma migrate deploy` produces a schema matching the code. Everything else in the finding register (mock surfaces, snapshot completeness, gate wiring, CI drift, dataset versioning, cost/usage capture, red-team) is a known, individually small follow-up.