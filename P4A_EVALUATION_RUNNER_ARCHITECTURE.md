# P4-A: Real Evaluation Runner Architecture Audit

## 1. Executive Summary

Kairos has all the building blocks for a real evaluation runner: a directly importable `RetrievalEngine` that bypasses gRPC, a complete benchmark framework with typed result models, a Prisma schema with all necessary persistence models, and a frontend expecting rich evaluation data. The central gap is that **no code path connects query execution through LLM generation to evaluation metrics**. The existing `BenchmarkRunner` classifies → plans → retrieves → measures recall/precision, but never calls `generate_response`. The evaluation runner must extend this single class by adding a generation step and feeding the result through the existing judging module.

**The answer to "HOW CAN KAIROS TURN GoldenDatasetEntry → real execution → real metrics?" is:**

Construct a `RetrievalEngine` in-process (it has zero gRPC dependency), call its four methods sequentially (`compute_embeddings`, `classify_query`, `execute_retrieval`, `generate_response`), capture the generation output, run it through the existing `CompositeJudge`, and persist results to the existing Prisma models.

---

## 2. Current Evaluation Architecture

### What Exists (VERIFIED BY SOURCE)

| Component | File | Status |
|---|---|---|
| Retrieval metrics (9 functions) | `intelligence/evaluation/ranking_metrics.py` | REAL, mathematically validated |
| Evaluator class | `intelligence/evaluation/evaluator.py` | REAL, works on provided data |
| Ground truth container | `intelligence/evaluation/ground_truth.py` | REAL, serializable |
| Retrieval benchmark harness | `intelligence/evaluation/retrieval_benchmark.py` | REAL, retrieval-only |
| Core benchmark runner | `benchmarks/runner/runner.py` | REAL, classify→plan→retrieve→evaluate |
| Core runner types | `benchmarks/runner/types.py` | REAL, QueryResult + RunnerResult |
| Retriever protocol | `benchmarks/runner/retriever.py` | REAL, Protocol class |
| Dataset loader + QueryEntry | `benchmarks/dataset/loader.py` | REAL, supports EU AI Act + external formats |
| High-level benchmark orchestrator | `intelligence/benchmarks/benchmark_runner.py` | REAL, wraps core runner |
| Experiment tracking | `intelligence/experiments/` | REAL, JSON persistence |
| Ablation framework | `intelligence/ablation/` | REAL, toggles planner components |
| Statistical validation | `intelligence/statistics/` | REAL, research-grade |
| Calibration | `intelligence/calibration/` | REAL, sklearn-based |
| Judging (4 judges) | `intelligence/judging/` | REAL but algorithmic (n-gram overlap) |
| Reporting | `intelligence/reporting/` | REAL, Markdown/HTML/JSON |
| Reproducibility manifests | `intelligence/reporting/reproducibility.py` | REAL, captures git/packages |
| Leaderboard | `intelligence/reporting/leaderboard.py` | REAL, composite scoring |

### What Does NOT Exist

| Component | Status |
|---|---|
| Generation step in evaluation | NOT IMPLEMENTED |
| LLM-as-judge (LLM-based judging) | NOT IMPLEMENTED |
| Per-entry result persistence to DB | NOT IMPLEMENTED |
| Evaluation → trace correlation | NOT IMPLEMENTED |
| Quality gate enforcement | NOT IMPLEMENTED |
| CI/CD evaluation | NOT IMPLEMENTED |
| Cost computation | NOT IMPLEMENTED |

---

## 3. Current Production Query Pipeline

### Architecture (VERIFIED BY SOURCE)

Two-process architecture: Go HTTP gateway → 4 gRPC calls → Python intelligence server.

```
HTTP Client
    ↓
[Go Gateway] query_handler.go:19
    ├── gRPC 1: ComputeEmbeddings → python_client.go:62 (30s)
    ├── Semantic Cache Lookup (Go, cosine sim, threshold 0.85)
    ├── gRPC 2: ClassifyQuery → python_client.go:44 (30s)
    ├── gRPC 3: ExecuteRetrieval → python_client.go:80 (30s)
    ├── gRPC 4: GenerateResponse → python_client.go:100 (90s, capped by 55s parent)
    └── Cache + HTTP Response
```

### Python Pipeline (VERIFIED BY SOURCE)

Each gRPC call delegates to `RetrievalEngine`:

| Method | File:Line | Input | Output |
|---|---|---|---|
| `compute_embeddings(query)` | `engine.py:63` | `str` | `list[float]` |
| `classify_query(query)` | `engine.py:66` | `str` | `dict{query_type, retrieval_type, top_k, rerank, decompose, confidence_score}` |
| `execute_retrieval(namespace, query, top_k, retrieval_type, rerank, decompose)` | `engine.py:143` | `str, str, int, int, bool, bool` | `dict{chunks, used_type, fallback_triggered, escalated_tier_str}` |
| `generate_response(query, chunks)` | `engine.py:239` | `str, list[str]` | `dict{response, prompt_tokens, completion_tokens, model}` |

### Critical Finding: RetrievalEngine Has Zero gRPC Dependency (VERIFIED BY SOURCE)

`engine.py:30-35`:
```python
class RetrievalEngine:
    """Orchestrates retrieval, classification, and planning logic.
    Separated from gRPC concerns so it can be tested independently of the
    transport layer.  The servicer delegates all RPC bodies here.
    """
```

The `IntelligenceServiceServicer` (grpc_server.py:76-148) is a thin gRPC adapter. `RetrievalEngine` is pure Python business logic. **An evaluation runner can construct and call it directly in-process.**

### Engine Construction (VERIFIED BY SOURCE)

`grpc_server.py:224-274` shows exactly how:
1. ChromaStore (HTTP client to ChromaDB)
2. CachedEmbedder wrapping LocalEmbedder (all-MiniLM-L6-v2)
3. ClassifyQuery (Gemini/OpenAI client)
4. SimpleRetriever (ChromaStore + embedder)
5. ComplexRetriever (ChromaStore + embedder + LLM client + CrossEncoder)
6. MultiHopRetriever (ChromaStore + embedder + LLM client)
7. OpenaiLLM or GeminiLLM (LLM client)
8. Circuit breakers for LLM and Chroma
9. All assembled into `RetrievalEngine(...)`

**The evaluation runner needs the same construction, without the gRPC server.**

---

## 4. Exact Generation Entry Point

### Common Interface (VERIFIED BY SOURCE)

Both LLM providers implement `BaseLLM.get_response(query, chunks) -> dict`:

| Provider | File | Method | Returns |
|---|---|---|---|
| OpenAI | `intelligence/llm/openai_llm.py:9` | `get_response(query, chunks)` | `{response, prompt_tokens, completion_tokens, model}` |
| Gemini | `intelligence/llm/gemini_llm.py:9` | `get_response(query, chunks)` | `{response, prompt_tokens, completion_tokens, model}` |

### Prompt Template (VERIFIED BY SOURCE)

`intelligence/llm/llm_prompt.txt`:
```
You are a precise and factual question-answering assistant embedded in a RAG system.
...
Context:
{context}

Query:
{query}
```

Chunks are joined with `"\n".join(chunks)` and injected into `{context}`.

### Provider Selection (VERIFIED BY SOURCE)

`grpc_server.py:338-410`:
- `deployment=true` + groq models → Groq via OpenAI client
- `llm_provider=gemini` → `genai.Client` + `GeminiLLM`
- `llm_provider=openai` → `OpenAI` + `OpenaiLLM`
- `llm_provider=ollama` → OpenAI with custom base_url + `OpenaiLLM`

### What the Evaluation Runner Should Use

**Same `RetrievalEngine.generate_response()` method.** No adapter needed. The engine already abstracts provider selection.

---

## 5. Golden Dataset → Production Query Mapping

### QueryEntry (VERIFIED BY SOURCE)

`benchmarks/dataset/loader.py:41-86`:
```
QueryEntry:
  id: str              # "SIMPLE-001"
  text: str            # "According to Article 3(1)..."
  query_type: str      # "simple" | "complex" | "multi_hop"
  domain: Optional[str]
  expected_chunks: Optional[List[str]]
  corpus_ref: Optional[str]
  expected_articles: Optional[List[str]]
  confidence_category: Optional[str]
  notes: Optional[str]
```

### Mapping to Production Query (VERIFIED BY SOURCE)

A `QueryEntry` maps directly to the production pipeline:
- `entry.text` → `engine.compute_embeddings(entry.text)` → `engine.classify_query(entry.text)` → `engine.execute_retrieval(namespace, entry.text, ...)` → `engine.generate_response(entry.text, chunks)`
- `entry.expected_chunks` → ground truth for recall/precision computation
- `entry.query_type` → used for per-type metric breakdown
- `entry.expected_articles` →可用于 citation accuracy evaluation (if implemented)

### Missing Information

| Field | Available | Gap |
|---|---|---|
| Namespace | NO | Must be provided as run configuration (not per-entry) |
| Model/provider | NO | Must be provided as run configuration |
| Prompt version | NO | Must be provided as run configuration |
| Temperature | NO | Must be provided as run configuration |
| Max tokens | NO | Must be provided as run configuration |
| Expected answer | NO | `QueryEntry` has no `expectedAnswer` field (only `expected_chunks`) |
| Expected citations | PARTIAL | `expected_articles` exists but is article-level, not citation-level |

**Key gap: `QueryEntry` lacks `expectedAnswer`.** The Prisma `BenchmarkQuestion` model has `expectedAnswer` and `expectedContext`. The `GoldenDatasetEntry` has `expectedAnswer` and `expectedCitations`. But the Python `QueryEntry` used by the benchmark runner does not.

---

## 6. Experiment Configuration

### Existing Experiment Model (VERIFIED BY SOURCE)

`intelligence/experiments/models.py`:
```
ExperimentParameters:
  planner_enabled, calibration_enabled, feedback_enabled, optimization_enabled,
  dataset_name, dataset_version, query_types, classifier_name, retriever_name,
  failure_threshold, recovery_timeout, calibrator_type, optimizer_min_samples,
  provider_timeout_seconds, extra: Dict[str, str]
```

### What's Missing from ExperimentParameters

| Field | Present | Needed for Eval Runner |
|---|---|---|
| model/provider | NO | YES |
| prompt version | NO | YES |
| temperature | NO | YES |
| max_tokens | NO | YES |
| embedding_model | NO | YES |
| reranker | NO | YES |
| namespace | NO | YES |
| judge configuration | NO | YES |
| cost | NO | YES |

### Prisma Experiment Model (VERIFIED BY SOURCE)

The Prisma `Experiment` model (schema.prisma:401-446) already has:
- `embeddingModel`, `retriever`, `reranker`, `llm`, `promptTemplate`, `chunkStrategy`, `chunkSize`, `chunkOverlap`, `topK`, `similarityThreshold`, `retrievalMode`

This is richer than the Python `ExperimentParameters`. **The Prisma model is the better source of truth for run configuration.**

### Recommendation

The evaluation runner should use a **RunConfiguration** dataclass that maps to both the Prisma `Experiment.configSnapshot` JSON field and the Python `ExperimentParameters`. This avoids duplicating the model.

---

## 7. Evaluation Data Model

### Prisma Models (VERIFIED BY SOURCE)

| Model | Purpose | Key Fields |
|---|---|---|
| `BenchmarkDataset` | Dataset versioning | name, version, knowledgeBaseId, parentVersionId |
| `BenchmarkQuestion` | Per-question ground truth | question, expectedAnswer, expectedContext, referenceDocId |
| `BenchmarkResult` | Per-question execution result | retrievedChunkIds, generatedAnswer, promptUsed, retrievalMetrics, generationMetrics, latency*Ms, configSnapshot |
| `BenchmarkRun` | Aggregate run | configSnapshot, aggregatedMetrics, datasetId, status, startedAt, completedAt |
| `Experiment` | A/B experiment | configA, configB, knowledgeBaseId, datasetId, all retrieval params |
| `ExperimentRun` | Per-query experiment execution | query, retrievedChunks, metrics, debug, latency* |
| `QualityGate` | Gate definition | conditions (JSON), enabled |
| `QualityGateResult` | Gate execution result | passed, results, score, evaluationRunId |
| `GoldenDataset` | Curated dataset | difficulty, version, entries |
| `GoldenDatasetEntry` | Curated entry | question, expectedAnswer, expectedCitations, context |
| `LeaderboardEntry` | Scored entity | entity, type, score, metrics, rank |

### What Already Works

- `BenchmarkRun` + `BenchmarkResult` together represent a complete evaluation run with per-question results
- `BenchmarkDataset` + `BenchmarkQuestion` represent a versioned dataset
- `Experiment` + `ExperimentRun` represent A/B testing
- `QualityGate` + `QualityGateResult` represent quality gates

### Missing Relationships

| Gap | Impact |
|---|---|
| No FK from `BenchmarkRun` to `Experiment` | Cannot link a benchmark run to its experiment configuration |
| No `judgeMetrics` field on `BenchmarkResult` | Judging scores have no home (retrievalMetrics + generationMetrics exist, but judge results don't fit neatly) |
| No `cost` field on `BenchmarkResult` | Cost per question not tracked |
| No `traceId` field on `BenchmarkResult` | Cannot correlate to traces |

---

## 8. Context Capture

### What Must Be Captured Per Question

| Field | Available from Production Pipeline | Persisted in Prisma |
|---|---|---|
| Query | YES (entry.text) | YES (BenchmarkQuestion.question) |
| Retrieved chunks | YES (engine.execute_retrieval returns chunks) | YES (BenchmarkResult.retrievedChunks) |
| Chunk IDs | PARTIAL (SimpleRetriever returns text, not IDs) | YES (BenchmarkResult.retrievedChunkIds) |
| Retrieval scores | NO (SimpleRetriever returns text only) | NO |
| Retrieval strategy | YES (engine.execute_retrieval returns used_type) | PARTIAL (in configSnapshot) |
| Reranker results | YES (if rerank=True, final order is reranked) | NO (only final order captured) |
| Assembled context | NO (not explicitly captured) | NO (but can be reconstructed from chunks) |
| System prompt | YES (loaded from llm_prompt.txt) | YES (BenchmarkResult.promptUsed) |
| User prompt | YES (query + context interpolation) | NO (but can be reconstructed) |
| Model | YES (LLM response includes model) | NO (not in BenchmarkResult) |
| Provider | YES (known from construction) | NO |
| Generation parameters | NO (temperature, max_tokens not tracked) | NO |
| Response | YES (engine.generate_response returns response) | YES (BenchmarkResult.generatedAnswer) |
| Token usage | YES (prompt_tokens, completion_tokens) | PARTIAL (BenchmarkResult.tokensUsed as single int) |
| Latency | YES (LatencyRecord per phase) | YES (BenchmarkResult.latency*Ms) |
| Errors | YES (FailureRecord) | YES (BenchmarkResult has no error field, but ExperimentRun does) |

---

## 9. Trace Correlation

### Current State: NOT IMPLEMENTED

The production pipeline has:
- Go gateway generates W3C TraceContext (`traceparent` header) in middleware/tracing.go:25-60
- Trace ID injected into gRPC metadata via `injectTraceContext()` in python_client.go:18
- Python side: custom `Tracer` exists but is unused in production
- Prometheus metrics are recorded but not linked to individual traces

### What's Needed

The smallest missing correlation mechanism: a `traceId` field on `BenchmarkResult` that the evaluation runner generates (UUID) and passes through as a context variable. This is independent of the production tracing system and provides eval-level traceability.

---

## 10. Error Handling

### Existing Patterns (VERIFIED BY SOURCE)

| Error Type | Production Behavior | Eval Runner Should |
|---|---|---|
| Dataset malformed | N/A | Validate at load time, reject entry |
| Retrieval failure | Fallback to BM25 (SimpleRetriever) or empty (ComplexRetriever) | Record failure, continue with empty chunks |
| Embedding failure | Exception propagates → gRPC UNAVAILABLE | Record failure, mark entry failed, continue |
| Reranker failure | Returns empty (CrossEncoderReranker) | Record failure, continue with pre-rerank order |
| LLM timeout | Circuit breaker opens after 5 failures | Record failure, mark entry failed, continue |
| LLM provider error | Exception propagates → gRPC INTERNAL | Record failure, mark entry failed, continue |
| LLM malformed response | Exception propagates | Record failure, mark entry failed, continue |
| Evaluation metric failure | N/A (metrics are pure math) | Should not fail; log and continue |
| Database failure | N/A (Python eval has no DB) | Log warning, continue without persistence |

### Recommended Policy

**Mark-and-continue.** A single bad dataset entry should NOT abort the complete run. Record the failure in `FailureRecord`, set the entry's result as failed, and continue with remaining entries. Persist partial results.

---

## 11. Concurrency Architecture

### Execution Shape Analysis

| Scale | Entries | Estimated Time (sequential) | Bottleneck |
|---|---|---|---|
| Small | 10 | ~2-5 min | LLM calls (~2-5s each) |
| Medium | 100 | ~20-50 min | LLM calls + embedding |
| Large | 1,000 | ~3-8 hours | LLM API rate limits |
| Very Large | 10,000 | ~30-80 hours | LLM API rate limits, cost |

### Recommended Architecture

**Sequential with bounded concurrency for LLM calls.** The existing `BenchmarkRunner.run_all()` is sequential (line 194-214 of runner.py). This is correct for correctness (deterministic ordering). For scale, the evaluation runner should:

1. Execute sequentially by default (matches existing pattern)
2. Optionally support bounded concurrency for independent operations (embedding, retrieval)
3. NOT use queue-based or workflow-based execution (over-engineering for current scale)
4. Use the existing `ThreadPoolExecutor(max_workers=50)` pattern from grpc_server.py for embedding batching

---

## 12. Reproducibility

### What Must Be Frozen

| Artifact | Current Support | Gap |
|---|---|---|
| Dataset version | Prisma `BenchmarkDataset.version` | Need Python loader to accept version |
| Dataset entry | `QueryEntry.id` | OK |
| Prompt version | NOT IMPLEMENTED | Must be added to RunConfiguration |
| Model | NOT in Python eval | Must be added to RunConfiguration |
| Provider | NOT in Python eval | Must be added to RunConfiguration |
| Model parameters | NOT in Python eval | Must be added to RunConfiguration |
| Retrieval strategy | `PlannerDecision.config` | OK (captured in QueryResult) |
| top_k | `PlannerDecision.config["top_k"]` | OK |
| Embedding model | Hardcoded `all-MiniLM-L6-v2` | OK for now, but should be configurable |
| Reranker | Hardcoded `cross-encoder/ms-marco-MiniLM-L6-v2` | OK for now |
| Judge configuration | NOT IMPLEMENTED | Must be added |
| Application commit | `reproducibility.py` captures git hash | OK |
| Package versions | `reproducibility.py` captures pip freeze | OK |

---

## 13. Cost Architecture

### What's Tracked Now

- Token counts: `prompt_tokens` and `completion_tokens` from LLM response (engine.py:244-245)
- Single `tokensUsed` int on Prisma `ExperimentRun`
- `cost` float on Prisma `ExperimentRun` (but not computed by Python)

### What's Needed

Cost = (input_tokens × input_price) + (output_tokens × output_price) per provider. The evaluation runner should:
1. Capture token counts per question (already available from `generate_response`)
2. Look up provider pricing from a static table
3. Compute per-question and aggregate cost
4. Persist to `BenchmarkResult` (new field needed) and `BenchmarkRun.aggregatedMetrics`

---

## 14. Security / Tenant Isolation

### Current Isolation (VERIFIED BY SOURCE + TEST)

- Namespace validation: `^[a-zA-Z0-9]+$`, max 63 chars (middleware/namespace.go:26)
- ChromaDB collection per namespace (P2/P3 tests verified)
- BM25 index per namespace (P2/P3 tests verified)
- Auth via `X-Secret` header with timing-safe comparison (middleware/auth.go:21)

### Evaluation Runner Isolation

The evaluation runner operates on a single namespace (provided as run configuration). Since it constructs `RetrievalEngine` in-process and passes the namespace explicitly, tenant isolation is preserved by construction. No cross-tenant data leakage is possible as long as the namespace parameter is validated.

**Cross-tenant evaluation access: NOT A RISK** if the runner is invoked with a single namespace per run.

---

## 15. API / SDK / CLI Boundary

### Who Should Initiate

- **Internal Python service:** For automated benchmarks, CI/CD
- **CLI:** For developer-initiated evaluations (`kairos eval run --dataset eu_ai_act --model gpt-4o`)
- **Portal server action:** For UI-triggered evaluations (future)

### Who Should Execute

- **Python intelligence service:** In-process `RetrievalEngine` construction. No Go gateway or gRPC needed.

### Who Should Store

- **Prisma via Next.js API routes:** For portal-visible results
- **JSON files via ExperimentStore:** For Python-side persistence (existing pattern)

### Who Should Observe

- **Prometheus:** For operational metrics (already wired)
- **Telemetry JSONL:** For structured event logging (already wired)
- **Portal UI:** For visualization (existing pages)

### Who Should Retrieve Results

- **Portal UI:** Via Prisma queries
- **CLI:** Via Python ExperimentRegistry
- **API:** Via REST endpoints

---

## 16. Existing UI Compatibility

### Pages That Already Expect Evaluation Data (VERIFIED BY SOURCE)

| Page | Route | Data Shape | Gap |
|---|---|---|---|
| Experiment Studio | `/app/experiments` | `ExperimentMetrics` (14 fields) | Returns `[]` currently |
| Datasets | `/app/datasets` | `GoldenDatasetInfo` + `GoldenDatasetEntryInfo` | Works with Prisma |
| Leaderboards | `/app/leaderboards` | `LeaderboardEntry` (mock data) | Server-side `generateLeaderboard()` exists |
| Quality Gates | `/app/quality-gates` | `QualityGateInfo` + `QualityGateResultInfo` | Works with Prisma |
| Benchmark Explorer | `/app/benchmark-explorer` | `BenchmarkRun` with `aggregatedMetrics` | Needs data source |
| Regression | `/app/regression` | `RegressionTestRun` (mock data) | Entirely mock |

### Can the Evaluation Runner Feed Existing UI?

**YES, with one mapping layer.** The Python backend produces `AggregateEvaluation` with keys like `mean_recall`, `mean_precision`, etc. The frontend expects `ExperimentMetrics` with keys like `recallAtK`, `precisionAtK`, `faithfulness`, etc. A mapping function `evaluation_to_experiment_metrics()` would convert between these formats. The generation quality metrics (faithfulness, etc.) would come from the judging module.

---

## 17. Framework Analysis

### Reconfirmed: NOT JUSTIFIED

| Framework | Functionality | Kairos Equivalent | Verdict |
|---|---|---|---|
| LangChain | Chain abstraction | `RetrievalEngine` is already a chain | NOT NEEDED |
| LangGraph | State machine for multi-step | Sequential function calls suffice | NOT NEEDED |
| LangSmith | Tracing + evaluation | Prometheus + Telemetry + custom judging | NOT NEEDED |

The evaluation runner is a simple sequential loop: for each entry, call the engine, capture output, evaluate, persist. No graph orchestration, no chain abstraction, no external tracing service needed.

---

## 18. Target Architecture

```
Golden Dataset (QueryEntry from loader or BenchmarkQuestion from Prisma)
      ↓
Run Configuration (namespace, model, provider, prompt, judge config)
      ↓
Evaluation Runner (NEW: extends BenchmarkRunner pattern)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ For each entry:                                              │
│   1. engine.compute_embeddings(entry.text)                   │
│   2. engine.classify_query(entry.text)                       │
│   3. engine.execute_retrieval(namespace, entry.text, ...)    │
│   4. engine.generate_response(entry.text, chunks)  ← NEW    │
│   5. composite_judge.evaluate(query, answer, context) ← NEW │
│   6. Build EvaluationEntryResult                             │
└─────────────────────────────────────────────────────────────┘
      ↓
Metrics Computation (EXISTING: Evaluator + ranking_metrics + judging/scoring)
      ↓
Persistence (EXISTING: Prisma BenchmarkRun + BenchmarkResult)
      ↓
Quality Gate Check (EXISTING: QualityGate conditions)
      ↓
UI Visualization (EXISTING: Experiment Studio, Leaderboards, Benchmark Explorer)
```

### Component Reuse Matrix

| Component | Current | Reuse? | Adapter? | Why |
|---|---|---|---|---|
| `RetrievalEngine` | `intelligence/server/engine.py` | **YES** | No | Direct import, zero gRPC dependency |
| `ClassifyQuery` | `intelligence/classifier/query_classifier.py` | **YES** | No | Used by engine internally |
| `SimpleRetriever` | `intelligence/retrieval/simple_retriever.py` | **YES** | No | Used by engine internally |
| `ComplexRetriever` | `intelligence/retrieval/complex_retriever.py` | **YES** | No | Used by engine internally |
| `MultiHopRetriever` | `intelligence/retrieval/multihop_retriever.py` | **YES** | No | Used by engine internally |
| `CrossEncoderReranker` | `intelligence/reranker/cross_encoder_reranker.py` | **YES** | No | Used by ComplexRetriever internally |
| `OpenaiLLM` / `GeminiLLM` | `intelligence/llm/` | **YES** | No | Used by engine internally |
| `Evaluator` | `intelligence/evaluation/evaluator.py` | **YES** | No | Computes retrieval metrics from provided data |
| `ranking_metrics` | `intelligence/evaluation/ranking_metrics.py` | **YES** | No | Pure math functions |
| `GroundTruth` / `GroundTruthEntry` | `intelligence/evaluation/ground_truth.py` | **YES** | No | Generic container |
| `CompositeJudge` | `intelligence/judging/judge.py` | **YES** | No | Orchestrates multiple judges |
| `FaithfulnessJudge` | `intelligence/judging/faithfulness.py` | **YES** | No | Algorithmic (n-gram) |
| `HallucinationJudge` | `intelligence/judging/hallucination.py` | **YES** | No | Algorithmic |
| `GroundingJudge` | `intelligence/judging/grounding.py` | **YES** | No | Algorithmic |
| `RelevanceJudge` | `intelligence/judging/relevance.py` | **YES** | No | Algorithmic |
| `ExperimentTracker` | `intelligence/experiments/tracker.py` | **YES** | No | Context manager for runs |
| `ExperimentRegistry` | `intelligence/experiments/registry.py` | **YES** | No | Query/filter runs |
| `ExperimentStore` | `intelligence/experiments/persistence.py` | **YES** | No | JSON file persistence |
| `generate_experiment_manifest` | `intelligence/reporting/reproducibility.py` | **YES** | No | Captures git/packages |
| `BenchmarkRunner` | `benchmarks/runner/runner.py` | **YES** | Minor extension | Add generation step |
| `QueryEntry` | `benchmarks/dataset/loader.py` | **YES** | Minor extension | Add `expectedAnswer` field |
| `QueryResult` | `benchmarks/runner/types.py` | **YES** | Minor extension | Add generation + judge fields |
| `RunnerResult` | `benchmarks/runner/types.py` | **YES** | No | Already aggregates correctly |

### What's NEW

| Component | Why |
|---|---|
| `EvaluationRunner` class | Orchestrates the full pipeline: classify → plan → retrieve → generate → judge → persist |
| `EvaluationEntryResult` dataclass | Per-entry result with generation output + judge scores |
| `RunConfiguration` dataclass | Captures namespace, model, provider, prompt, judge config |
| `evaluation_to_experiment_metrics()` | Maps Python metrics to frontend `ExperimentMetrics` format |
| `_build_eval_engine()` | Constructs `RetrievalEngine` without gRPC server overhead |

---

## 19. Reusable Components

All components listed in Section 18 Reuse Matrix are directly reusable without modification. The type system is already unified around `QueryEntry`, `QueryResult`, `RunnerResult`, and `ExperimentRun`.

---

## 20. Required New Components

| # | Component | Reason | Dependencies |
|---|---|---|---|
| 1 | `EvaluationRunner` class | Orchestrates end-to-end evaluation | RetrievalEngine, CompositeJudge, Evaluator |
| 2 | `EvaluationEntryResult` dataclass | Per-entry result with generation + judging | None |
| 3 | `RunConfiguration` dataclass | Frozen config for reproducibility | None |
| 4 | `_build_eval_engine()` function | Constructs engine without gRPC | Same deps as grpc_server.py:224-274 |
| 5 | `evaluation_to_experiment_metrics()` | Maps Python metrics to frontend format | None |

---

## 21. Required Schema Changes

### Must Change

| Model | Change | Reason |
|---|---|---|
| `BenchmarkResult` | Add `judgeMetrics Json?` | Store faithfulness, hallucination, grounding, relevance scores |
| `BenchmarkResult` | Add `cost Float?` | Per-question cost tracking |
| `BenchmarkResult` | Add `model String?` | Track which model answered |
| `BenchmarkRun` | Add `judgeConfig Json?` | Frozen judge configuration for reproducibility |
| `BenchmarkRun` | Add `promptVersion String?` | Prompt version tracking |

### Should Change

| Model | Change | Reason |
|---|---|---|
| `BenchmarkResult` | Add `traceId String?` | Correlation to traces |
| `BenchmarkRun` | Add `experimentId String?` | Link run to experiment |
| `GoldenDatasetEntry` | Add `difficulty String?` | Align with QueryEntry.confidence_category |

### Optional

| Model | Change | Reason |
|---|---|---|
| `BenchmarkResult` | Add `retrievalScores Json?` | Per-chunk retrieval scores |

---

## 22. Required API Changes

### Must Change

| Endpoint | Change | Reason |
|---|---|---|
| `POST /api/v1/evaluation/evaluate` | Accept `RunConfiguration` + return full `EvaluationRunResult` | Current endpoint only computes retrieval metrics on provided arrays |

### Should Change

| Endpoint | Change | Reason |
|---|---|---|
| `GET /api/v1/evaluation/ground-truth` | Persist entries across requests | Currently creates new `GroundTruth()` per request |

### Optional

| Endpoint | Change | Reason |
|---|---|---|
| New: `POST /api/v1/evaluation/run` | Trigger evaluation run | For UI-initiated evaluations |

---

## 23. Implementation Sequence

### P4-A.1: RunConfiguration + Engine Builder
- Create `RunConfiguration` dataclass
- Create `_build_eval_engine()` function (extract from grpc_server.py)
- **Files:** New file `intelligence/evaluation/run_config.py`, modify `intelligence/server/grpc_server.py` (extract builder)
- **Tests:** Unit test for config serialization, integration test for engine construction

### P4-A.2: EvaluationEntryResult + Extended QueryResult
- Create `EvaluationEntryResult` dataclass with generation + judge fields
- Extend `QueryResult` (or create new type) to include generated answer, judge scores, cost
- **Files:** New file `intelligence/evaluation/entry_result.py`
- **Tests:** Unit test for dataclass construction and serialization

### P4-A.3: EvaluationRunner Core Loop
- Create `EvaluationRunner` class that iterates entries, calls engine, captures results
- Extend `BenchmarkRunner.run_query()` pattern with generation + judging steps
- **Files:** New file `intelligence/evaluation/runner.py`
- **Tests:** Integration test with mocked LLM, real ChromaDB

### P4-A.4: Metrics Mapping
- Create `evaluation_to_experiment_metrics()` function
- Map Python metric names to frontend `ExperimentMetrics` format
- **Files:** New file `intelligence/evaluation/metrics_mapping.py`
- **Tests:** Unit test with known input/output pairs

### P4-A.5: Persistence Layer
- Write `EvaluationEntryResult` to Prisma `BenchmarkResult` via API route
- Write `RunConfiguration` to `BenchmarkRun.configSnapshot`
- **Files:** New or modified API route in `intelligence/api/routes/evaluation.py`
- **Tests:** Integration test with database

### P4-A.6: Judge Integration
- Wire `CompositeJudge` into `EvaluationRunner`
- Capture judge scores in `EvaluationEntryResult`
- **Files:** Modify `intelligence/evaluation/runner.py`
- **Tests:** Unit test with known answers

### P4-A.7: Cost Computation
- Add provider pricing table
- Compute per-question cost from token counts
- **Files:** New file `intelligence/evaluation/cost.py`
- **Tests:** Unit test with known token counts and prices

### P4-A.8: Quality Gate Integration
- After run completes, evaluate `QualityGate` conditions against `aggregatedMetrics`
- **Files:** New file `intelligence/evaluation/quality_gate.py`
- **Tests:** Unit test with pass/fail scenarios

### P4-A.9: Integration Tests
- End-to-end test: dataset → engine → generation → judging → persistence
- **Files:** New file `tests/test_evaluation_runner.py`
- **Tests:** Full pipeline with mocked LLM

### P4-A.10: CLI Command
- `kairos eval run --dataset <name> --model <model> --provider <provider>`
- **Files:** New file `scripts/eval.py`
- **Tests:** CLI invocation test

---

## 24. Test Strategy

### Unit Tests

| Test | What It Validates |
|---|---|
| `test_run_configuration` | Config serialization, defaults, validation |
| `test_evaluation_entry_result` | Dataclass construction, serialization |
| `test_metrics_mapping` | Python → frontend metric name mapping |
| `test_cost_computation` | Token count × price calculation |
| `test_quality_gate_evaluation` | Pass/fail against thresholds |

### Integration Tests

| Test | What It Validates |
|---|---|
| `test_engine_construction` | `_build_eval_engine()` creates valid engine |
| `test_evaluation_runner_with_mock_llm` | Full pipeline with mocked LLM responses |
| `test_evaluation_runner_with_real_chroma` | Pipeline with real ChromaDB (ephemeral) |
| `test_persistence_roundtrip` | Write → read from Prisma |
| `test_judge_integration` | CompositeJudge produces scores |

### End-to-End Tests

| Test | What It Validates |
|---|---|
| `test_full_pipeline_e2e` | Dataset → engine → generation → judging → metrics → persistence |
| `test_partial_failure_handling` | One entry fails, others succeed |
| `test_reproducibility` | Same config produces same results |

### Failure Tests

| Test | What It Validates |
|---|---|
| `test_llm_timeout_handling` | Entry marked failed, run continues |
| `test_chroma_unavailable_handling` | Falls back to BM25 |
| `test_malformed_dataset_handling` | Invalid entry rejected at load time |

### Performance Tests

| Test | What It Validates |
|---|---|
| `test_10_entries_completes` | Sanity check |
| `test_latency_per_entry` | Per-entry latency within bounds |

---

## 25. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM cost per evaluation | HIGH | MEDIUM | Configurable entry limit, cost cap |
| LLM non-determinism | MEDIUM | LOW | Seed where possible, measure variance |
| ChromaDB unavailability | LOW | HIGH | BM25 fallback (already implemented) |
| Schema migration needed | HIGH | LOW | Additive changes only (new nullable fields) |
| Frontend format mismatch | MEDIUM | MEDIUM | Mapping function in P4-A.4 |
| Judge quality insufficient | MEDIUM | MEDIUM | Start with algorithmic judges, add LLM judge later |

---

## 26. Rollback Strategy

Each implementation step is independently deployable:

| Step | Rollback |
|---|---|
| P4-A.1 (Config + Engine Builder) | Remove new files, no schema change |
| P4-A.2 (Entry Result) | Remove new files, no schema change |
| P4-A.3 (Runner Core) | Remove new files, no schema change |
| P4-A.4 (Metrics Mapping) | Remove new files, no schema change |
| P4-A.5 (Persistence) | Revert API route changes, revert schema migration |
| P4-A.6 (Judge Integration) | Remove judge wiring from runner |
| P4-A.7 (Cost) | Remove cost computation |
| P4-A.8 (Quality Gates) | Remove gate evaluation |
| P4-A.9 (Tests) | Remove test files |
| P4-A.10 (CLI) | Remove script |

Schema changes are additive (nullable fields only) and backward-compatible.

---

## 27. Explicit NOT IMPLEMENTED

| Component | Status | Phase |
|---|---|---|
| LLM-as-Judge (LLM-based judging) | NOT IMPLEMENTED | Future P4-B |
| End-to-end evaluation with real LLM judge | NOT IMPLEMENTED | Future P4-B |
| Prompt versioning | NOT IMPLEMENTED | Future P4-F |
| CI/CD evaluation | NOT IMPLEMENTED | Future P4-G |
| Trace ↔ evaluation correlation | NOT IMPLEMENTED | Future P4-C |
| Automated quality gate enforcement | NOT IMPLEMENTED | Future P4-D |
| Cross-tenant evaluation isolation testing | NOT IMPLEMENTED | Future audit |
| Dataset versioning in Python loader | NOT IMPLEMENTED | Future P4-E |
| Retrieval score capture | NOT IMPLEMENTED | Future enhancement |
| Reranker order capture | NOT IMPLEMENTED | Future enhancement |

---

## P4-A STATUS

| Item | Status |
|---|---|
| opencode.md | READ, MANDATORY |
| Current branch | main |
| Current HEAD | 07af599c |
| Pre-existing changes | 70+ files (untouched, immutable) |
| Evaluation entry point | `intelligence.evaluation.retrieval_benchmark.run_retrieval_benchmark` (retrieval-only) |
| Production query entry point | `intelligence.server.engine.RetrievalEngine` (directly importable) |
| Generation entry point | `RetrievalEngine.generate_response()` → `BaseLLM.get_response()` |
| Golden dataset mapping | `QueryEntry.text` → engine pipeline; `expected_chunks` for recall/precision |
| Experiment configuration | Prisma `Experiment` model (richer than Python `ExperimentParameters`) |
| Evaluation data model | Prisma `BenchmarkRun` + `BenchmarkResult` (need `judgeMetrics`, `cost`, `model` fields) |
| Context capture | MOSTLY AVAILABLE (chunks, response, tokens, latency); MISSING (retrieval scores, model, cost) |
| Trace correlation | NOT IMPLEMENTED (need `traceId` on `BenchmarkResult`) |
| Error handling | Pattern exists (mark-and-continue recommended) |
| Concurrency | Sequential (existing pattern); bounded concurrency optional |
| Reproducibility | PARTIAL (git/packages OK; prompt/model versioning MISSING) |
| Cost | PARTIAL (tokens tracked; price computation MISSING) |
| Security | VERIFIED — namespace isolation by construction |
| API boundary | Python in-process (no Go/gRPC needed) |
| SDK boundary | Future CLI command |
| CLI boundary | `kairos eval run` (future) |
| UI compatibility | YES — existing pages expect `ExperimentMetrics` format |
| Reusable components | 20+ components directly reusable, zero adapters needed |
| Required new components | 5 (EvaluationRunner, EntryResult, RunConfig, engine builder, metrics mapping) |
| Schema changes | 5 additive nullable fields on BenchmarkResult + BenchmarkRun |
| API changes | 1 endpoint modification + 1 new endpoint |
| Framework decision | NOT JUSTIFIED |
| P0 | 1 (generation step in evaluation) |
| P1 | 2 (judge integration, quality gate enforcement) |
| P2 | 4 (cost, trace correlation, prompt versioning, CI) |
| P3 | 2 (leaderboard data source, regression automation) |
| Target architecture | DESIGNED — RetrievalEngine in-process + CompositeJudge + Prisma persistence |
| Implementation sequence | 10 steps (P4-A.1 through P4-A.10) |
| Test strategy | Unit + integration + E2E + failure + performance |
| Risks | 5 identified (cost, non-determinism, ChromaDB, schema, format) |
| Rollback | Each step independently reversible |
| Report | COMPLETE |
| Commit | PENDING |
| Push | PENDING |
| Working tree | CLEAN (no source modifications) |
