# Kairos v3.0 Release Notes

## Overview

Kairos v3.0 marks the **Open Source & Launch Readiness** milestone — transforming Kairos from a research project into a professional, contributor-ready, portfolio-worthy open-source AI platform.

## What's New in v3.0

### Professional Open Source Presence
- Complete README overhaul with badges, architecture diagrams, benchmark tables, and roadmap
- Contributor experience package: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Issue templates (feature request, bug report) and PR template
- CHANGELOG.md and RELEASE_NOTES.md

### Architecture Visualization
- 5 Mermaid diagrams covering retrieval flow, planner flow, feedback loop, evaluation pipeline, and deployment architecture
- Diagrams stored in `docs/diagrams/` for easy embedding in documentation

### Runnable Examples
- 4 example applications: simple_rag, adaptive_rag, enterprise_search, multi_hop_qa
- Each with README.md and run.py for immediate execution
- Demonstrate different capabilities of the Kairos platform

### Resume & Interview Package
- Case study document covering problem, architecture, challenges, tradeoffs, results
- Resume bullets for 4 roles: Intern, SDE, ML Engineer, Data Scientist
- Interview talking points with questions to ask interviewers

### Portfolio-Ready Documentation
- Portfolio case study suitable for personal website or GitHub profile
- Demo scripts for 5-minute and 10-minute presentations

## Phase 1-10 Summary

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| 1-3 | Core Pipeline | Go gateway, gRPC client, ChromaDB, 3 retrievers |
| 4-6 | Intelligence | Planner, calibration, optimization, feedback |
| 7 | Observability | Tracing, metrics, alerts, dashboard (5 pages) |
| 8 | Production | FastAPI API, Docker, CI/CD, artifact registries |
| 9 | Research | 23.6% improvement validated, 1,020-query benchmark |
| 10 | Launch | README, docs, examples, resume package, CHANGELOG |

## Metrics

- **1,671 tests** — Comprehensive test suite with zero regressions
- **1,020 gold-standard queries** — 5 domains, balanced difficulty
- **5 benchmark modes** — Naive RAG, Always Simple, Always Complex, Always Multi-Hop, Kairos Adaptive
- **23.6% improvement** — Kairos Adaptive vs Naive RAG (p < 0.001, d = 0.89)
- **12 dashboard pages** — Experiments, benchmarks, ablations, statistics, observability, leaderboard, domain, planner, cost, ablation V2, judge, comparisons
- **5 Mermaid diagrams** — Architecture visualization
- **4 runnable examples** — Demo capabilities
- **5 contributor docs** — CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates

## Getting Started

```bash
git clone https://github.com/anomalyco/kairos.git
cd kairos
pip install -r requirements.txt
pytest tests/ -q
docker compose up -d
streamlit run dashboard/app.py
```

## Acknowledgments

Kairos was built with Python, Go, ChromaDB, FastAPI, Streamlit, and Docker.
