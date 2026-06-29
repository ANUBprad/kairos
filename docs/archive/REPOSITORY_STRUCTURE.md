# Repository Structure

## Top-Level Layout

```
Kairos/
+-- gateway/              Go API gateway (HTTP + gRPC)
+-- intelligence/         Python intelligence service (28 modules)
+-- benchmarks/           Benchmark suite and evaluation framework
+-- dashboard/            Streamlit research dashboard (12 pages)
+-- tests/                1,802 tests across 37 files
+-- docs/                 Documentation (16 reference documents)
+-- docker/               Dockerfiles and Grafana provisioning
+-- proto/                gRPC protocol buffer definitions
+-- sdk/keiro/            Python client SDK
+-- generated/            Auto-generated gRPC stubs (Go + Python)
+-- scripts/              Build and automation scripts
+-- examples/             Usage examples (simple RAG, adaptive RAG, multi-hop QA, enterprise search)
+-- apps/portal/          Next.js web application (Phase 14)
+-- .github/              GitHub Actions workflows
```

## Ownership Map

| Directory | Owner | Purpose | Criticality |
|-----------|-------|---------|-------------|
| `gateway/` | Go | API gateway, auth, rate limiting, caching, gRPC routing | Critical |
| `intelligence/` | Python | Classifier, planner, retrievers, calibration, judging, feedback | Critical |
| `benchmarks/` | Python | Benchmark runner, datasets, leaderboard, evaluation | High |
| `dashboard/` | Python | Streamlit research dashboard and visualization | Medium |
| `tests/` | Python | Test suite across all components | Critical |
| `docs/` | Markdown | Documentation and operational guides | Medium |
| `docker/` | Docker | Container definitions and monitoring stack | High |
| `proto/` | Protobuf | gRPC service definitions | High |
| `sdk/keiro/` | Python | Client library for external consumers | Medium |
| `generated/` | Auto | Protobuf-generated code | High |
| `scripts/` | Python | Build, release, and validation automation | Low |
| `examples/` | Python | Demonstration and integration examples | Low |
| `apps/portal/` | TypeScript | Next.js web application | Low (WIP) |

## Cleanup History

The following files and directories were removed during Phase 13.6 hardening:

| Path | Reason |
|------|--------|
| `docs/assets/kairos-logo.png` | Duplicate of canonical `docs/assets/logo/kairos-logo.png` |
| `gateway/static/images/hero.png` | 5.88 MB unused image, not referenced anywhere |
| `dashboard/utils.py` | Entirely superseded by `dashboard/components.py` and `dashboard/theme.py` |
| `dashboard/pages/ablation_v2.py` | Duplicate of `dashboard/pages/ablations.py` |
| `docs/interview_talking_points.md` | Personal document, not suited for public repo |
| `docs/resume_bullets.md` | Personal document, not suited for public repo |
| `docs/portfolio_case_study.md` | Personal document, not suited for public repo |
| `docs/EXPERIMENTS.md` | Skeleton document (3 lines), no real content |
| `docs/PHASE_1_SCOPE.md` | Fully subsumed by ROADMAP.md |
| `docs/case_study.md` | Duplicate of portfolio_case_study.md |
