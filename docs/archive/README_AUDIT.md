# README Audit

Audit performed 2026-06-24 against repository `ANUBprad/Kairos`.

---

## Placeholders Removed

| # | Placeholder | Location | Replacement |
|---|-------------|----------|-------------|
| 1 | `href="#"` on all badges | Hero section | Removed `<a>` wrappers entirely (static badges don't need links) |
| 2 | `https://github.com/anomalyco/kairos` (non-existent) | Footer, Quick Start | `https://github.com/ANUBprad/Kairos` (verified from `git remote -v`) |
| 3 | `sdk/` directory name | Repository Structure | `sdk/keiro/` (actual package directory) |
| 4 | "8 services" (inaccurate) | Repository Highlights | "8 container services" (verified: 11 compose entries, 3 are data volumes) |
| 5 | "1,800+ tests" (approximate) | Hero badge, Architecture, Highlights | "1,791 tests" (verified via AST parse of all test files) |

---

## Claims Verified

| # | Claim | Verification | Result |
|---|-------|-------------|--------|
| 1 | "5 domains" | `benchmarks/e2e/benchmark_config.py` — finance, legal, healthcare, technology, general | ✅ |
| 2 | "5 modes" | `benchmarks/e2e/benchmark_config.py` — Naive RAG, Always Simple, Always Complex, Always Multi-Hop, Kairos Adaptive | ✅ |
| 3 | "204 queries each, 1,020 total" | `benchmarks/e2e/benchmark_config.py` config; leaderboard data | ✅ |
| 4 | Composite scores (0.72–0.89) | `benchmarks/leaderboard/leaderboard.md` — exact match | ✅ |
| 5 | Latency values (133–190 ms) | `benchmarks/leaderboard/leaderboard.md` — exact match | ✅ |
| 6 | "Go API gateway with gRPC" | `gateway/` directory with Go modules; `proto/rag.proto`; `intelligence/server/grpc_server.py` | ✅ |
| 7 | "ChromaDB vector store" | `docker-compose.yml` chromadb service (image `chromadb/chroma:1.0.15`) | ✅ |
| 8 | "Streamlit research dashboard" | `dashboard/app.py` with streamlit imports | ✅ |
| 9 | "Prometheus metrics, Grafana dashboards" | `docker-compose.yml` prometheus + grafana services; `gateway/metrics/` directory | ✅ |
| 10 | "FastAPI management API" | `intelligence/api/` directory with FastAPI modules | ✅ |
| 11 | "Pydantic settings" | `intelligence/config/` with pydantic-settings usage | ✅ |
| 12 | "Feedback learning" | `intelligence/feedback/` directory | ✅ |
| 13 | "Confidence calibration" | `intelligence/calibration/` directory | ✅ |
| 14 | "Platt-scaled and isotonic regression" | `intelligence/calibration/` source code | ✅ |
| 15 | All 11 documentation files exist | `Test-Path` on each referenced doc | ✅ |
| 16 | License: MIT | `LICENSE.md` file | ✅ |
| 17 | Kairos logo exists | `docs/assets/logo/kairos-logo.png` | ✅ |
| 18 | Docker compose file exists | `docker-compose.yml` at repo root | ✅ |
| 19 | Python 3.11+ dependency | `pyproject.toml` / `requirements.txt` | ✅ |
| 20 | Go module dependency | `go.mod` (go 1.26) | ✅ |

---

## Fixes Applied

### 1. Logo path corrected (BRANDING)
- **Before**: `docs/logo/kairos-logo.png`
- **After**: `docs/assets/logo/kairos-logo.png`
- **Action**: Created `docs/assets/logo/` directory and moved logo file there.

### 2. Tagline updated (POSITIONING)
- **Before**: "Adaptive Knowledge Intelligence Platform"
- **After**: "Adaptive Retrieval Infrastructure for Production AI Systems"

### 3. Section structure realigned

| Required Section | Previous README | Status |
|-----------------|-----------------|--------|
| Hero Section | Present | ✅ Kept, enhanced |
| Why Kairos Exists | "What Is Kairos" | ✅ Renamed and sharpened |
| Problem Statement | "The Problem" | ✅ Kept, minor edits |
| How Kairos Works | Present | ✅ Kept |
| Core Capabilities | Present | ✅ Kept |
| Architecture Overview | Present | ✅ Updated directory listing |
| Benchmark Results | Present | ✅ Expanded with full leaderboard metrics |
| Quick Start | Present | ✅ Fixed GitHub URL |
| Repository Structure | Present | ✅ Updated intelligence/ subdirectories |
| Product Vision | Missing entirely | ✅ Added new section |
| Roadmap | Present | ✅ Kept |
| Documentation | Present | ✅ Expanded with more docs |
| License | Present | ✅ Kept |

### 4. GitHub URL corrected
- **Before**: `https://github.com/anomalyco/kairos`
- **After**: `https://github.com/ANUBprad/Kairos`

### 5. Badge links fixed
- Removed empty `href="#"` wrappers from static badges.

### 6. Test count corrected
- **Before**: "1,800+ tests" / "1,800+ tests across 37 test files"
- **After**: "1,791 tests across 37 test files"
- **Source**: AST parse of all `test_*.py` files counted 1,791 `def test_*` functions.

### 7. Benchmark table expanded
- Added Recall, Precision, MRR, MAP, NDCG, Hit Rate, Faithfulness, and Cost/Query columns from actual leaderboard data.
- Derived columns "Pass Rate" and "Fail Rate" removed (not in source data).

### 8. Repository structure updated
- Added missing `intelligence/` subdirectories found on disk.
- Fixed `sdk/` → `sdk/keiro/`.
- Added `docker/` Dockerfile listings.

### 9. Documentation table expanded
- Added references to docs found on disk: `PRODUCT_DEFINITION.md`, `WEBSITE_ARCHITECTURE.md`, `ROADMAP.md`, `EXPERIMENTS.md`, `PHASE_1_SCOPE.md`.

### 10. Docker services count clarified
- **Before**: "8 services"
- **After**: "8 container services" (3 of 11 compose entries are named volumes, not containers).

---

## GitHub Render Validation

### Dark mode check
- All content uses plain GitHub-flavored markdown or inline HTML without hardcoded background colors.
- Badges use `shields.io` static endpoints which respect dark mode.
- The logo PNG has a transparent background — renders correctly on both light and dark themes.

### Link check
- All 11 internal documentation links verified with `Test-Path`.
- All directory references verified against actual filesystem.
- GitHub URL updated to actual remote `ANUBprad/Kairos`.

### Image check
- `docs/assets/logo/kairos-logo.png` — file exists, PNG format, 120px display width.

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Placeholder links | 5 | 0 |
| Verified claims | ~12 | 20 |
| Section alignment | ~11/13 | 13/13 |
| Correct GitHub URL | No | Yes |
| Correct logo path | No | Yes |
| Correct branding tagline | No | Yes |
| Correct test count | Approximate (1,800+) | Exact (1,791) |
| Correct benchmark data | Partial (4 cols) | Full (10 cols) |
