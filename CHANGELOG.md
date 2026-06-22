# Changelog

## [3.0.0] — 2026-06-22 — Open Source & Launch Readiness

### Added
- Phase 10A: Complete README overhaul with badges, architecture, benchmarks, and project structure
- Phase 10B: Contributor experience — CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, issue/PR templates
- Phase 10C: Architecture visualization — 5 Mermaid diagrams (retrieval flow, planner flow, feedback loop, evaluation pipeline, deployment)
- Phase 10D: Runnable examples — simple_rag, adaptive_rag, enterprise_search, multi_hop_qa
- Phase 10E: Public benchmark leaderboard with 10-metric comparison across 5 modes
- Phase 10F: Demo assets — demo_script.md, walkthrough.md
- Phase 10G: Resume & interview package — case_study.md, resume_bullets.md, interview_talking_points.md
- Phase 10H: Portfolio-ready case study
- Phase 10I: CHANGELOG.md, RELEASE_NOTES.md

### Changed
- README.md completely redesigned with professional layout, badges, architecture diagram, benchmark tables
- Full test suite expanded to 1,671 tests

## [2.0.0] — 2026-06-21 — Research Validation

### Added
- Phase 9A: Real retriever, retrieval executor, corpus manager
- Phase 9B: Gold dataset generator (1,020 queries across 5 domains)
- Phase 9C: LLM judge framework (faithfulness, relevance, hallucination, grounding, scoring)
- Phase 9D: End-to-end benchmark pipeline (runner, config, result, report)
- Phase 9E: Baseline comparison (5 modes)
- Phase 9F: Ablation validation
- Phase 9G: Cost analysis
- Phase 9H: Research dashboard V2 (7 new pages — leaderboard, domain, planner, cost, ablation, judge, comparisons)
- Phase 9I: Phase 9 research report

### Results
- 23.6% improvement over Naive RAG (p < 0.001, Cohen's d = 0.89)
- 1,671 total tests

## [1.0.0] — 2026-06-20 — Production Deployment

### Added
- Phase 8A: Configuration system (Pydantic settings, environments, validation, secrets)
- Phase 8B: FastAPI management API (auth, rate limiting, versioning, health checks, routes)
- Phase 8C: Dockerization (API, dashboard, worker Dockerfiles)
- Phase 8D: CI/CD (GitHub Actions for test, lint, security, release)
- Phase 8E: Artifact registries (model, experiment, report)
- Phase 8F: Automation scripts (release, build, benchmark, validate)
- Phase 8G: Operations documentation (deployment, benchmarks, observability, operations)

## [0.3.0] — 2026-06-19 — Observability & Evaluation

### Added
- Phase 7A: Observability (tracing, event logging, performance monitoring, alerting, metrics)
- Phase 7B: Evaluation (ranking metrics, evaluator, benchmark, ground truth, reporting)
- Phase 7C: Streamlit research dashboard (5 pages — experiments, benchmarks, ablations, statistics, observability)

## [0.2.0] — 2026-06-17 — Core Intelligence

### Added
- Phase 4-6: Planner, calibration, optimization, feedback system
- Query classifier with confidence scoring
- Budget allocator and strategy selector
- Fallback management
- Experiment tracking

## [0.1.0] — 2026-06-15 — Foundation

### Added
- Phase 1-3: Core Go API gateway, Python gRPC client, ChromaDB integration
- Simple, complex, and multi-hop retrievers
- Basic planner infrastructure
- Docker compose setup
- Initial test suite
