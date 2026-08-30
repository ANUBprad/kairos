# P4: Production AI Evaluation Architecture Audit

## 1. Executive Summary

Kairos has a **well-built retrieval evaluation infrastructure** with mathematically validated metrics, real benchmark harnesses, golden datasets, experiment tracking, statistical validation, and reproducibility manifests. However, it has **critical gaps** that prevent it from being a production AI evaluation system:

**The system can measure whether retrieved documents are relevant, but cannot measure whether the generated answer is correct.**

### Key Findings

| Area | Status | Severity |
|---|---|---|
| Retrieval metrics | Fully implemented, mathematically validated | None |
| Golden datasets | 180 labeled entries + 287 synthetic | None |
| Experiment tracking | Real, persistent, reproducible | None |
| Statistical validation | Research-grade (t-test, Wilcoxon, bootstrap, effect sizes) | None |
| LLM-as-Judge | **NOT IMPLEMENTED** — all judges are algorithmic n-gram overlap | P1 |
| End-to-end evaluation | **NOT IMPLEMENTED** — evaluation stops at retrieval, never reaches generation | P0 |
| Quality gates | **NOT IMPLEMENTED** — no deployment-blocking mechanism | P1 |
| CI/CD evaluation | **NOT IMPLEMENTED** — no GitHub Actions workflows exist | P2 |
| Trace↔evaluation correlation | **NOT IMPLEMENTED** — can't link eval failures to production traces | P1 |
| Observability↔evaluation | **DISCONNECTED** — custom tracing system unused in production | P2 |
| Cost tracking per evaluation | **NOT IMPLEMENTED** | P2 |
| Framework integration | NOT JUSTIFIED | None |

---

## 2. Current Architecture

### End-to-End Request Flow (VERIFIED BY SOURCE)

```
CLIENT HTTP POST /v1/query {"query":"..."}
  ↓
GATEWAY MIDDLEWARE (Recover → CORS → Tracing → Logging → Auth → Namespace → RateLimit)
  ↓
QUERY HANDLER (query_handler.go:19)
  ├─ ComputeEmbeddings → gRPC → Python LocalEmbedder (all-MiniLM-L6-v2)
  ├─ Semantic Cache Lookup (cosine similarity, threshold 0.85)
  ├─ ClassifyQuery → gRPC → Python ClassifyQuery (LLM-based, Gemini/OpenAI)
  ├─ ExecuteRetrieval → gRPC → Python RetrievalEngine
  │   ├─ HYBRID: SimpleRetriever (Dense + BM25 + RRF)
  │   ├─ MULTI_VECTOR: ComplexRetriever (HyDE + SubQuery + MMR + CrossEncoder)
  │   └─ SELF_QUERYING: MultiHopRetriever (iterative LLM-guided)
  ├─ FallbackManager.evaluate() → escalation if insufficient chunks
  ├─ GenerateResponse → gRPC → Python LLM (OpenAI/Gemini/Ollama/Groq)
  └─ Cache + Respond
```

**Prometheus metrics** active in production via gRPC interceptor and engine instrumentation.

**Telemetry collector** writes structured JSONL to `telemetry/retrieval_YYYY-MM-DD.jsonl`.

### Observation Layers

| Layer | Library | Production Active | Connected to Eval |
|---|---|---|---|
| Prometheus metrics | `prometheus_client` | YES | NO |
| Telemetry collector | Custom JSONL | YES | NO |
| Custom Tracer | Custom (no OTel) | NO (tests only) | NO |
| EventLogger | Custom | NO (dashboard sim) | NO |
| MetricsRegistry | Custom | NO (dashboard sim) | NO |
| Alerting | Custom | NO (dashboard sim) | NO |
| PerformanceMonitor | Custom | NO (dashboard sim) | NO |
| Correlation IDs | `contextvars` | YES (in logs) | NO |

---

## 3. Evaluation Architecture

### What Exists (VERIFIED BY SOURCE + TEST)

#### 3A. Retrieval Metrics — FULLY IMPLEMENTED

**File:** `intelligence/evaluation/ranking_metrics.py`

| Metric | Function | Deterministic | Tested |
|---|---|---|---|
| Reciprocal Rank | `reciprocal_rank()` | Yes | Yes |
| MRR | `mean_reciprocal_rank()` | Yes | Yes |
| Average Precision | `average_precision()` | Yes | Yes |
| MAP | `mean_average_precision()` | Yes | Yes |
| DCG | `discounted_cumulative_gain()` | Yes | Yes |
| NDCG | `normalized_dcg()` | Yes | Yes |
| Hit Rate | `hit_rate()` | Yes | Yes |
| Precision@K | `precision_at_k()` | Yes | Yes |
| Recall@K | `recall_at_k()` | Yes | Yes |

All metrics validated by 111 tests in `tests/test_metrics_correctness.py` with independently computed expected values.

#### 3B. Calibration Metrics — FULLY IMPLEMENTED

**File:** `intelligence/calibration/calibration_metrics.py`

| Metric | Function | Deterministic | Tested |
|---|---|---|---|
| ECE | `compute_ece()` | Yes | Yes |
| MCE | `compute_mce()` | Yes | Yes |
| Brier Score | `compute_brier_score()` | Yes | Yes |
| Reliability Diagram | `compute_reliability_diagram()` | Yes | Yes |

Platt scaling and isotonic regression via sklearn with `random_state=42`.

#### 3C. Judging Metrics — IMPLEMENTED BUT ALGORITHMIC

**File:** `intelligence/judging/` (6 files)

| Judge | Algorithm | LLM Dependency | Deterministic |
|---|---|---|---|
| FaithfulnessJudge | N-gram overlap (3-gram) | None | Yes |
| HallucinationJudge | Sentence claims + trigram matching | None | Yes |
| GroundingJudge | Word overlap + quote detection | None | Yes |
| RelevanceJudge | Token overlap | None | Yes |
| CompositeJudge | Weighted aggregation | None | Yes |

**CRITICAL: None of these call an LLM.** They are heuristic/rule-based scorers. Despite the "judge" naming, this is NOT LLM-as-judge.

#### 3D. Evaluator — FULLY IMPLEMENTED

**File:** `intelligence/evaluation/evaluator.py`

`Evaluator.evaluate()` takes batch results + ground truth, computes all ranking metrics, returns `AggregateEvaluation` with per-query results and aggregate statistics.

#### 3E. Benchmark Harness — FULLY IMPLEMENTED

**File:** `intelligence/evaluation/retrieval_benchmark.py`

`run_retrieval_benchmark(retriever_fn, ground_truth, top_k)` iterates ground truth entries, calls a user-supplied retriever function, evaluates results. **Stops at retrieval — no LLM generation step.**

#### 3F. Experiment Tracking — FULLY IMPLEMENTED

**Files:** `intelligence/experiments/` (5 files)

- `ExperimentTracker`: context manager for runs with metrics, parameters, artifacts
- `ExperimentRegistry`: query/rank/filter runs
- `ExperimentStore`: JSON file persistence (`experiments/registry.json`, `experiments/run_{id}.json`)
- `compare_runs()`: metric deltas with statistical validation

#### 3G. Statistical Validation — RESEARCH-GRADE

**Files:** `intelligence/statistics/` (5 files)

- Paired t-test, Wilcoxon signed-rank, permutation test
- Bootstrap CI, t-distribution CI
- Cohen's d, Cliff's delta effect sizes
- `BootstrapEvaluator` for uncertainty estimation
- `generate_validation_report()` orchestrates all methods

#### 3H. Reporting — FULLY IMPLEMENTED

**Files:** `intelligence/reporting/` (6 files)

- Markdown, HTML, JSON report generation
- Leaderboard with composite scoring (weighted metrics + latency penalty)
- Matplotlib visualizations (metric trends, experiment comparison, ablation impact)
- Reproducibility manifests (git commit, Python version, packages)

#### 3I. Ablation Testing — FULLY IMPLEMENTED

**Files:** `intelligence/ablation/` (4 files)

- `AblationConfig` with toggles for planner, calibration, optimization, feedback
- `AblationRunner` connects to real pipeline
- Comparison with statistical validation
- Pre-built configs: BASELINE, FULL_TREATMENT, PLANNER_ONLY, etc.

#### 3J. Retraining — FULLY IMPLEMENTED

**Files:** `intelligence/retraining/` (4 files)

- `BudgetRetrainer`: retrains budget optimizer from feedback
- `ModelRegistry`: tracks all model versions with dataset hashes
- `RetrainingScheduler`: background periodic retraining

---

## 4. Golden Dataset Flow

### Datasets (VERIFIED BY SOURCE)

| Dataset | Entries | Types | Source |
|---|---|---|---|
| `queries.json` | 30 | 10 simple, 10 complex, 10 multi_hop | Hand-crafted EU AI Act |
| `eu_ai_act_queries.json` | 150 | 50 each | Procedurally generated |
| Domain synthetic | ~287 | Finance/legal/healthcare/tech/general | `benchmarks/datasets/generator.py` |
| External loaders | On-demand | SQuAD, HotpotQA, NQ, MSMARCO | Format adapters only |

### Dataset Entry Schema (VERIFIED BY SOURCE)

```json
{
  "id": "SIMPLE-001",
  "text": "According to Article 3(1)...",
  "query_type": "simple",
  "domain": "definitions",
  "corpus_ref": "EU_AI_Act.pdf",
  "expected_articles": ["Article 3(1)"],
  "confidence_category": "high",
  "expected_chunks": ["chunk_art_3_1"]
}
```

### Flow Status

| Stage | Implemented | Connected | Persisted | Reproducible |
|---|---|---|---|---|
| Dataset creation | YES | — | YES (JSON) | YES |
| Dataset versioning | **NO** | — | — | — |
| Dataset entry | YES | — | YES | YES |
| Expected answer | **NO** (only expected chunks) | — | — | — |
| Expected citations | YES (expected_articles) | — | YES | YES |
| Evaluation execution | YES | YES (via retriever_fn) | YES | YES |
| Retrieved context | YES | YES | YES | YES |
| Generated response | **NO** | **NO** | — | — |
| Metric calculation | YES | YES | YES | YES |
| Result persistence | YES | YES (JSON files) | YES | YES |
| UI | Partial (dashboard exists) | — | — | — |
| Regression comparison | YES (experiment comparison) | YES | YES | YES |
| Quality gate | **NO** | — | — | — |

---

## 5. Metric Inventory

### Retrieval Metrics (VERIFIED BY TEST — 111 tests)

| Metric | Implementation | Formula | Deterministic |
|---|---|---|---|
| Reciprocal Rank | `ranking_metrics.py` | 1/rank_of_first_relevant | Yes |
| MRR | `ranking_metrics.py` | mean(Reciprocal Rank) | Yes |
| Average Precision | `ranking_metrics.py` | sum(Precision@i * rel_i) / |relevant| | Yes |
| MAP | `ranking_metrics.py` | mean(Average Precision) | Yes |
| DCG | `ranking_metrics.py` | sum(rel_i / log2(i+1)) | Yes |
| NDCG | `ranking_metrics.py` | DCG / ideal_DCG | Yes |
| Hit Rate@K | `ranking_metrics.py` | fraction with ≥1 relevant in top_k | Yes |
| Precision@K | `ranking_metrics.py` | |relevant in top_k| / k | Yes |
| Recall@K | `ranking_metrics.py` | |relevant in top_k| / |relevant| | Yes |

### Calibration Metrics (VERIFIED BY TEST)

| Metric | Implementation | Formula | Deterministic |
|---|---|---|---|
| ECE | `calibration_metrics.py` | sum(|accuracy_i - confidence_i| * n_i) / n | Yes |
| MCE | `calibration_metrics.py` | max(|accuracy_i - confidence_i|) | Yes |
| Brier Score | `calibration_metrics.py` | mean((forecast - outcome)²) | Yes |

### Judging Metrics (VERIFIED BY SOURCE — algorithmic, not LLM)

| Metric | Implementation | Algorithm | Deterministic |
|---|---|---|---|
| Faithfulness | `faithfulness.py` | 3-gram(answer) ∩ 3-gram(context) / |3-gram(answer)| | Yes |
| Hallucination | `hallucination.py` | sentence claims matched by trigrams against context | Yes |
| Grounding | `grounding.py` | 0.4×word_overlap + 0.6×quote_support | Yes |
| Relevance | `relevance.py` | |tokens(answer) ∩ tokens(query)| / |tokens(query)| | Yes |
| Composite | `scoring.py` | weighted sum with configurable weights | Yes |

### Higher-Level AI Quality Metrics — NOT IMPLEMENTED

| Metric | Status | Gap |
|---|---|---|
| Faithfulness (LLM-judged) | NOT IMPLEMENTED | Current version is n-gram overlap only |
| Groundedness (LLM-judged) | NOT IMPLEMENTED | Current version is word overlap only |
| Hallucination (LLM-judged) | NOT IMPLEMENTED | Current version is trigram matching only |
| Answer relevance (LLM-judged) | NOT IMPLEMENTED | Current version is token overlap only |
| Context relevance | NOT IMPLEMENTED | — |
| Citation correctness | NOT IMPLEMENTED | — |
| Citation completeness | NOT IMPLEMENTED | — |
| Factual consistency | NOT IMPLEMENTED | — |
| Response quality | NOT IMPLEMENTED | — |

---

## 6. LLM-as-Judge Audit

### Current State: NOT IMPLEMENTED

**Evidence (VERIFIED BY SOURCE):**
- `intelligence/judging/faithfulness.py`: Pure n-gram overlap, zero LLM calls
- `intelligence/judging/hallucination.py`: Sentence splitting + trigram matching, zero LLM calls
- `intelligence/judging/grounding.py`: Word overlap + regex quote detection, zero LLM calls
- `intelligence/judging/relevance.py`: Token set overlap, zero LLM calls
- Searched entire `intelligence/judging/` for `openai`, `gemini`, `generate_content`, `chat.completions`: **ZERO matches**

### Capability Gap Matrix

| Capability | Required | Present |
|---|---|---|
| Model-based judging | YES | NO |
| Deterministic judging | Optional | YES (algorithmic) |
| Rubric-based judging | YES | NO |
| Structured judge output | YES | NO (returns float scores) |
| Judge confidence | Optional | NO |
| Judge model selection | YES | NO |
| Judge retries | YES | NO |
| Malformed judge output handling | YES | NO |
| Judge timeout | YES | NO |
| Judge failure handling | YES | NO |
| Judge cost tracking | YES | NO |
| Judge latency tracking | YES | NO |

---

## 7. Retrieval → Generation → Evaluation Audit

### Current Boundary (VERIFIED BY SOURCE)

The evaluation pipeline **stops at retrieval**:

```
Query → Classify → Plan → Retrieve → Evaluate (recall/precision/MRR/NDCG)
                                                    ↑
                                              STOPS HERE
```

**Evidence:**
- `benchmarks/runner/runner.py`: Pipeline is classify → plan → retrieve → evaluate. No `generate_response` call.
- `intelligence/evaluation/retrieval_benchmark.py`: Takes `retriever_fn`, not `pipeline_fn`. No LLM generation.
- `intelligence/benchmarks/benchmark_runner.py`: Wraps the runner above. No generation step.
- Searched `intelligence/evaluation/` and `intelligence/benchmarks/` for `generate_response` or `get_response`: **ZERO matches**

### What's Missing

```
Query → Classify → Plan → Retrieve → Context → LLM → Answer → Evaluate
                                                    ↑
                                              NOT CONNECTED
```

The judging module (`intelligence/judging/`) can evaluate answer quality, but:
1. It is never called by the benchmark runner
2. It is never fed retrieved context + generated answer
3. It has no integration with the evaluation pipeline

---

## 8. Observability Integration

### What's Active in Production (VERIFIED BY SOURCE)

| Component | Records Data | Connected to Eval |
|---|---|---|
| Prometheus counters/histograms | YES | NO |
| Telemetry JSONL files | YES | NO |
| Structured logging with correlation_id | YES | NO |
| Go gateway W3C TraceContext | YES | NO |

### What's NOT Active (VERIFIED BY SOURCE)

| Component | Status |
|---|---|
| Custom Tracer (`tracing.py`) | Unused — only in tests |
| EventLogger (`event_logger.py`) | Unused — only in dashboard sim |
| MetricsRegistry (`metrics_registry.py`) | Unused — only in dashboard sim |
| Alerting (`alerting.py`) | Unused — only in dashboard sim |
| PerformanceMonitor (`performance_monitor.py`) | Unused — only in dashboard sim |

### Correlation Gaps

| Correlation | Status |
|---|---|
| Trace ↔ Evaluation result | NOT IMPLEMENTED |
| Span ↔ Model/prompt version | NOT IMPLEMENTED |
| Trace ↔ Dataset version | NOT IMPLEMENTED |
| Metrics ↔ Quality gates | NOT IMPLEMENTED |
| Correlation ID ↔ Trace ID | DISCONNECTED (separate systems) |

---

## 9. PromptOps Integration

### Current State: NOT IMPLEMENTED

| Component | Status |
|---|---|
| Prompt versioning | NOT IMPLEMENTED |
| PromptVariable tracking | NOT IMPLEMENTED |
| System prompt versioning | NOT IMPLEMENTED |
| Model parameter recording | PARTIAL (model name in response, not persisted with eval) |
| Prompt → Evaluation linkage | NOT IMPLEMENTED |
| Dataset → Evaluation linkage | PARTIAL (ground truth exists, not versioned) |

The classifier has a system prompt (`classifier_system_prompt.txt`) and the LLM has a template (`llm_prompt.txt`), but neither is versioned or tracked alongside evaluation results.

---

## 10. Regression Testing

### What Exists (VERIFIED BY TEST)

| Regression Type | Mechanism | Status |
|---|---|---|
| Retrieval quality | Test assertions (Recall@10≥0.8, MRR≥0.6) | YES — in test_retrieval_adversarial.py |
| Metric correctness | 111 mathematically validated tests | YES — in test_metrics_correctness.py |
| Experiment comparison | `compare_runs()` with statistical validation | YES — in experiments/comparison.py |
| Ablation comparison | `compare_runs()` with statistical validation | YES — in ablation/comparison.py |

### What's Missing

| Regression Type | Status |
|---|---|
| Prompt regression | NOT IMPLEMENTED |
| Model regression | NOT IMPLEMENTED |
| End-to-end regression (retrieval + generation) | NOT IMPLEMENTED |
| Latency regression | NOT IMPLEMENTED |
| Cost regression | NOT IMPLEMENTED |
| Automated threshold enforcement | NOT IMPLEMENTED |
| Visualization of trends | PARTIAL (matplotlib in reporting/) |
| Persistence of regression results | PARTIAL (experiment registry) |

---

## 11. Quality Gates

### Current State: NOT IMPLEMENTED

**Evidence (VERIFIED BY SOURCE):**
- Searched all Python files for `quality_gate`, `QualityGate`, `gate_check`, `gate_pass`: **ZERO matches**
- `.github/workflows/` directory: **DOES NOT EXIST**
- `intelligence/config/settings.py` has `coverage_threshold: float = 70.0` but no enforcement logic

### What Would Be Needed

```
Evaluation Result → Metric → Threshold → Pass/Fail → History → Release Decision
```

Currently none of this exists. The `DegradedRecallAlertRule` in `alerting.py` is the closest concept, but it's never fed evaluation results and can only be triggered manually from the dashboard.

---

## 12. Reproducibility

### What's Stored (VERIFIED BY SOURCE)

| Artifact | Stored | Versioned |
|---|---|---|
| Dataset version | NO (no version field) | NO |
| Prompt version | NO | NO |
| Model/provider | YES (in experiment parameters) | NO |
| Model parameters | PARTIAL (temperature not tracked) | NO |
| Embedding model | NO | NO |
| Retriever configuration | YES (in experiment parameters) | NO |
| Reranker configuration | NO | NO |
| Evaluation model | NO (no LLM judge) | NO |
| Evaluation rubric | NO (no rubric system) | NO |
| Random seed | YES (sklearn models use random_state=42) | NO |
| Source documents | NO (ChromaDB namespace only) | NO |
| Retrieved chunks | NO | NO |
| Generated answer | NO (no generation in eval) | NO |
| Git commit | YES (in reproducibility manifest) | YES |
| Python version | YES | YES |
| Platform | YES | YES |
| Package versions | YES (pip freeze in manifest) | YES |

---

## 13. Cost / Performance

### What's Tracked

| Metric | Where | Production Active |
|---|---|---|
| Input tokens | gRPC response (`prompt_tokens`) | YES (returned to client) |
| Output tokens | gRPC response (`completion_tokens`) | YES (returned to client) |
| Retrieval latency | Prometheus histogram | YES |
| Classification latency | Telemetry JSONL | YES |
| Embedding latency | Prometheus histogram (ingestion) | YES |
| BM25 query latency | Prometheus histogram | YES |
| Ingestion stage latencies | Prometheus histograms | YES |

### What's NOT Tracked

| Metric | Status |
|---|---|
| Judge tokens | N/A (no LLM judge) |
| Judge cost | N/A |
| Evaluation cost | NOT IMPLEMENTED |
| Total evaluation cost | NOT IMPLEMENTED |
| Cost per evaluation example | NOT IMPLEMENTED |

### Scaling Risks

| Operation | 100 examples | 1,000 examples | 10,000 examples |
|---|---|---|---|
| Retrieval eval | ~minutes | ~hours | ~days (if real ChromaDB) |
| LLM generation | ~$0.10-1.00 | ~$1-10 | ~$10-100 |
| LLM judge (if implemented) | ~$0.10-1.00 | ~$1-10 | ~$10-100 |
| Embedding | Seconds | ~minutes | ~hours |

---

## 14. Failure Matrix

| Component | Failure | Current Behavior | Recoverable | Observable |
|---|---|---|---|---|
| Dataset | Malformed entry | `validate_dataset()` raises ValueError | No (rejects) | Yes (audit tool) |
| Dataset | Missing expected_chunks | Validation warning | Partial | Yes |
| Retrieval | ChromaDB down | Fallback to BM25 | Yes | Yes (degraded_mode flag) |
| Retrieval | Empty namespace | ValueError raised | No | Yes (gRPC error) |
| Embedding | Model unavailable | Exception propagates | No | Yes (gRPC error) |
| Reranker | CrossEncoder failure | Returns empty | Yes | No (silent) |
| LLM | Timeout (30s default) | Circuit breaker opens | Yes (half-open) | Yes (Prometheus gauge) |
| LLM | Malformed output | Exception propagates | No | Yes (gRPC error) |
| Judge | N/A | No LLM judge exists | N/A | N/A |
| Database | ChromaDB unavailable | ValueError → gRPC UNAVAILABLE | Yes (circuit breaker) | Yes |
| Trace | Custom tracer failure | N/A (tracer unused) | N/A | N/A |
| Metric | Prometheus failure | Metrics silently dropped | Yes (app continues) | No |
| Quality Gate | N/A | No quality gates exist | N/A | N/A |

---

## 15. Security / Data Isolation

### Isolation Verified (VERIFIED BY TEST)

| Isolation Type | Mechanism | Verified |
|---|---|---|
| Namespace isolation (vector) | ChromaDB collection per namespace | YES (P2/P3 tests) |
| Namespace isolation (BM25) | Separate PersistentBM25Index per namespace | YES (P2/P3 tests) |
| Namespace validation | Regex `^[a-zA-Z0-9]+$`, max 63 chars | YES (middleware) |
| Auth | Timing-safe `X-Secret` comparison | YES (middleware) |
| Rate limiting | Per-namespace token bucket | YES (middleware) |

### Isolation Gaps

| Isolation Type | Status |
|---|---|
| Evaluation data isolation | NOT TESTED — ground truth is in-memory, not persisted with org context |
| Dataset isolation | NOT TESTED — datasets are global, not per-org |
| Experiment isolation | NOT TESTED — experiments are global in `experiments/registry.json` |
| Trace isolation | NOT TESTED — traces are not org-scoped |
| Leaderboard isolation | NOT TESTED — leaderboard is global |

---

## 16. Architectural Gaps

### P0 — Production Correctness/Security Blocker

| # | Gap | Impact |
|---|---|---|
| P0-1 | **No end-to-end evaluation (retrieval → generation → evaluation)** | Cannot measure whether the system actually answers questions correctly. All current evaluation is retrieval-only. |

### P1 — Required for Reliable Evaluation

| # | Gap | Impact |
|---|---|---|
| P1-1 | **No LLM-as-Judge** | Algorithmic judges (n-gram overlap) are insufficient for measuring answer quality, faithfulness, or hallucination in a RAG system. |
| P1-2 | **No quality gates** | No mechanism to block a release based on evaluation metrics. Regressions ship undetected. |
| P1-3 | **No trace↔evaluation correlation** | Cannot trace an evaluation failure back to the exact production execution. |

### P2 — Important Improvement

| # | Gap | Impact |
|---|---|---|
| P2-1 | **No CI/CD evaluation** | No automated evaluation on PR/merge. |
| P2-2 | **Observability disconnected from evaluation** | Custom tracing system unused; Prometheus metrics not linked to eval results. |
| P2-3 | **No dataset versioning** | Cannot reproduce an exact evaluation over time. |
| P2-4 | **No prompt versioning** | Cannot compare prompt changes quantitatively. |
| P2-5 | **No cost tracking per evaluation** | Cannot assess evaluation ROI at scale. |
| P2-6 | **No experiment isolation** | All experiments share a global registry. |

### P3 — Optional Enhancement

| # | Gap | Impact |
|---|---|---|
| P3-1 | **No model comparison leaderboard** | Cannot systematically compare model/provider performance. |
| P3-2 | **No retriever comparison leaderboard** | Cannot systematically compare retrieval strategies. |
| P3-3 | **No prompt comparison** | Cannot measure prompt A/B test results. |

---

## 17. Severity Classification Summary

| Severity | Count | Items |
|---|---|---|
| P0 | 1 | End-to-end evaluation gap |
| P1 | 3 | LLM-as-judge, quality gates, trace↔eval correlation |
| P2 | 6 | CI/CD, observability disconnect, dataset versioning, prompt versioning, cost tracking, experiment isolation |
| P3 | 3 | Model leaderboard, retriever leaderboard, prompt comparison |

---

## 18. Target Architecture

### Conceptual Flow (Adapted to Actual Codebase)

```
Golden Dataset (queries.json / eu_ai_act_queries.json)
      ↓
Dataset Version (NEW: add version field)
      ↓
Evaluation Runner (EXISTING: retrieval_benchmark.py + NEW: generation step)
      ↓
┌─────────────────────────────────────────────────┐
│ Experiment Configuration (EXISTING: experiments/) │
│   ├─ Prompt Version (NEW)                         │
│   ├─ Model Configuration (EXISTING: LLM providers)│
│   ├─ Retriever Configuration (EXISTING)           │
│   ├─ Embedding Model (EXISTING: local_embedder)   │
│   └─ Reranker Configuration (EXISTING)            │
└─────────────────────────────────────────────────┘
      ↓
Retrieval Pipeline (EXISTING: simple/complex/multihop)
      ↓
Retrieved Context (EXISTING)
      ↓
LLM Generation (EXISTING: openai_llm/gemini_llm)
      ↓
Generated Answer (NEW: capture in eval pipeline)
      ↓
┌─────────────────────────────────────────────────┐
│ Evaluation Engine (PARTIAL: exists but disconnected) │
│   ├─ Retrieval Metrics (EXISTING: ranking_metrics)   │
│   ├─ Judging Metrics (EXISTING: algorithmic judges)  │
│   ├─ LLM-as-Judge (NEW)                              │
│   └─ Composite Scoring (EXISTING: scoring.py)        │
└─────────────────────────────────────────────────┘
      ↓
Trace (EXISTING: Prometheus + Telemetry, NEEDS eval linkage)
      ↓
Cost (PARTIAL: tokens tracked, NEEDS cost computation)
      ↓
Regression Engine (PARTIAL: exists, NEEDS automation)
      ↓
Quality Gates (NEW)
      ↓
Release Decision (NEW: CI/CD integration)
```

### Building on Existing Infrastructure

| Target Component | Leverages |
|---|---|
| End-to-end eval | Existing `retrieval_benchmark.py` + existing LLM clients |
| LLM-as-Judge | Existing `intelligence/judging/` framework (BaseJudge, CompositeJudge) |
| Quality gates | Existing `alerting.py` framework (AlertRule, AlertManager) |
| Trace↔eval | Existing Prometheus metrics + telemetry JSONL |
| Dataset versioning | Existing `ground_truth.py` + `dataset_registry.py` |
| Prompt versioning | Existing experiment parameters system |
| CI evaluation | Existing benchmark runner + experiment tracker |

---

## 19. Framework Decision

### Reconfirmed: NOT JUSTIFIED

| Framework | Evidence | Verdict |
|---|---|---|
| LangChain | No LangChain imports anywhere in `intelligence/`. Custom retrieval pipeline is complete, tested, and performant. | NOT JUSTIFIED |
| LangGraph | No multi-agent orchestration needed. The pipeline is linear. | NOT JUSTIFIED |
| LangSmith | Custom telemetry (Prometheus + JSONL) covers observability needs. | NOT JUSTIFIED |

The existing native architecture has:
- Complete retrieval pipeline (3 strategies + fallback)
- Complete evaluation metrics (ranking + calibration + judging)
- Complete experiment tracking
- Complete statistical validation
- Complete reporting

What's missing is **integration**, not **framework**.

---

## 20. Proposed Implementation Roadmap

### P4-A: End-to-End Evaluation Runner
- **Objective:** Extend the benchmark runner to capture LLM-generated answers and evaluate them
- **Files:** `intelligence/evaluation/retrieval_benchmark.py`, `benchmarks/runner/runner.py`
- **Dependencies:** Existing LLM clients (openai_llm.py, gemini_llm.py)
- **API impact:** New field `generated_answer` in `QueryResult`
- **Database impact:** None
- **Testing strategy:** Run against 10 golden entries, verify answers captured
- **Risks:** LLM cost per evaluation, non-deterministic answers
- **Rollback:** Feature flag to disable generation step

### P4-B: LLM-as-Judge Engine
- **Objective:** Implement LLM-based judging for faithfulness, groundedness, hallucination, and answer relevance
- **Files:** `intelligence/judging/` (extend existing), new `intelligence/judging/llm_judge.py`
- **Dependencies:** Existing LLM clients
- **API impact:** New `judge_model` parameter in evaluation endpoints
- **Database impact:** None
- **Testing strategy:** Run 10 examples with known good/bad answers, verify judge discrimination
- **Risks:** Judge cost, judge non-determinism, judge calibration
- **Rollback:** Fall back to algorithmic judges

### P4-C: Evaluation-Trace Correlation
- **Objective:** Link evaluation results to Prometheus metrics and telemetry
- **Files:** `intelligence/evaluation/evaluator.py`, `intelligence/telemetry/collector.py`
- **Dependencies:** None
- **API impact:** None
- **Database impact:** New fields in telemetry events
- **Testing strategy:** Run evaluation, verify telemetry events include eval metrics
- **Risks:** None
- **Rollback:** None

### P4-D: Quality Gates
- **Objective:** Define metric thresholds that block releases
- **Files:** New `intelligence/evaluation/quality_gate.py`
- **Dependencies:** P4-A (end-to-end eval)
- **API impact:** New endpoint for gate status
- **Database impact:** Gate history storage
- **Testing strategy:** Set threshold, run eval, verify pass/fail
- **Risks:** Overly strict gates block valid releases
- **Rollback:** Feature flag to disable gate enforcement

### P4-E: Dataset Versioning
- **Objective:** Version golden datasets for reproducible evaluation
- **Files:** `intelligence/evaluation/ground_truth.py`, `benchmarks/dataset/loader.py`
- **Dependencies:** None
- **API impact:** Version field in dataset API
- **Database impact:** Version metadata in dataset files
- **Testing strategy:** Create v1, modify, verify v1 still loads
- **Risks:** None
- **Rollback:** None

### P4-F: Prompt Versioning
- **Objective:** Track prompt versions alongside evaluation results
- **Files:** `intelligence/experiments/models.py`, `intelligence/llm/base_llm.py`
- **Dependencies:** None
- **API impact:** Prompt version in experiment parameters
- **Database impact:** Version field in experiment parameters
- **Testing strategy:** Change prompt, verify version tracked
- **Risks:** None
- **Rollback:** None

### P4-G: CI Evaluation
- **Objective:** Run evaluation on PR and block merge on regression
- **Files:** `.github/workflows/eval.yml` (new), `benchmarks/runner/runner.py`
- **Dependencies:** P4-A, P4-D
- **API impact:** None
- **Database impact:** None
- **Testing strategy:** Create workflow, verify it runs on test PR
- **Risks:** CI cost, CI latency
- **Rollback:** Remove workflow

### P4-H: Cost Tracking
- **Objective:** Track evaluation cost (tokens × price) alongside quality
- **Files:** `intelligence/evaluation/evaluator.py`, `intelligence/experiments/models.py`
- **Dependencies:** P4-A (generation step provides token counts)
- **API impact:** Cost field in evaluation results
- **Database impact:** Cost fields in experiment metrics
- **Testing strategy:** Run 10 examples, verify cost computed
- **Risks:** Price table maintenance
- **Rollback:** None

---

## 21. Explicit "NOT IMPLEMENTED" Section

The following capabilities do NOT exist in the current codebase:

| Capability | Status | Evidence |
|---|---|---|
| LLM-as-Judge | NOT IMPLEMENTED | All judges are algorithmic (n-gram overlap). Zero LLM calls in `intelligence/judging/`. |
| End-to-end evaluation (query → retrieval → generation → evaluation) | NOT IMPLEMENTED | Benchmark runner stops at retrieval. No `generate_response` in eval path. |
| Quality gates | NOT IMPLEMENTED | Zero matches for `quality_gate`, `QualityGate`, `gate_check` in all Python files. |
| CI/CD evaluation | NOT IMPLEMENTED | `.github/workflows/` directory does not exist. |
| Trace ↔ evaluation correlation | NOT IMPLEMENTED | Tracing system (`tracing.py`) unused in production. No code links traces to eval results. |
| Dataset versioning | NOT IMPLEMENTED | No version field in dataset schema. |
| Prompt versioning | NOT IMPLEMENTED | No version tracking for prompts. |
| Model comparison leaderboard | NOT IMPLEMENTED | Leaderboard exists but has no data source from real evaluations. |
| Cost per evaluation | NOT IMPLEMENTED | Token counts exist but no price computation. |
| Rubric-based judging | NOT IMPLEMENTED | No rubric system exists. |
| Citation correctness evaluation | NOT IMPLEMENTED | `expected_articles` exists in dataset but is never evaluated. |
| Automated regression blocking | NOT IMPLEMENTED | Test assertions exist but no enforcement mechanism. |
| Observability ↔ evaluation connection | NOT IMPLEMENTED | Prometheus metrics not linked to eval results. Custom tracing unused. |

---

## P4 STATUS

| Item | Status |
|---|---|
| Architecture audit | COMPLETE |
| Evaluation pipeline | AUDITED — retrieval-only, no generation |
| Golden datasets | AUDITED — 180 labeled + 287 synthetic |
| Metrics | AUDITED — 9 retrieval + 3 calibration + 5 judging (all algorithmic) |
| LLM-as-judge | NOT IMPLEMENTED — all judges are n-gram overlap |
| Retrieval→generation | NOT CONNECTED — evaluation stops at retrieval |
| Observability | AUDITED — Prometheus active, custom tracing unused, no eval linkage |
| PromptOps | NOT IMPLEMENTED — no prompt versioning |
| Regression | PARTIAL — test assertions exist, no automation |
| Quality gates | NOT IMPLEMENTED — zero enforcement mechanisms |
| Reproducibility | PARTIAL — git/package versions captured, no dataset/prompt versioning |
| Cost | PARTIAL — tokens tracked, no price computation |
| Security | VERIFIED — namespace isolation proven by tests |
| P0 findings | 1 (end-to-end evaluation gap) |
| P1 findings | 3 (LLM-as-judge, quality gates, trace↔eval correlation) |
| P2 findings | 6 (CI/CD, observability disconnect, dataset versioning, prompt versioning, cost tracking, experiment isolation) |
| P3 findings | 3 (model leaderboard, retriever leaderboard, prompt comparison) |
| Framework decision | NOT JUSTIFIED |
| Target architecture | DESIGNED — building on existing infrastructure |
| Implementation roadmap | 8 phases (P4-A through P4-H) |
| Report | COMPLETE |
| Commit | PENDING |
| Push | PENDING |
| Working tree | CLEAN (no source modifications) |
