# Repository Cleanup Audit

**Audit date:** 2026-06-24
**Auditor:** Automated pre-launch review
**Repository:** `ANUBprad/Kairos`

> This is a read-only audit. No files were modified, deleted, or moved during this review.

---

## Executive Summary

The repository is structurally sound but carries significant technical debt from rapid development across 13+ phases. The codebase contains:

- **3 actively broken components** (worker service, Go logging/tracing middleware)
- **~35 duplicate/overlapping document files** (12 MB of docs)
- **7 missing runtime dependencies** from `requirements.txt`
- **44 bare `except Exception:` handlers** in production code
- **One 5.88 MB unused image** bloating the repository
- **Production readiness score: 6/10**

Estimated cleanup effort: **3-5 days** for a single engineer.

---

## Repository Health Score

| Category | Score | Summary |
|----------|-------|---------|
| Code Quality | 6/10 | 44 bare excepts, 4 print() in production, 1 class-name collision in tests |
| Documentation | 5/10 | 31 docs, many overlapping, 3 personal, 1 skeleton (EXPERIMENTS.md) |
| Test Quality | 7/10 | 1,802 tests, all pass, but 140+ duplicate names, no conftest.py |
| Docker Setup | 6/10 | Worker service broken, 6/8 services lack health checks, no resource limits |
| Dependencies | 5/10 | 7 missing from requirements.txt, 10/16 unpinned, worker module missing |
| Security | 5/10 | CORS allows all origins, Grafana password hardcoded, no TLS |
| Observability | 7/10 | Metrics + tracing exist, but Go tracing/logging middleware are no-ops |
| Assets | 6/10 | Duplicate logo file, 5.88 MB unused image, no `.env.example` |
| **Overall** | **6/10** | **Production-capable after ~3-5 days of cleanup** |

---

## Critical Issues

### C1. Worker service cannot start

- **File:** `docker/worker.Dockerfile` (ENTRYPOINT: `python -u -m intelligence.worker`)
- **Problem:** No `intelligence/worker.py` or `intelligence/worker/` module exists anywhere in the codebase.
- **Impact:** `docker compose up` will fail when the worker service starts.
- **Fix:** Either create the worker module or remove the service.

### C2. Missing runtime dependencies (7 packages)

The following packages are imported in production code but absent from `requirements.txt`:

| Package | Used In |
|---------|---------|
| `scipy` | `intelligence/statistics/significance.py`, `intelligence/statistics/confidence_intervals.py` |
| `scikit-learn` | `intelligence/calibration/calibration_model.py`, `benchmarks/runner/calibration_training.py` |
| `pandas` | 14 dashboard files |
| `plotly` | 10 dashboard files |
| `streamlit` | 16 dashboard files |
| `prometheus-client` | `intelligence/metrics/prometheus_metrics.py` |
| `grpcio-health-checking` | `intelligence/server/health.py`, `tests/test_health.py` |

- **Impact:** Fresh pip install from `requirements.txt` will fail at runtime.
- **Fix:** Add all 7 packages to `requirements.txt`.

### C3. Class name collision in test file

- **File:** `tests/test_budget_optimizer.py`
- **Classes `_Clf` and `R`** are each defined **5 times** in the same file. Python class definitions are executed at definition time, so only the last definition survives. Tests using these classes may not be testing what they appear to test.
- **Impact:** Tests may pass for the wrong reasons.
- **Fix:** Give each class a unique name.

### C4. CORS allows all origins

- **File:** `gateway/api/router.go` line 23
- **Config:** `"http://*", "https://*"`
- **Impact:** Any website can make cross-origin requests to the gateway.
- **Fix:** Restrict to specific origins or use a proper CORS policy.

### C5. Grafana admin password hardcoded

- **File:** `docker-compose.yml` line 115
- **Value:** `"admin"`
- **Impact:** Anyone with Docker access can log into Grafana as admin.
- **Fix:** Read from environment variable with a default override.

### C6. Go logging and tracing middleware are no-ops

- **Files:** `gateway/middleware/logging.go`, `gateway/middleware/tracing.go`
- **Code:** Both are empty handler wrappers that do nothing.
- **Impact:** Logging and tracing claims in README are unfulfilled for the Go gateway.
- **Fix:** Implement actual logging and trace propagation logic.

---

## Medium Issues

### M1. 44 bare `except Exception:` handlers in production code

Worst offenders:

| File | Count | Pattern |
|------|-------|---------|
| `intelligence/observability/alerting.py` | 2 | `except Exception: pass` |
| `intelligence/observability/event_logger.py` | 1 | `except Exception: pass` |
| `intelligence/observability/tracing.py` | 1 | `except Exception: pass` |
| `intelligence/reporting/reproducibility.py` | 1 | `except Exception: pass` |
| `intelligence/feedback/collector.py` | 2 | `except FileNotFoundError: pass` |
| `intelligence/retraining/retrainer.py` | 1 | `except ValueError: pass` |
| `intelligence/server/grpc_server.py` | ~6 | `except Exception: ...` |

**Fix:** Replace with specific exception types; add logging in all catch blocks.

### M2. `print()` in 4 production library files

| File | Line |
|------|------|
| `intelligence/statistics/bootstrap.py` | 44 |
| `intelligence/observability/event_logger.py` | 88 |
| `intelligence/server/grpc_server.py` | 230 |
| `intelligence/retraining/retrainer.py` | 27 |

**Fix:** Replace with `logging.getLogger(__name__).info(...)`.

### M3. Duplicate logo file

- `docs/assets/kairos-logo.png` (651,917 bytes)
- `docs/assets/logo/kairos-logo.png` (651,917 bytes, identical)
- **Action:** Remove `docs/assets/kairos-logo.png`.

### M4. Unused 5.88 MB hero image

- **File:** `gateway/static/images/hero.png` (5,884,466 bytes)
- **Status:** Not referenced by any HTML, Go, TSX, JS, or CSS file.
- **Action:** Remove or optimize.

### M5. `benchmarks/dataset/` vs `benchmarks/datasets/` naming collision

Two sibling directories with confusingly similar names:
- `benchmarks/dataset/` — `audit.py`, `generate_queries.py`, `loader.py`
- `benchmarks/datasets/` — `generator.py`

**Action:** Merge or rename one.

### M6. `KEIRO_*` naming persists in docs and config

| File | Outdated Name |
|------|---------------|
| `docs/DEPLOYMENT.md` | `KEIRO_*` env vars, `yourusername/keiro.git` URL |
| `docs/ARCHITECTURE.md` | `KEIRO_*` env references |
| `docker-compose.yml` | `KEIRO_ENVIRONMENT`, `KEIRO_CHROMA_STORE_HOST`, `KEIRO_INTELLIGENCE_HOST` |
| `intelligence/config/settings.py` | `env_prefix="KEIRO_"` |
| `gateway/config/config.go` | `KEIRO_*` env var names |

**Action:** Rename to `KAIROS_*` consistently.

### M7. `.env.example` file missing

- `docs/DEPLOYMENT.md` line 15: `cp .env.example .env`
- **Problem:** No `.env.example` exists.
- **Impact:** New developers don't know what environment variables are required.
- **Fix:** Create `.env.example` with all documented vars.

### M8. 7 missing packages in dashboard Dockerfile

`docker/dashboard.Dockerfile` installs `streamlit`, `plotly`, `altair` explicitly but none are in `requirements.txt`. Install of `altair` is unnecessary (never imported). This pattern means dashboard dependencies are only documented in the Dockerfile.

**Fix:** Add `streamlit`, `plotly`, `pandas` to `requirements.txt`; remove `altair`.

### M9. 140+ duplicate test function names

Test names like `test_empty` (25 copies), `test_to_dict` (22 copies), `test_defaults` (20 copies) make selective test execution by name unreliable and suggest copy-paste patterns.

**Fix:** Rename tests to be unique or use descriptive parametrize IDs.

### M10. Dashboard `utils.py` is legacy code (324 lines)

All functions in `dashboard/utils.py` have been superseded by `dashboard/components.py` and `dashboard/theme.py`. No page imports from `utils.py`.

| Dead Function | Superseded By |
|--------------|--------------|
| `render_page_header()` | `components.page_header()` |
| `render_kpi_cards()` | `components.kpi_row()` |
| `render_footer()` | `components.footer()` |
| `plot_bar_chart()` | `components.bar_chart()` |
| `plot_grouped_bar()` | `components.grouped_bar()` |
| `plot_heatmap()` | Never called anywhere |
| `apply_custom_css()` | `theme.inject_css()` |

**Action:** Remove `dashboard/utils.py`.

### M11. `ablation_v2.py` vs `ablations.py`

Two pages covering the same topic (ablation studies) with different implementation approaches. `ablations.py` imports live data; `ablation_v2.py` uses hardcoded data.

**Action:** Consolidate into one page or remove `ablation_v2.py`.

---

## Low Priority Issues

### L1. No conftest.py or pytest configuration

No shared fixtures, no test markers, no coverage config. All 37 test files self-configure with `sys.path.insert()`.

**Fix:** Create `tests/conftest.py` with common fixtures and path setup.

### L2. 12 empty `__init__.py` files

The following `intelligence/` subpackages have empty `__init__.py`:
`api/routes/`, `cache/`, `circuit_breaker/`, `classifier/`, `embeddings/`, `ingestion/`, `llm/`, `metrics/`, `reranker/`, `retrieval/`, `server/`, `vectorstore/`

Some are intentional (routes registered via app setup). Review the rest.

### L3. `intelligence/benchmarks/loaders/__init__.py` has unused import

`Dict` imported from `typing` but never used.

### L4. No version pins on 10/16 `requirements.txt` packages

High risk of build breakage over time.

### L5. `intelligence/server/config.py` vs `intelligence/config/settings.py` — two config systems

Dual maintenance burden. Both serve the same purpose.

### L6. No `.gitignore` entry for `apps/portal/out/`

Build artifacts from Next.js export could be accidentally committed.

### L7. `prometheus.yml` only scrapes gateway metrics

Intelligence service metrics port (8001) is not scraped.

### L8. `go.yaml.in/yaml/v2` as indirect dependency

Unusual module path (`go.yaml.in` vs standard `gopkg.in/yaml.v2`). Verify this is legitimate and not a typo-squat.

### L9. `KEIRO_SECRET` (Go) vs `KEIRO_API_SECRET` (Python) naming inconsistency

Different env var names for the same concept.

### L10. 8 dashboard files duplicate `sys.path.insert(0, str(ROOT))`

Consolidate into a shared `conftest.py` or dashboard init module.

---

## Dead Code Candidates

| File | Lines | Status | Action |
|------|-------|--------|--------|
| `dashboard/utils.py` | 324 | Entirely superseded by components.py + theme.py | Safe to delete |
| `gateway/middleware/logging.go` | 11 | No-op handler wrapper | Safe to delete or implement |
| `gateway/middleware/tracing.go` | 11 | No-op handler wrapper | Safe to delete or implement |
| `docs/EXPERIMENTS.md` | 3 | Skeleton with placeholder content | Safe to delete |
| `docs/PHASE_1_SCOPE.md` | 50 | Fully subsumed by ROADMAP.md | Safe to delete |
| `docs/case_study.md` | 85 | Duplicate of portfolio_case_study.md | Merge or delete |
| `docs/interview_talking_points.md` | 35 | Personal career prep (not for public repo) | Delete before public launch |
| `docs/resume_bullets.md` | 29 | Personal resume bullets | Delete before public launch |
| `docs/portfolio_case_study.md` | 98 | Personal portfolio doc | Delete before public launch |

---

## Duplicate Files

| Duplicate A | Duplicate B | Size | Action |
|-------------|-------------|------|--------|
| `docs/assets/kairos-logo.png` | `docs/assets/logo/kairos-logo.png` | 651 KB each | Delete A |
| `benchmarks/dataset/` package | `benchmarks/datasets/` package | ~4 files | Merge |
| `dashboard/ablations.py` | `dashboard/ablation_v2.py` | ~170 lines total | Merge into one |
| 140+ duplicate test names | — | Across 37 files | Rename uniquely |
| `docs/PRODUCT_POSITIONING.md` | Overlaps with PRODUCT_DEFINITION.md | 12 KB | Consolidate |
| `docs/APP_UX_PLAN.md` | Overlaps with SAAS_APP_UX.md | 41 KB each | Keep one |
| `docs/LANDING_PAGE_SPEC.md` | Overlaps with LANDING_PAGE_MASTERPLAN.md | 44 KB + 32 KB | Keep one |

---

## Dependency Recommendations

### Add to `requirements.txt`

```
scipy>=1.12.0
scikit-learn>=1.4.0
pandas>=2.2.0
plotly>=5.20.0
streamlit>=1.35.0
prometheus-client>=0.20.0
grpcio-health-checking>=1.62.0
```

### Add version pins to 10 unpinned packages

All 10 packages without version constraints in `requirements.txt` should have `>=` minimums to prevent accidental breakage on new releases.

### Remove from `docker/dashboard.Dockerfile`

`altair` — installed but never imported anywhere.

### Verify dependency

`go.yaml.in/yaml/v2` — unusual module path. Compare with `gopkg.in/yaml.v2` to ensure this is not a typo-squat.

---

## Documentation Recommendations

### Keep (canonical)

| Document | Purpose |
|----------|---------|
| `README.md` | Landing page |
| `docs/ARCHITECTURE.md` | System design |
| `docs/BENCHMARKS.md` | Update with actual leaderboard data |
| `docs/DEPLOYMENT.md` | Fix to use KAIROS_* naming |
| `docs/OBSERVABILITY.md` | Keep |
| `docs/OPERATIONS.md` | Keep |
| `docs/SECURITY.md` | Keep |
| `docs/CONTRIBUTING.md` | Keep |
| `docs/CHANGELOG.md` | Keep |
| `docs/LICENSE.md` | Keep |
| `docs/PRODUCT_DEFINITION.md` | Consolidate PRODUCT_POSITIONING and PRODUCT_STRATEGY into this |

### Delete (not suitable for public repo)

- `docs/interview_talking_points.md`
- `docs/resume_bullets.md`
- `docs/portfolio_case_study.md`
- `docs/EXPERIMENTS.md` (skeleton, 3 lines)
- `docs/PHASE_1_SCOPE.md` (subsumed by ROADMAP.md)

### Merge into canonical docs

- `docs/PRODUCT_POSITIONING.md` → merge into `PRODUCT_DEFINITION.md`
- `docs/PRODUCT_STRATEGY.md` → merge into `PRODUCT_DEFINITION.md`
- `docs/case_study.md` → merge into one case study document
- `docs/APP_UX_PLAN.md` → merge into `SAAS_APP_UX.md`
- `docs/LANDING_PAGE_SPEC.md` → merge into `LANDING_PAGE_MASTERPLAN.md`

### Keep but note as supplementary

- `docs/WEBSITE_ARCHITECTURE.md`
- `docs/WEBSITE_SITEMAP.md`
- `docs/SAAS_ARCHITECTURE.md`
- `docs/SAAS_APP_UX.md`
- `docs/BRAND_SYSTEM.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/MARKETING_COPY.md`
- `docs/MOTION_SYSTEM.md`
- `docs/MONETIZATION.md`
- `docs/SUCCESS_METRICS.md`
- `docs/USER_JOURNEY.md`
- `docs/FEATURE_ROADMAP.md`
- `docs/COMPETITOR_ANALYSIS.md`
- `docs/ROADMAP.md` (update to cover all phases)
- `docs/PHASE_12_IMPLEMENTATION_PLAN.md` (supplementary)
- `docs/phase9_report.md` (historical)
- `docs/REPOSITORY_AUDIT.md` (superseded by this document)
- `docs/diagrams/*.md` (5 diagram docs)

---

## Dashboard Recommendations

| File | Recommendation |
|------|---------------|
| `dashboard/app.py` | Keep |
| `dashboard/theme.py` | Keep |
| `dashboard/components.py` | Keep |
| `dashboard/utils.py` | **Delete** — entirely superseded |
| `dashboard/pages/ablations.py` | Keep |
| `dashboard/pages/ablation_v2.py` | **Delete or merge** into ablations.py |
| `dashboard/pages/benchmarks.py` | Keep |
| `dashboard/pages/comparisons.py` | Keep |
| `dashboard/pages/cost_analysis.py` | Keep |
| `dashboard/pages/domain_analysis.py` | Keep |
| `dashboard/pages/experiments.py` | Keep |
| `dashboard/pages/judge_dashboard.py` | Keep |
| `dashboard/pages/leaderboard.py` | Keep |
| `dashboard/pages/observability.py` | Keep |
| `dashboard/pages/planner_analysis.py` | Keep |
| `dashboard/pages/statistics.py` | Keep |

All pages have real content. No placeholders detected.

---

## Cleanup Plan

### Day 1 — Safety (Critical fixes)

| Priority | Task | Files |
|----------|------|-------|
| P0 | Fix worker module or remove service | `docker/worker.Dockerfile`, `docker-compose.yml` |
| P0 | Add 7 missing dependencies to `requirements.txt` | `requirements.txt` |
| P0 | Fix class name collision in tests | `tests/test_budget_optimizer.py` |
| P0 | Restrict CORS origins | `gateway/api/router.go` |
| P0 | Fix Grafana admin password | `docker-compose.yml` |

### Day 2 — Production readiness

| Priority | Task | Files |
|----------|------|-------|
| P1 | Replace 4 `print()` statements with logging | 4 files in `intelligence/` |
| P1 | Audit and fix 44 bare `except Exception:` handlers | Multiple files |
| P1 | Implement Go logging middleware | `gateway/middleware/logging.go` |
| P1 | Implement Go tracing middleware | `gateway/middleware/tracing.go` |

### Day 3 — Clean up

| Priority | Task | Files |
|----------|------|-------|
| P2 | Remove duplicate logo `docs/assets/kairos-logo.png` | 1 file |
| P2 | Remove unused 5.88 MB `hero.png` | 1 file |
| P2 | Remove `dashboard/utils.py` | 1 file (324 lines dead code) |
| P2 | Create `.env.example` | 1 file |
| P2 | Consolidate `benchmarks/dataset/` and `benchmarks/datasets/` | ~5 files |

### Day 4 — Documentation

| Priority | Task | Files |
|----------|------|-------|
| P3 | Delete 3 personal docs | 3 files |
| P3 | Delete `docs/EXPERIMENTS.md` and `docs/PHASE_1_SCOPE.md` | 2 files |
| P3 | Merge overlapping product docs | ~5 files |
| P3 | MERGE overlapping landing page + app UX docs | ~4 files |
| P3 | Update `docs/DEPLOYMENT.md` with `KAIROS_*` naming | 1 file |
| P3 | Update `docs/ARCHITECTURE.md` with `KAIROS_*` naming | 1 file |

### Day 5 — Polish

| Priority | Task | Files |
|----------|------|-------|
| P4 | Rename unique test functions (140+ duplicates) | `tests/test_*.py` |
| P4 | Create `tests/conftest.py` | 1 file |
| P4 | Add version pins to `requirements.txt` | 1 file |
| P4 | Add health checks to 6 remaining services | `docker-compose.yml` |
| P4 | Add resource limits to docker-compose | `docker-compose.yml` |

### Total estimated effort: **3-5 days**

---

## Files Safe to Delete

| File | Reason |
|------|--------|
| `docs/assets/kairos-logo.png` | Duplicate of canonical logo |
| `gateway/static/images/hero.png` | 5.88 MB, never referenced |
| `dashboard/utils.py` | Entirely superseded dead code |
| `dashboard/pages/ablation_v2.py` | Duplicate of ablations.py |
| `docs/interview_talking_points.md` | Personal content |
| `docs/resume_bullets.md` | Personal content |
| `docs/portfolio_case_study.md` | Personal content |
| `docs/EXPERIMENTS.md` | Skeleton (3 lines) |
| `docs/PHASE_1_SCOPE.md` | Subsumed by ROADMAP.md |
| `gateway/middleware/logging.go` | No-op (or implement) |
| `gateway/middleware/tracing.go` | No-op (or implement) |
| `apps/portal/out/` directory | Build artifact (add to .gitignore) |

## Files Safe to Merge

| Source | Target | Reason |
|--------|--------|--------|
| `benchmarks/dataset/` | `benchmarks/datasets/` | Same concept, different names |
| `docs/PRODUCT_POSITIONING.md` | `docs/PRODUCT_DEFINITION.md` | Overlapping content |
| `docs/PRODUCT_STRATEGY.md` | `docs/PRODUCT_DEFINITION.md` | 91 KB monolith overlaps multiple docs |
| `docs/case_study.md` | One consolidated case study | Duplicate |
| `docs/APP_UX_PLAN.md` | `docs/SAAS_APP_UX.md` | Near-identical content |
| `docs/LANDING_PAGE_SPEC.md` | `docs/LANDING_PAGE_MASTERPLAN.md` | Same content, different phase labels |

## Files Requiring Manual Review

| File | Issue |
|------|-------|
| `intelligence/config/settings.py` | env_prefix="KEIRO_" — rename to KAIROS_ |
| `gateway/config/config.go` | KEIRO_ env vars — rename to KAIROS_ |
| `intelligence/server/config.py` | Duplicate config system vs settings.py |
| `go.mod` — `go.yaml.in/yaml/v2` | Verify this is legitimate |
| `tests/test_budget_optimizer.py` | 5x class name collision |
| All files with `except Exception:` | 44 handlers to review individually |
| `docker-compose.yml` | 6 services missing health checks |
