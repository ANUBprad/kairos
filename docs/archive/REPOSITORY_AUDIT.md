# Repository Audit Report — Kairos v3.0

> Generated: 2026-06-23
> Audit scope: Full repository structure, naming, imports, documentation, artifacts, dependencies, dashboard readiness.

---

## Current Structure

```
kairos/
├── .github/               # CI/CD workflows, issue/PR templates
├── benchmarks/            # Eval datasets, runners, experiments, results, leaderboard
│   ├── dataset/           # (singular) — Phase 1 dataset loader/generator
│   ├── datasets/          # (plural) — Phase 9 gold dataset generator
│   ├── e2e/               # Phase 9 end-to-end benchmark pipeline
│   ├── experiments/       # Experiment runner, baseline/treatment comparison
│   ├── leaderboard/       # Ranking leaderboard
│   ├── metrics/           # Precision, recall, latency, failure rate
│   ├── reporting/         # Charts and report generation
│   ├── runner/            # Phase 1-6 benchmark runner (duplicates)
│   ├── results/           # Generated benchmark output files
│   └── reports/           # Generated markdown reports
├── dashboard/             # Streamlit research dashboard (12 pages)
│   ├── components/        # Empty (no components)
│   ├── data/              # Empty (no data modules)
│   └── pages/             # 12 page modules
├── demo/                  # Demo scripts and walkthroughs
│   └── screenshots/       # Empty (placeholder)
├── docker/                # Dockerfiles + Grafana provisioning
├── docs/                  # Documentation
│   └── diagrams/          # 5 Mermaid diagrams
├── examples/              # 4 runnable examples (simple_rag, adaptive_rag, etc.)
├── experiments/           # EMPTY
├── gateway/               # Go API gateway
│   ├── api/               # HTTP handlers
│   ├── cache/             # LRU + semantic cache
│   ├── config/            # Go config
│   ├── interceptors/      # grpc_logging.go (EMPTY)
│   ├── middleware/        # Auth, logging, ratelimit, tracing
│   ├── static/            # CSS, JS, images (hero.png: 5.8MB)
│   └── tenants/           # tenant.go, tenant_store.go (both EMPTY)
├── generated/             # Protobuf generated code (tracked in git)
├── intelligence/          # Python intelligence layer
│   ├── ablation/          # Ablation comparison, config, runner
│   ├── api/               # FastAPI management API
│   │   ├── auth/          # API key validation
│   │   ├── health/        # Health endpoints
│   │   ├── midlware/      # TYPO: should be middleware
│   │   ├── rate_limit/    # Token bucket
│   │   ├── routes/        # API route handlers
│   │   └── versioning/    # API versioning
│   ├── artifacts/         # Model, experiment, report registries
│   ├── benchmarks/        # Benchmark types (duplicates benchmarks/e2e)
│   │   └── loaders/       # HotpotQA, MS MARCO, Natural Questions, SQuAD
│   ├── cache/             # Embedding cache
│   ├── calibration/       # Confidence calibration
│   ├── circuit_breaker/   # Circuit breaker pattern
│   ├── classifier/        # Query classifier + strategy selector
│   ├── config/            # Pydantic settings (Phase 8)
│   ├── embeddings/        # Embedder interfaces (gemini_embedder.py, openai_embedder.py = EMPTY)
│   ├── evaluation/        # Ranking metrics, evaluator, benchmarks (Phase 7)
│   ├── experiments/       # Experiment registry, tracker (Phase 7)
│   ├── feedback/          # Feedback collection, analytics, storage
│   ├── ingestion/         # Document loader, chunker, pipeline
│   ├── judging/           # Faithfulness, relevance, hallucination, grounding judges
│   ├── llm/               # LLM interfaces (Gemini, OpenAI)
│   ├── metrics/           # Prometheus metrics
│   ├── observability/     # Tracing, alerting, monitoring (Phase 7)
│   ├── optimization/      # Budget optimization
│   ├── planner/           # Retrieval planner, budget allocator, fallback
│   ├── reporting/         # HTML/markdown reports, leaderboard, visualization
│   ├── reranker/          # Cross-encoder reranker
│   ├── retraining/        # Model retraining pipeline
│   ├── retrieval/         # Retrievers (simple, complex, multi-hop, real)
│   ├── server/            # gRPC server
│   ├── statistics/        # Statistical tests, bootstrap, effect size
│   ├── telemetry/         # Telemetry collection
│   ├── training/          # Training dataset builder
│   └── vectorstore/       # ChromaDB store
├── models/                # Trained model registry (tracked — should be ignored)
├── proto/                 # gRPC protobuf definitions
├── sdk/                   # Python client SDK (keiro-client)
├── scripts/               # Release, build, benchmark, validate
└── tests/                 # 37 test files
```

---

## Issues Found

### P0 — Must Fix Before Launch

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Go binary tracked in git** | `gateway/main` (15.3 MB) | Bloats repo; binary shouldn't be versioned |
| 2 | **`models/` not properly gitignored** | Root `models/` dir | `.gitignore` has `models/` but `models/registry.json` tracks anyway |
| 3 | **`.pytest_cache` not in `.gitignore`** | Root `.pytest_cache` | Cache dir can be committed accidentally |
| 4 | **Typo: `midlware` → `middleware`** | `intelligence/api/midlware/` | Package named incorrectly (missing 'd') — affects all imports |
| 5 | **Middleware never wired into FastAPI app** | `intelligence/api/app.py` | AuthMiddleware, LoggingMiddleware, RateLimitMiddleware, VersioningMiddleware all exist but `create_app()` never calls `app.add_middleware()` |
| 6 | **Dashboard components/ and data/ are dead packages** | `dashboard/components/`, `dashboard/data/` | Empty directories (only `__init__.py`) should be removed or implemented |

### P1 — Should Fix Before Launch

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 7 | **`benchmarks/dataset/` vs `benchmarks/datasets/` — duplicate split** | Both dirs | Two packages with overlapping purpose (`benchmarks/dataset/` = Phase 1, `benchmarks/datasets/` = Phase 9). `benchmarks/dataset/queries.json` and `benchmarks/dataset/eu_ai_act_queries.json` likely unused |
| 8 | **0-byte stub files** | Multiple locations | 23 empty `.py` files (mostly `__init__.py` which is fine, but `gemini_embedder.py`, `openai_embedder.py`, `benchmarks/runner/evaluator.py`, `benchmarks/runner/report_generator.py`, `gateway/interceptors/grpc_logging.go`, `gateway/tenants/tenant.go`, `gateway/tenants/tenant_store.go` are dead stubs) |
| 9 | **`benchmarks/runner/` duplicates `benchmarks/e2e/` functionality** | `benchmarks/runner/` | `benchmark_runner.py`, `evaluator.py` (empty), `report_generator.py` (empty), `retriever.py` duplicate of `intelligence/retrieval/retriever.py` |
| 10 | **`intelligence/benchmarks/` duplicates `benchmarks/e2e/`** | `intelligence/benchmarks/` | `benchmark_result.py`, `benchmark_runner.py` duplicate `benchmarks/e2e/` equivalents |
| 11 | **`intelligence/ablation/` partially duplicates `benchmarks/e2e/ablation.py`** | Both | Same concept with different implementations |
| 12 | **`intelligence/reporting/leaderboard.py` duplicates `benchmarks/leaderboard/leaderboard.py`** | Both | Two leaderboard implementations with different APIs |
| 13 | **Stale docs: `docs/PHASE_1_SCOPE.md`** | `docs/` | Only covers Phase 1; project is now at v3.0 |
| 14 | **Stale docs: `docs/ROADMAP.md`** | `docs/` | Only covers Phases 1-5; incomplete vs actual delivery |
| 15 | **Stale docs: `docs/EXPERIMENTS.md`** | `docs/` | Only 4 lines, not useful |
| 16 | **`docs/ARCHITECTURE.md` redundant with README** | `docs/` | README already has architecture diagram and project structure |
| 17 | **Dashboard "Phase 9" version text** | `dashboard/app.py:58` | Shows "Version: Phase 9" — should be generic |
| 18 | **`benchmarks/evaluator.py` at root** | `benchmarks/evaluator.py` | Appears orphaned vs `intelligence/evaluation/evaluator.py` and `benchmarks/runner/evaluator.py` |
| 19 | **Empty directories** | `experiments/`, `benchmarks/results/e2e/`, `demo/screenshots/` | 3 empty directories should be removed or stubbed |
| 20 | **`demo/screenshots/` empty** | `demo/screenshots/` | Placeholder with no screenshots |

### P2 — Nice To Have

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 21 | **`generated/` tracked in git** | `generated/python/` | Generated code should be regenerated at build time or gitignored |
| 22 | **`gateway/static/images/hero.png` (5.8 MB)** | `gateway/static/images/` | Very large image in repo; consider optimizing or git-lfs |
| 23 | **`benchmarks/EU_AI_Act.pdf` (2.5 MB)** | `benchmarks/` | Large PDF tracked in git |
| 24 | **`benchmarks/results/` tracked** | `benchmarks/results/` | Generated benchmark output files committed (`.gitignore` has `benchmarks/results/` but check effectiveness) |
| 25 | **Dashboard page naming inconsistency** | `dashboard/pages/` | `ablations.py` vs `ablation_v2.py` (plural vs singular + v2 suffix) |
| 26 | **`intelligence/api/routes/__init__.py` is 0 bytes** | `intelligence/api/routes/` | Should export route modules |
| 27 | **`intelligence/embeddings/` has 0-byte embedders** | `gemini_embedder.py`, `openai_embedder.py` | Stub files that should either be implemented or removed |
| 28 | **`prometheus.yml` at root vs Grafana config in `docker/`** | Root + `docker/grafana/` | Prometheus config at root is separate from Docker Grafana config |
| 29 | **`intelligence/reporting/` has 3 reporting.py files across codebase** | Multiple | `intelligence/benchmarks/reporting.py`, `intelligence/evaluation/reporting.py`, `intelligence/statistics/reporting.py` |
| 30 | **`intelligence/telemetry/` duplicates `intelligence/feedback/` pattern** | Both | Similar analytics/collector/storage modules |
| 31 | **`intelligence/retraining/model_registry.py` duplicates `intelligence/artifacts/model_registry.py`** | Both | Two model registries with different APIs |
| 32 | **`intelligence/server/__init__.py` is 0 bytes** | `intelligence/server/` | Should export server modules |
| 33 | **SDK references "Keiro" not "Kairos"** | `sdk/pyproject.toml`, `sdk/keiro/` | SDK uses old name "Keiro" while project is now "Kairos" |
| 34 | **`sdk/LICENSE.md` duplicates root `LICENSE.md`** | `sdk/LICENSE.md` | Redundant file |

---

## Cleanup Recommendations

### P0 — Must Fix Before Launch

1. **Remove `gateway/main` from git tracking** and add `gateway/main` to `.gitignore`
2. **Fix `.gitignore`**: Change `models/` to `models/*` to properly exclude all model artifacts
3. **Add `.pytest_cache/` and `.ruff_cache/` to `.gitignore`**
4. **Rename `intelligence/api/midlware/` → `intelligence/api/middleware/`** (fix typo) and update all imports:
   - `intelligence/api/midlware/__init__.py`
   - `tests/test_phase8.py`
5. **Wire middleware into `intelligence/api/app.py`:**
   ```python
   app.add_middleware(AuthMiddleware)
   app.add_middleware(LoggingMiddleware)
   app.add_middleware(RateLimitMiddleware)
   app.add_middleware(VersioningMiddleware)
   ```
6. **Remove empty `dashboard/components/` and `dashboard/data/` directories** (or implement them)

### P1 — Should Fix Before Launch

7. **Consolidate `benchmarks/dataset/` and `benchmarks/datasets/`**: Choose one (keep Phase 9 `benchmarks/datasets/`), migrate any unique content, remove the other
8. **Remove empty stub files:**
   - `benchmarks/runner/evaluator.py` (0 bytes)
   - `benchmarks/runner/report_generator.py` (0 bytes)
   - `intelligence/embeddings/gemini_embedder.py` (0 bytes)
   - `intelligence/embeddings/openai_embedder.py` (0 bytes)
   - `gateway/interceptors/grpc_logging.go` (0 bytes)
   - `gateway/tenants/tenant.go` (0 bytes)
   - `gateway/tenants/tenant_store.go` (0 bytes)
9. **Assess `benchmarks/runner/` for removal**: All functionality exists in `benchmarks/e2e/`
10. **Assess `intelligence/benchmarks/` for removal**: Duplicates `benchmarks/e2e/`
11. **Remove stale docs:**
    - `docs/PHASE_1_SCOPE.md` (historical scope document)
    - `docs/EXPERIMENTS.md` (4 lines, not useful)
    - `docs/ROADMAP.md` (outdated roadmap)
12. **Remove `docs/ARCHITECTURE.md`** or merge content into README (README already covers architecture)
13. **Update `dashboard/app.py:58`** from "Version: Phase 9" to a generic version string (e.g., "Version: 3.0.0")
14. **Remove empty directories** or add `.gitkeep`:
    - `experiments/`
    - `benchmarks/results/e2e/`
    - `demo/screenshots/`
15. **Clean up `benchmarks/evaluator.py`** — assess if it's used or can be removed

### P2 — Nice To Have

16. **Add `generated/` to `.gitignore`** and regenerate at build time
17. **Optimize or remove `gateway/static/images/hero.png`** (5.8 MB)
18. **Consider removing or git-lfs `benchmarks/EU_AI_Act.pdf`** (2.5 MB)
19. **Verify `.gitignore` `benchmarks/results/` is properly excluding results**
20. **Rename `intelligence/api/routes/__init__.py`** to export route modules
21. **Update SDK naming from "Keiro" to "Kairos"** in `sdk/pyproject.toml` and `sdk/README.md`
22. **Remove `sdk/LICENSE.md`** (duplicates root `LICENSE.md`)

---

## File Moves

| From | To | Reason |
|------|----|--------|
| `intelligence/api/midlware/` | `intelligence/api/middleware/` | Fix typo (midlware → middleware) |

---

## Files Safe To Delete

### Dead / Empty Files
- `benchmarks/runner/evaluator.py` (0 bytes)
- `benchmarks/runner/report_generator.py` (0 bytes)
- `intelligence/embeddings/gemini_embedder.py` (0 bytes)
- `intelligence/embeddings/openai_embedder.py` (0 bytes)
- `gateway/interceptors/grpc_logging.go` (0 bytes)
- `gateway/tenants/tenant.go` (0 bytes)
- `gateway/tenants/tenant_store.go` (0 bytes)
- `gateway/main` (15 MB compiled binary)

### Stale Documentation
- `docs/PHASE_1_SCOPE.md` (Phase 1 scope only)
- `docs/EXPERIMENTS.md` (4 lines, not useful)
- `docs/ROADMAP.md` (outdated, only Phase 1-5)
- `docs/ARCHITECTURE.md` (redundant with README)

### Empty Directories
- `experiments/`
- `benchmarks/results/e2e/`
- `demo/screenshots/`
- `dashboard/components/` (only `__init__.py`)
- `dashboard/data/` (only `__init__.py`)

---

## Naming Fixes

| Current | Fixed | Priority | Location |
|---------|-------|----------|----------|
| `midlware` | `middleware` | P0 | `intelligence/api/midlware/` |
| `ablations.py` (dashboard page) | Keep — but note inconsistency with `ablation_v2.py` | P2 | `dashboard/pages/ablations.py` |
| `judging/` (good) | — | — | — |
| `retrieval/` (good) | — | — | — |

---

## Dependency Review

### `requirements.txt` (Production)

| Package | Status | Notes |
|---------|--------|-------|
| `grpcio` | ✅ Required | gRPC for Go↔Python comm |
| `protobuf` | ✅ Required | Protobuf messages |
| `dotenv` | ✅ Required | Environment variables |
| `pypdf` | ✅ Required | PDF ingestion |
| `chromadb` | ✅ Required | Vector store |
| `semantic_text_splitter` | ✅ Required | Document chunking |
| `sentence_transformers` | ✅ Required | Embeddings |
| `google-genai` | ✅ Required | Gemini LLM access |
| `rank_bm25` | ✅ Required | BM25 retrieval |
| `numpy` | ✅ Required | Numeric operations |
| `openai` | ✅ Required | OpenAI LLM access |
| `pydantic>=2.7.0` | ✅ Required | Config validation |
| `pydantic-settings>=2.1.0` | ✅ Required | Settings management |
| `fastapi>=0.111.0` | ✅ Required | Management API |
| `uvicorn>=0.30.0` | ✅ Required | ASGI server |
| `starlette>=0.37.0` | ✅ Required | FastAPI dependency |

### Missing Dependencies (should be added)

| Package | Reason |
|---------|--------|
| `streamlit` | Required by dashboard (not in requirements.txt) |
| `plotly` | Used by dashboard pages (not in requirements.txt) |
| `httpx` | Required by SDK (in `sdk/pyproject.toml` but not root `requirements.txt`) |
| `pandas` | Used by dashboard and benchmarks |
| `matplotlib` | Used by `benchmarks/reporting/charts.py` |

### Go Dependencies (`go.mod`)

| Package | Status |
|---------|--------|
| `go-chi/chi/v5` | ✅ Required |
| `go-chi/cors` | ✅ Required |
| `google/uuid` | ✅ Required |
| `hashicorp/golang-lru/v2` | ✅ Required |
| `joho/godotenv` | ✅ Required |
| `prometheus/client_golang` | ✅ Required |
| `golang.org/x/time` | ✅ Required |
| `google.golang.org/grpc` | ✅ Required |
| `google.golang.org/protobuf` | ✅ Required |

All Go dependencies appear required. No obvious removals.

---

## Test Organization vs Source Structure

| Source Package | Test File(s) | Status |
|----------------|-------------|--------|
| `intelligence/ablation/` | `test_ablation.py` | ✅ |
| `intelligence/api/` (midlware) | `test_phase8.py` | ✅ |
| `intelligence/calibration/` | `test_calibration.py` | ✅ |
| `intelligence/circuit_breaker/` | `test_circuit_breaker.py` | ✅ |
| `intelligence/classifier/` | `test_classifier.py` | ✅ |
| `intelligence/experiments/` | `test_experiments.py` | ✅ |
| `intelligence/feedback/` | `test_feedback*.py` (6 files) | ✅ |
| `intelligence/planner/` | `test_budget_allocator.py`, `test_budget_optimizer.py`, `test_retrieval_planner.py`, `test_fallback_manager.py` | ✅ |
| `intelligence/statistics/` | `test_statistics.py` | ✅ |
| `intelligence/evaluation/` | `test_metrics.py`, `test_precision.py`, `test_recall.py`, `test_latency.py`, `test_failure_rate.py` | ✅ |
| `intelligence/config/` | `test_server_config.py` | ✅ |
| `intelligence/retrieval/` | `test_dataset_loader.py` | Partial |
| `intelligence/training/` | `test_dataset_builder.py` | ✅ |
| `benchmarks/runner/` | `test_runner.py` | ✅ |
| `benchmarks/e2e/` | `test_phase9.py` | ✅ |
| `benchmarks/dataset/` | `test_eu_ai_act_dataset.py` | ✅ |
| `intelligence/server/` | `test_health.py` | ✅ |
| `intelligence/telemetry/` | `test_telemetry.py` | ✅ |
| `intelligence/reporting/` | `test_reporting.py` | ✅ |
| `intelligence/retraining/` | `test_retrainer.py` | ✅ |
| Various Phase 7 | `test_phase7.py` | ✅ |
| Various Phase 8 | `test_phase8.py` | ✅ |
| Various Phase 9 | `test_phase9.py` | ✅ |
| Various Phase 10 | `test_phase10.py` | ✅ |
| `intelligence/grpc` integration | `test_grpc_planner_integration.py` | ✅ |
| `intelligence/strategy_selector.py` | `test_strategy_selector.py` | ✅ |
| `intelligence/embedding_cache.py` | `test_embedding_cache.py` | ✅ |
| `intelligence/benchmarks/`, `intelligence/judging/`, etc. | `test_phase9.py` | ✅ |

### Missing Test Coverage

| Source Module | Notes |
|---------------|-------|
| `intelligence/api/routes/*.py` | API route handlers lack dedicated tests (covered partially by test_phase8.py) |
| `intelligence/retrieval/real_retriever.py` | No dedicated test |
| `intelligence/retrieval/retrieval_executor.py` | No dedicated test |
| `intelligence/retrieval/corpus_manager.py` | No dedicated test |
| `intelligence/retrieval/retrieval_result.py` | No dedicated test |
| `intelligence/ingestion/*.py` | No dedicated tests |
| `intelligence/llm/*.py` | No dedicated tests |
| `intelligence/optimization/*.py` | No dedicated tests |
| `intelligence/reranker/*.py` | No dedicated tests |
| `intelligence/vectorstore/*.py` | No dedicated tests |
| `intelligence/embeddings/*.py` | (Stubs only) |
| `examples/*/run.py` | Covered by test_phase10.py | ✅ |
| `scripts/*.py` | No dedicated tests |
| `sdk/keiro/*.py` | No dedicated tests |

---

## Launch Readiness Assessment

| Area | Rating (1-5) | Notes |
|------|-------------|-------|
| **Code Quality** | 4/5 | Well-structured, typed Python. Minor dead code. |
| **Test Coverage** | 4/5 | 1671 tests passing. Gaps in ingestion, llm, optimization, routes. |
| **Documentation** | 4/5 | Strong README, CONTRIBUTING, case studies. Stale phase docs need cleanup. |
| **Repository Hygiene** | 3/5 | 15MB binary tracked, empty stubs, typo in package name, .gitignore gaps. |
| **Dashboard** | 4/5 | 12 pages, all functional. Unused components/data dirs. Version text needs update. |
| **SDK** | 3/5 | Uses old name "Keiro". No test coverage. |
| **CI/CD** | 4/5 | 4 workflows (test, lint, security, release). Could add dashboard tests. |
| **Docker** | 4/5 | 5 Dockerfiles + docker-compose. Grafana provisioning included. |
| **Architecture** | 5/5 | Clean separation: Go gateway, Python intelligence, Streamlit dashboard. |

### Launch Blockers (P0)
1. `gateway/main` binary tracked in git (15.3 MB) — **remove from tracking and gitignore**
2. `.gitignore` allows `models/registry.json` to be tracked — **fix pattern**
3. `.pytest_cache` not in `.gitignore` — **add it**
4. Typo `midlware` → `middleware` — **rename directory and fix all imports**
5. Middleware exists but never wired into FastAPI app — **add `app.add_middleware()` calls**

### Recommended Pre-Launch Checklist
- [ ] Fix all P0 items
- [ ] Fix all P1 items
- [ ] Run full test suite and confirm 1671+ passing
- [ ] Verify dashboard launches with `streamlit run dashboard/app.py`
- [ ] Verify FastAPI management API starts
- [ ] Run `scripts/validate.py` (if it checks all components)
- [ ] Update `CHANGELOG.md` for cleanup phase
- [ ] Review README for final accuracy
